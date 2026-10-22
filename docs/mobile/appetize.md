# Ginder development preview

Run the commands below from the repository root unless a step says otherwise.

Ginder has three separate Android build modes:

| Mode | Purpose | JavaScript source | Backend configuration |
| --- | --- | --- | --- |
| `debug` | Android Studio, emulator, or physical device | Metro development server | `frontend/.env` |
| `appetize` | Browser preview on Appetize.io | Bundled inside the APK | `frontend/.env.appetize` |
| `release` | Play Store production build | Bundled inside the AAB/APK | `frontend/.env.production` |

The Appetize build uses the repository debug signing key and the application ID
`com.tamsoot.ginder.appetize`. It is only a preview artifact and cannot replace a
properly signed production build.

## Prerequisites

- Node.js 22.13 or newer
- JDK 17
- Android SDK installed
- Docker Desktop for the local backend
- An Appetize.io account
- A public HTTPS tunnel such as ngrok, or a deployed staging backend

Install frontend dependencies once:

```powershell
cd frontend
npm install
```

## Run with Android Studio or a local Android emulator

1. Start PostgreSQL, Redis, the API, and background workers from the repository
   root:

   ```powershell
   docker compose up -d
   ```

2. Make sure `frontend/.env` points at the host from the Android emulator:

   ```env
   API_BASE_URL=http://10.0.2.2:8000/api/v1
   WS_BASE_URL=ws://10.0.2.2:8000/ws
   DEEP_LINK_PREFIX=ginder://
   FCM_ENABLED=false
   ```

3. On Windows, map the frontend folder to a short temporary drive. Run this
   from `frontend` and keep the mapping until Android Studio is closed:

   ```powershell
   cd frontend
   subst G: "$((Get-Location).Path)"
   ```

   This repository's native React Native dependencies otherwise exceed
   Windows' 260-character filename limit at its current location.

4. In Android Studio select **Open**, then open `G:\android`. Start an Android
   virtual device and run the `app` configuration. You can use Android Studio
   normally for builds and debugging.

5. Start Metro in a terminal from the original frontend directory:

   ```powershell
   cd frontend
   npm start
   ```

6. Alternatively, install and open the debug app from a second terminal:

   ```powershell
   cd G:\
   npm run android
   ```

   Metro listens on `127.0.0.1` only. Connect each running emulator/device to
   Metro from another terminal (replace the serials with `adb devices` output):

   ```powershell
   adb -s emulator-5554 reverse tcp:8081 tcp:8081
   adb -s emulator-5556 reverse tcp:8081 tcp:8081
   ```

   Repeat the port forwarding after restarting a device. A second emulator
   uses the same project and Metro server; no second source checkout is needed.

7. Set a location around Thammasat Rangsit if needed:

   ```powershell
   adb emu geo fix 100.6065 14.0708
   ```

8. After closing Android Studio, remove the temporary mapping:

   ```powershell
   subst G: /D
   ```

The debug build keeps Metro Fast Refresh and is unaffected by the Appetize
configuration.

## Run on Appetize.io

An Appetize cloud device cannot connect to `localhost` or `10.0.2.2` on the
developer computer. The local API must first be exposed through HTTPS.

1. Start the backend from the repository root:

   ```powershell
   docker compose up -d
   ```

2. Expose port 8000 with a public HTTPS tunnel. For example, after installing
   ngrok:

   ```powershell
   ngrok http 8000
   ```

3. Copy the Appetize environment template:

   ```powershell
   cd frontend
   Copy-Item .env.appetize.example .env.appetize
   ```

4. Edit `frontend/.env.appetize`. If the tunnel URL is
   `https://example.ngrok-free.app`, use:

   ```env
   API_BASE_URL=https://example.ngrok-free.app/api/v1
   WS_BASE_URL=wss://example.ngrok-free.app/ws
   DEEP_LINK_PREFIX=ginder://
   FCM_ENABLED=false
   PRIVACY_POLICY_URL=https://example.ngrok-free.app/privacy
   TERMS_OF_SERVICE_URL=https://example.ngrok-free.app/terms
   ```

5. Verify the tunnel before building:

   ```powershell
   Invoke-RestMethod https://example.ngrok-free.app/health/ready
   ```

   It should return a ready status. Keep both Docker and the tunnel process
   running while using Appetize.

6. Build the self-contained preview APK:

   ```powershell
   cd frontend
   npm run android:appetize
   ```

   On Windows the script temporarily maps the frontend directory to an unused
   drive letter. This avoids the native compiler's 260-character path limit;
   the mapping is removed automatically when the build finishes.

7. Open `https://appetize.io/upload` and upload this file:

   ```text
   frontend/android/app/build/outputs/apk/appetize/app-appetize.apk
   ```

8. Open the generated Appetize link and grant location permission. To start
   near Thammasat Rangsit, append this query parameter to the link (use `&`
   instead of `?` if the link already has query parameters):

   ```text
   ?location=14.0708,100.6065
   ```

9. After changing application code, run `npm run android:appetize` again and
   upload the new APK build. Metro/Fast Refresh is intentionally not used by
   this variant.

## Troubleshooting

- `Missing frontend/.env.appetize`: copy the example file as described above.
- API requests fail: verify `/health/ready` through the public URL and confirm
  the tunnel is still running.
- Real-time lobby updates fail: confirm `WS_BASE_URL` uses `wss://` and ends in
  `/ws`.
- No restaurants appear: set the Appetize mock location near Thammasat Rangsit.
- A new tunnel URL was assigned: update `.env.appetize`, rebuild, and upload a
  new APK because environment values are compiled into the app.
- The temporary-drive step fails: disconnect an unused mapped drive or move the
  repository closer to the drive root, then retry.
