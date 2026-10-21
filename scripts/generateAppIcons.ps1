Add-Type -AssemblyName System.Drawing

function Get-RoundedRectPath {
    param([System.Drawing.RectangleF]$rect, [float]$radius)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $arc = New-Object System.Drawing.RectangleF($rect.X, $rect.Y, $diameter, $diameter)

    # Top-Left
    $path.AddArc($arc, 180, 90)
    # Top-Right
    $arc.X = $rect.Right - $diameter
    $path.AddArc($arc, 270, 90)
    # Bottom-Right
    $arc.Y = $rect.Bottom - $diameter
    $path.AddArc($arc, 0, 90)
    # Bottom-Left
    $arc.X = $rect.Left
    $path.AddArc($arc, 90, 90)
    $path.CloseFigure()
    return $path
}

function Build-MasterPng {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )
    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $bmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object System.Drawing.RectangleF(40, 58, 944, 924)
    $path = Get-RoundedRectPath $rect 210
    $g.SetClip($path)
    $g.DrawImage($src, 0, 0, 1024, 1024)
    $g.Dispose()
    $path.Dispose()
    $src.Dispose()

    $bmp.Save($DestinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Master PNG generated: $DestinationPath"
}

function Build-IcoFile {
    param(
        [string]$SourcePngPath,
        [string]$DestinationIcoPath
    )
    $src = [System.Drawing.Image]::FromFile($SourcePngPath)
    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $imagesData = @()

    foreach ($s in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($src, 0, 0, $s, $s)
        $g.Dispose()

        $bytes = $null
        if ($s -le 64) {
            # Use DIB for Win32 GDI standard compatibility
            $w = $bmp.Width
            $h = $bmp.Height
            $ms = New-Object System.IO.MemoryStream
            $bw = New-Object System.IO.BinaryWriter($ms)

            $bw.Write([uint32]40)
            $bw.Write([int32]$w)
            $bw.Write([int32]($h * 2))
            $bw.Write([uint16]1)
            $bw.Write([uint16]32)
            $bw.Write([uint32]0)
            $bw.Write([uint32]($w * $h * 4))
            $bw.Write([int32]0)
            $bw.Write([int32]0)
            $bw.Write([uint32]0)
            $bw.Write([uint32]0)

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
            # Use PNG for 128 and 256
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
    $src.Dispose()

    $fs = [System.IO.File]::Create($DestinationIcoPath)
    $bw = New-Object System.IO.BinaryWriter($fs)

    $bw.Write([uint16]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]$imagesData.Count)

    $offset = 6 + ($imagesData.Count * 16)
    foreach ($img in $imagesData) {
        $w = if ($img.Size -eq 256) { [byte]0 } else { [byte]$img.Size }
        $h = if ($img.Size -eq 256) { [byte]0 } else { [byte]$img.Size }
        $bw.Write($w)
        $bw.Write($h)
        $bw.Write([byte]0)
        $bw.Write([byte]0)
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
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
    Write-Output "ICO file generated: $DestinationIcoPath"
}

$uploadedSource = "C:\Users\skeer\.gemini\antigravity-ide\brain\800eb62c-d58d-4a09-aa3c-43193cbeb513\.user_uploaded\media_1792564788215.jpg"
$repoSource = "d:\NSS-TEX\design-assets\NSS-TEX-Logo.jpg"

if (Test-Path $uploadedSource) {
    Copy-Item -Path $uploadedSource -Destination $repoSource -Force
    $sourceImage = $uploadedSource
} elseif (Test-Path $repoSource) {
    $sourceImage = $repoSource
} else {
    Write-Error "Source logo image not found!"
    exit 1
}

$masterPng = "d:\NSS-TEX\electron\logo.png"
$masterIco = "d:\NSS-TEX\electron\logo.ico"

Build-MasterPng -SourcePath $sourceImage -DestinationPath $masterPng
Build-IcoFile -SourcePngPath $masterPng -DestinationIcoPath $masterIco

# Copy to public folder
Copy-Item -Path $masterPng -Destination "d:\NSS-TEX\public\logo.png" -Force
Copy-Item -Path $masterPng -Destination "d:\NSS-TEX\public\favicon.png" -Force
Copy-Item -Path $masterIco -Destination "d:\NSS-TEX\public\favicon.ico" -Force

# Copy to src/assets folder for Vite bundling
Copy-Item -Path $masterPng -Destination "d:\NSS-TEX\src\assets\logo.png" -Force

# Copy to dist if it exists
if (Test-Path "d:\NSS-TEX\dist") {
    Copy-Item -Path $masterPng -Destination "d:\NSS-TEX\dist\logo.png" -Force
    Copy-Item -Path $masterPng -Destination "d:\NSS-TEX\dist\favicon.png" -Force
    Copy-Item -Path $masterIco -Destination "d:\NSS-TEX\dist\favicon.ico" -Force
}

# Copy to Installed App Directory if it exists
$installedDir = "C:\Users\skeer\AppData\Local\Programs\NSS-TEX ERP"
if (Test-Path $installedDir) {
    Copy-Item -Path $masterIco -Destination "$installedDir\logo.ico" -Force
    Copy-Item -Path $masterPng -Destination "$installedDir\logo.png" -Force
    Write-Output "Copied logo.ico and logo.png to $installedDir"
}

# Update Desktop Shortcut
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$desktopShortcutPath = Join-Path $desktopPath "NSS-TEX ERP.lnk"
if (Test-Path $desktopShortcutPath) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($desktopShortcutPath)
    $targetIco = if (Test-Path "$installedDir\logo.ico") { "$installedDir\logo.ico" } else { $masterIco }
    $shortcut.IconLocation = "$targetIco, 0"
    $shortcut.Save()
    Write-Output "Updated Desktop shortcut icon location to: $targetIco, 0"
}

# Update Start Menu Shortcut
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\NSS-TEX ERP.lnk"
if (Test-Path $startMenuPath) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($startMenuPath)
    $targetIco = if (Test-Path "$installedDir\logo.ico") { "$installedDir\logo.ico" } else { $masterIco }
    $shortcut.IconLocation = "$targetIco, 0"
    $shortcut.Save()
    Write-Output "Updated Start Menu shortcut icon location to: $targetIco, 0"
}

# Force Windows Shell to refresh icon cache immediately
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellRefresh {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
[ShellRefresh]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output "Windows Shell Icon Cache notified of change."
