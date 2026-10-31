# Rebuild Android launcher assets from the approved logo without redrawing it.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$frontendRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $frontendRoot 'android/branding/launcher-source.png'
$resRoot = Join-Path $frontendRoot 'android/app/src/main/res'
$source = [System.Drawing.Bitmap]::new($sourcePath)
$background = $source.GetPixel(0, 0)

function Write-Icon([string]$Path, [int]$Size, [double]$Scale = 1, [bool]$Round = $false, [bool]$Foreground = $false) {
    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $brush = [System.Drawing.SolidBrush]::new($background)
    $clip = $null
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($Round) {
            $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $clip.AddEllipse(0, 0, $Size, $Size)
            $graphics.SetClip($clip)
        }
        if (!$Foreground) { $graphics.FillRectangle($brush, 0, 0, $Size, $Size) }
        $ratio = $Size * $Scale / [Math]::Max($source.Width, $source.Height)
        $width = [single]($source.Width * $ratio)
        $height = [single]($source.Height * $ratio)
        $rect = [System.Drawing.Rectangle]::new([int][Math]::Round(($Size - $width) / 2), [int][Math]::Round(($Size - $height) / 2), [int][Math]::Round($width), [int][Math]::Round($height))
        # TileFlipXY avoids dark interpolation seams at the source edges.
        $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
        try {
            $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
            $graphics.DrawImage($source, $rect, 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
        } finally { $attributes.Dispose() }
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        if ($clip) { $clip.Dispose() }
        $brush.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    $densities = @(
        @{ Name = 'mdpi'; Size = 48; Foreground = 108 },
        @{ Name = 'hdpi'; Size = 72; Foreground = 162 },
        @{ Name = 'xhdpi'; Size = 96; Foreground = 216 },
        @{ Name = 'xxhdpi'; Size = 144; Foreground = 324 },
        @{ Name = 'xxxhdpi'; Size = 192; Foreground = 432 }
    )
    foreach ($density in $densities) {
        $dir = Join-Path $resRoot "mipmap-$($density.Name)"
        Write-Icon (Join-Path $dir 'ic_launcher.png') $density.Size
        Write-Icon (Join-Path $dir 'ic_launcher_round.png') $density.Size 1 $true
        # Android masks the middle 72dp of a 108dp layer. Keep the wordmark
        # within the central safe area, including circular launcher masks.
        Write-Icon (Join-Path $dir 'ic_launcher_foreground.png') $density.Foreground (2.0 / 3.0) $false $true
    }
    Write-Icon (Join-Path $frontendRoot 'android/play-store-assets/icon-512.png') 512
    $hex = '#{0:X2}{1:X2}{2:X2}' -f $background.R, $background.G, $background.B
    $xml = "<resources>`n    <color name=`"ic_launcher_background`">$hex</color>`n</resources>`n"
    [System.IO.File]::WriteAllText((Join-Path $resRoot 'values/ic_launcher_background.xml'), $xml)
    Write-Output 'Created 15 launcher images and the 512px store icon.'
} finally { $source.Dispose() }
