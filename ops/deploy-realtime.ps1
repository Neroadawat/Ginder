# Deploy only the reviewed backend clock and WebSocket delivery changes.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sshPath = 'C:\Program Files\Git\usr\bin\ssh.exe'
$scpPath = 'C:\Program Files\Git\usr\bin\scp.exe'
$tarPath = Join-Path $env:SystemRoot 'System32\tar.exe'
$privateKey = Join-Path $env:USERPROFILE 'Downloads\ginder-ec2.pem'
foreach ($required in @($sshPath, $scpPath, $tarPath, $privateKey)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Missing required file: $required" }
}
function GitPath([string]$value) {
    $full = [IO.Path]::GetFullPath($value).Replace('\', '/')
    if ($full -notmatch '^([A-Za-z]):/(.*)$') { throw 'Expected a Windows path' }
    return '/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2]
}
$releaseId = 'realtime-' + [guid]::NewGuid().ToString('N')
$remoteStage = '/home/ubuntu/ginder-release-candidates/' + $releaseId
$server = 'ubuntu@54.206.67.32'
$sshOptions = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-i', (GitPath $privateKey))
$archive = Join-Path $env:TEMP ($releaseId + '.tar.gz')
# No environment files, credentials, frontend files or database dumps.
& $tarPath -czf $archive -C $repoRoot backend/app/main.py backend/app/websocket/connection_manager.py backend/tests ops/deploy-realtime.sh
if ($LASTEXITCODE -ne 0) { throw 'Could not package backend source.' }
& $sshPath @sshOptions $server "mkdir -p '$remoteStage'"
if ($LASTEXITCODE -ne 0) { throw 'SSH connection failed. Production was not changed.' }
& $scpPath -S ($sshPath.Replace('\', '/')) @sshOptions (GitPath $archive) "${server}:${remoteStage}/candidate.tar.gz"
if ($LASTEXITCODE -ne 0) { throw 'Candidate upload failed. Production was not changed.' }
# Strip CRLF from the entry script for Windows checkouts, leaving source intact.
& $sshPath @sshOptions $server "cd '$remoteStage' && tar -xzf candidate.tar.gz && sed -i 's/\r$//' ops/deploy-realtime.sh && cp ops/deploy-realtime.sh deploy.sh && bash deploy.sh"
if ($LASTEXITCODE -ne 0) { throw "Deployment failed. Review the output; candidate: $remoteStage" }
Write-Host 'Backend deployment and HTTPS readiness/clock checks passed.'
