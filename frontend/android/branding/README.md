# Launcher icon

`launcher-source.png` is the approved white GINDER wordmark on red, supplied
by the owner. The original is 218 x 201 pixels; resizing preserves its aspect
ratio and does not add detail.

From the repository root, regenerate the Android launcher images and the
512px Play Store upload image with:

```powershell
& .\frontend\scripts\build-launcher-icons.ps1
```

The generator produces legacy, circular, and adaptive foreground images at all
five Android densities. Adaptive XML resources use the matching red background;
the wordmark stays inside the central safe area for circular masks.

`../play-store-assets/icon-512.png` is the matching store listing asset. Updating
the installed app's icon requires a new Android build. The older SVG and concept
image in this directory are historical designs and are not launcher inputs.
