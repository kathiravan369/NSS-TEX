Add-Type -AssemblyName System.Drawing

# 1. Resolve source logo image
$candidateSources = @(
    "d:\NSS-TEX\design-assets\NSS-TEX-Logo.jpg",
    "d:\NSS-TEX\public\logo.png",
    "d:\NSS-TEX\src\assets\logo.png",
    "d:\NSS-TEX\dist\logo.png"
)

$sourceImage = $null
foreach ($cand in $candidateSources) {
    if (Test-Path $cand) {
        $sourceImage = $cand
        break
    }
}

if (-not $sourceImage) {
    Write-Error "Source logo image not found!"
    exit 1
}

Write-Output "Using source image: $sourceImage"

# Load source image into System.Drawing
$src = [System.Drawing.Image]::FromFile($sourceImage)

# Helper function to resize and save PNG
function Save-ResizedPng {
    param([System.Drawing.Image]$source, [int]$w, [int]$h, [string]$dest)
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($source, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved PNG: $dest ($w x $h)"
}

# 2. Build Multi-Resolution Windows ICO File (16, 24, 32, 48, 64, 128, 256)
function Build-IcoFile {
    param([System.Drawing.Image]$source, [string]$dest)
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $imagesData = @()

    foreach ($s in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($source, 0, 0, $s, $s)
        $g.Dispose()

        $bytes = $null
        if ($s -le 64) {
            # Use uncompressed DIB with BITMAPINFOHEADER for legacy Windows Win32 Shell compatibility
            $w = $bmp.Width
            $h = $bmp.Height
            $ms = New-Object System.IO.MemoryStream
            $bw = New-Object System.IO.BinaryWriter($ms)

            $bw.Write([uint32]40) # biSize
            $bw.Write([int32]$w) # biWidth
            $bw.Write([int32]($h * 2)) # biHeight (doubled for XOR + AND masks)
            $bw.Write([uint16]1) # biPlanes
            $bw.Write([uint16]32) # biBitCount
            $bw.Write([uint32]0) # biCompression
            $bw.Write([uint32]($w * $h * 4)) # biSizeImage
            $bw.Write([int32]0) # biXPelsPerMeter
            $bw.Write([int32]0) # biYPelsPerMeter
            $bw.Write([uint32]0) # biClrUsed
            $bw.Write([uint32]0) # biClrImportant

            for ($y = $h - 1; $y -ge 0; $y--) {
                for ($x = 0; $x -lt $w; $x++) {
                    $pixel = $bmp.GetPixel($x, $y)
                    $bw.Write([byte]$pixel.B)
                    $bw.Write([byte]$pixel.G)
                    $bw.Write([byte]$pixel.R)
                    $bw.Write([byte]$pixel.A)
                }
            }

            $rowBytes = [math]::Ceiling($w / 32.0) * 4
            $andMask = New-Object byte[] ($rowBytes * $h)
            $bw.Write($andMask)

            $bytes = $ms.ToArray()
            $bw.Dispose()
            $ms.Dispose()
        } else {
            # Use PNG for high-res 128 and 256
            $ms = New-Object System.IO.MemoryStream
            $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $bytes = $ms.ToArray()
            $ms.Dispose()
        }
        $bmp.Dispose()

        $imagesData += [PSCustomObject]@{
            Size = $s
            Bytes = $bytes
        }
    }

    $fs = [System.IO.File]::Create($dest)
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([uint16]0) # Reserved
    $bw.Write([uint16]1) # Type: 1 = ICO
    $bw.Write([uint16]$imagesData.Count)

    $offset = 6 + ($imagesData.Count * 16)
    foreach ($img in $imagesData) {
        $w = if ($img.Size -eq 256) { [byte]0 } else { [byte]$img.Size }
        $h = if ($img.Size -eq 256) { [byte]0 } else { [byte]$img.Size }
        $bw.Write($w)
        $bw.Write($h)
        $bw.Write([byte]0) # Color palette count
        $bw.Write([byte]0) # Reserved
        $bw.Write([uint16]1) # Planes
        $bw.Write([uint16]32) # Bit count
        $bw.Write([uint32]$img.Bytes.Length)
        $bw.Write([uint32]$offset)
        $offset += $img.Bytes.Length
    }

    foreach ($img in $imagesData) {
        $bw.Write($img.Bytes)
    }

    $bw.Flush()
    $bw.Dispose()
    $fs.Dispose()
    Write-Output "Saved Multi-Resolution Windows ICO: $dest"
}

# 3. Generate master files in electron/ and public/
$electronDir = "d:\NSS-TEX\electron"
$publicDir = "d:\NSS-TEX\public"
$distDir = "d:\NSS-TEX\dist"
$assetsDir = "d:\NSS-TEX\src\assets"

$masterPng = "$electronDir\logo.png"
$masterIco = "$electronDir\logo.ico"

# Save true 1024x1024 master PNG
Save-ResizedPng -source $src -w 1024 -h 1024 -dest $masterPng

# Generate genuine ICO file
Build-IcoFile -source $src -dest $masterIco

# Generate PWA & Web icons
Save-ResizedPng -source $src -w 512 -h 512 -dest "$publicDir\icon-512x512.png"
Save-ResizedPng -source $src -w 192 -h 192 -dest "$publicDir\icon-192x192.png"
Save-ResizedPng -source $src -w 180 -h 180 -dest "$publicDir\apple-touch-icon.png"
Save-ResizedPng -source $src -w 32 -h 32 -dest "$publicDir\favicon-32x32.png"
Save-ResizedPng -source $src -w 16 -h 16 -dest "$publicDir\favicon-16x16.png"

# Copy logo and favicon to public
Copy-Item -Path $masterPng -Destination "$publicDir\logo.png" -Force
Copy-Item -Path "$publicDir\icon-512x512.png" -Destination "$publicDir\favicon.png" -Force
Copy-Item -Path $masterIco -Destination "$publicDir\favicon.ico" -Force

# Copy logo to src/assets for Vite bundling
Copy-Item -Path $masterPng -Destination "$assetsDir\logo.png" -Force

# Copy all to dist if dist exists
if (Test-Path $distDir) {
    Copy-Item -Path $masterPng -Destination "$distDir\logo.png" -Force
    Copy-Item -Path "$publicDir\icon-512x512.png" -Destination "$distDir\favicon.png" -Force
    Copy-Item -Path $masterIco -Destination "$distDir\favicon.ico" -Force
    Copy-Item -Path "$publicDir\icon-512x512.png" -Destination "$distDir\icon-512x512.png" -Force
    Copy-Item -Path "$publicDir\icon-192x192.png" -Destination "$distDir\icon-192x192.png" -Force
    Copy-Item -Path "$publicDir\apple-touch-icon.png" -Destination "$distDir\apple-touch-icon.png" -Force
    Copy-Item -Path "$publicDir\favicon-32x32.png" -Destination "$distDir\favicon-32x32.png" -Force
    Copy-Item -Path "$publicDir\favicon-16x16.png" -Destination "$distDir\favicon-16x16.png" -Force
}

$src.Dispose()

# 4. Copy to Installed App Directory if it exists
$installedDir = "C:\Users\skeer\AppData\Local\Programs\NSS-TEX ERP"
if (Test-Path $installedDir) {
    Copy-Item -Path $masterIco -Destination "$installedDir\logo.ico" -Force
    Copy-Item -Path $masterPng -Destination "$installedDir\logo.png" -Force
    Write-Output "Copied valid logo.ico to installed directory: $installedDir"
}

# 5. Update Desktop Shortcut with the genuine ICO file
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopPath "NSS-TEX ERP.lnk"
if (Test-Path $desktopShortcutPath) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($desktopShortcutPath)
    $targetIco = if (Test-Path "$installedDir\logo.ico") { "$installedDir\logo.ico" } else { $masterIco }
    $shortcut.IconLocation = "$targetIco, 0"
    $shortcut.Save()
    Write-Output "Updated Desktop shortcut icon location: $targetIco, 0"
}

# 6. Update Start Menu Shortcut
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\NSS-TEX ERP.lnk"
if (Test-Path $startMenuPath) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($startMenuPath)
    $targetIco = if (Test-Path "$installedDir\logo.ico") { "$installedDir\logo.ico" } else { $masterIco }
    $shortcut.IconLocation = "$targetIco, 0"
    $shortcut.Save()
    Write-Output "Updated Start Menu shortcut icon location: $targetIco, 0"
}

# 7. Force Windows Shell to refresh icon cache immediately
try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class ShellRefresh {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
"@ -ErrorAction SilentlyContinue
    [ShellRefresh]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Output "Windows Shell Icon Cache notified of change."
} catch {}

Write-Output "All NSS-TEX ERP application icons configured successfully!"
