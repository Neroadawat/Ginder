# Build once and install the same Debug app on every running Android emulator.
# Only known Ginder variants are removed, after the main app installs correctly.
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'
if (!(Test-Path -LiteralPath $adbPath)) { throw "ADB not found: $adbPath" }

function Invoke-Adb {
    $result = & $adbPath @args 2>&1
    if ($LASTEXITCODE -ne 0) { throw "ADB failed: $result" }
    return $result
}

$devices = @(Invoke-Adb devices | ForEach-Object {
    if ($_ -match '^(emulator-\d+)\s+device$') { $Matches[1] }
})
if (!$devices.Count) { throw 'Open your Android emulators first.' }
$architectures = @($devices | ForEach-Object {
    (Invoke-Adb -s $_ shell getprop ro.product.cpu.abi | Out-String).Trim()
} | Select-Object -Unique)
foreach ($architecture in $architectures) {
    if ($architecture -notin @('x86', 'x86_64', 'armeabi-v7a', 'arm64-v8a')) {
        throw "Unsupported emulator ABI: $architecture"
    }
}

Push-Location (Join-Path $frontendRoot 'android')
try {
    & .\gradlew.bat assembleDebug "-PreactNativeArchitectures=$($architectures -join ',')"
    if ($LASTEXITCODE -ne 0) { throw 'Debug build failed; no apps were removed.' }
} finally { Pop-Location }
$apkPath = Join-Path $frontendRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
if (!(Test-Path -LiteralPath $apkPath)) { throw 'Debug APK not found.' }

foreach ($device in $devices) {
    Write-Host "Updating Ginder on $device"
    Invoke-Adb -s $device install -r $apkPath | Out-Host
    # Install -r replaces the same package and preserves login/app data.
    # Stop on signature conflicts rather than deleting the main app's data.
    $variants = @(Invoke-Adb -s $device shell pm list packages | ForEach-Object {
        if ($_ -match '^package:(com\.tamsoot\.ginder\.appetize|com\.ginder|com\.neroadawat\.ginder)$') { $Matches[1] }
    })
    foreach ($variant in $variants) {
        Write-Host "Removing old Ginder variant: $variant"
        Invoke-Adb -s $device uninstall $variant | Out-Host
    }
    Invoke-Adb -s $device reverse tcp:8081 tcp:8081 | Out-Host
    Invoke-Adb -s $device shell am force-stop com.tamsoot.ginder | Out-Host
    Invoke-Adb -s $device shell am start -n com.tamsoot.ginder/.MainActivity | Out-Host
    Write-Host "Installed Ginder packages on ${device}:"
    Invoke-Adb -s $device shell pm list packages ginder | Out-Host
}
Write-Host 'Done. Keep npm start running in another terminal for the Debug app.'
