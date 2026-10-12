# Android release

## Current release identity

- Package ID: `com.neroadawat.ginder`
- Version name: `1.0.0`
- Version code: `10000`
- Compile/target SDK: Android API 36
- Minimum SDK: Android API 24
- React Native: `0.87.1`
- Node.js: `22.13.1` or a compatible newer version from `package.json`

The package ID cannot be changed after the first Google Play upload. Register this
exact package in Firebase before enabling production push notifications.

## Secrets that must be backed up

The following local files are intentionally ignored by Git:

- `android/app/ginder-upload-key.jks`
- `android/keystore.properties`
- `.env.production`

Back up the keystore and its passwords in a password manager and a second secure
location. Losing the upload key can block future updates until Google approves a
key reset. Never commit these files.

## Production configuration

Before publishing, replace the example values in `.env.production` with the real
HTTPS API and WebSocket URLs. If Firebase Cloud Messaging is enabled, download a
new `google-services.json` for `com.neroadawat.ginder` and complete the Firebase
Android setup for this package.

## Build on Windows

React Native's native build can exceed Windows' legacy 260-character path limit.
This repository's Babel configuration supports building through a short junction:

```powershell
New-Item -ItemType Junction -Path C:\g -Target <absolute-repository-path>
Set-Location C:\g\frontend\android
.\gradlew.bat bundleRelease assembleRelease
```

Release artifacts are written to:

- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`

## Versioning

Increase `versionCode` for every Play Console upload. Use an increasing integer;
the current convention starts `1.0.0` at `10000`. Update `versionName` when the
user-facing version changes.

## Install on a real phone

Enable Developer options and USB debugging, connect the phone, accept its RSA
prompt, then run:

```powershell
adb devices -l
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.neroadawat.ginder/.MainActivity
```

Test location permission, nearby restaurants, photos, authentication, session
creation/joining, push notifications, background/foreground transitions, and a
cold start. Repeat on an Android 16 device or API 36 emulator before publishing.
