$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "NSS-TEX ERP.lnk"
$TargetPath = "d:\NSS-TEX\Start NSS-TEX.bat"
$IconPath = "d:\NSS-TEX\electron\logo.ico"
$WorkingDir = "d:\NSS-TEX"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.WindowStyle = 1
$Shortcut.Description = "NSS-TEX ERP Manufacturing Management Desktop Application"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath, 0"
}
$Shortcut.Save()

Write-Output "✅ Desktop shortcut created successfully at: $ShortcutPath"
