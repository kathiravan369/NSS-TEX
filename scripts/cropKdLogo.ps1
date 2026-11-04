Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\skeer\.gemini\antigravity\brain\258439cd-2442-4832-9dd8-4ee39d4adf2b\.user_uploaded\media_1793775517243_06c821af.png"
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Scan region x: 580..720, y: 150..270 to find the logo container
# The logo container is a rounded light box
$minX = 1000; $maxX = 0; $minY = 1000; $maxY = 0

for ($y = 150; $y -le 270; $y++) {
    for ($x = 580; $x -le 720; $x++) {
        $c = $src.GetPixel($x, $y)
        # Gold/yellow logo pixels or container border
        if (($c.R -gt 150 -and $c.G -gt 120 -and $c.B -lt 120) -or ($c.R -lt 245 -and $c.G -lt 245 -and $c.B -lt 245)) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Bounds: X=[$minX, $maxX], Y=[$minY, $maxY]"
$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
Write-Output "Width: $w, Height: $h"

# Crop the logo box
$rect = New-Object System.Drawing.Rectangle($minX, $minY, $w, $h)
$crop = $src.Clone($rect, $src.PixelFormat)

$out1 = "d:\NSS-TEX\public\kd-logo.png"
$out2 = "d:\NSS-TEX\src\assets\kd-logo.png"
$crop.Save($out1, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Save($out2, [System.Drawing.Imaging.ImageFormat]::Png)

$crop.Dispose()
$src.Dispose()
Write-Output "Saved KD logo to $out1 and $out2"

