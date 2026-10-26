param(
    [string]$Server = 'ubuntu@54.206.67.32',
    [string]$PrivateKey = "$env:USERPROFILE\Downloads\ginder-ec2.pem",
    [string]$RecoveryDirectory = "$env:USERPROFILE\Ginder-Recovery"
)
$ErrorActionPreference = 'Stop'
$ssh = 'C:\Program Files\Git\usr\bin\ssh.exe'
$scp = 'C:\Program Files\Git\usr\bin\scp.exe'
function GitPath([string]$value) {
    $full = [IO.Path]::GetFullPath($value).Replace('\', '/')
    if ($full -notmatch '^([A-Za-z]):/(.*)$') { throw 'Expected a local Windows path' }
    return '/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2]
}
if (-not (Test-Path -LiteralPath $RecoveryDirectory)) {
    throw 'Create an access-restricted recovery directory and recovery key first.'
}
$destination = Join-Path $RecoveryDirectory 'backups'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$sshOptions = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=5', '-o', 'ServerAliveCountMax=2', '-i', (GitPath $PrivateKey))
$name = (& $ssh @sshOptions $Server "find /home/ubuntu/Ginder/backups/postgres -maxdepth 1 -type f -name 'ginder-*.dump.gpg' -printf '%f\n' | sort | tail -n 1").Trim()
if ($LASTEXITCODE -ne 0 -or $name -notmatch '^ginder-[0-9]{8}T[0-9]{6}Z\.dump\.gpg$') {
    throw 'No valid encrypted backup found'
}
$cipher = Join-Path $destination $name
$checksum = $cipher + '.sha256'
& $scp -S ($ssh.Replace('\', '/')) @sshOptions "${Server}:/home/ubuntu/Ginder/backups/postgres/$name.sha256" (GitPath $checksum)
if ($LASTEXITCODE -ne 0) { throw 'Checksum download failed' }
$expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
if ($expected -notmatch '^[a-fA-F0-9]{64}$') { throw 'Invalid checksum manifest' }
if (-not (Test-Path -LiteralPath $cipher)) {
    $partial = $cipher + '.partial'
    & $scp -S ($ssh.Replace('\', '/')) @sshOptions "${Server}:/home/ubuntu/Ginder/backups/postgres/$name" (GitPath $partial)
    if ($LASTEXITCODE -ne 0) { throw 'Encrypted backup download failed' }
    if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $expected) {
        throw 'Encrypted backup checksum mismatch'
    }
    Move-Item -LiteralPath $partial -Destination $cipher
}
if ((Get-FileHash -LiteralPath $cipher -Algorithm SHA256).Hash -ne $expected) {
    throw 'Local encrypted backup checksum mismatch'
}
Write-Output "Verified encrypted off-server copy: $cipher"
