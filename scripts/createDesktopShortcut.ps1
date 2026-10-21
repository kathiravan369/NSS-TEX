$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath "NSS-TEX ERP.lnk"
$TargetPath = "d:\NSS-TEX\Start NSS-TEX.bat"
$IconPath = "d:\NSS-TEX\electron\logo.ico"
$WorkingDir = "d:\NSS-TEX"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$installedExe = "C:\Users\skeer\AppData\Local\Programs\NSS-TEX ERP\NSS-TEX ERP.exe"
$installedIco = "C:\Users\skeer\AppData\Local\Programs\NSS-TEX ERP\logo.ico"

if (Test-Path $installedExe) {
    $Shortcut.TargetPath = $installedExe
    $Shortcut.WorkingDirectory = "C:\Users\skeer\AppData\Local\Programs\NSS-TEX ERP"
    if (Test-Path $installedIco) {
        $Shortcut.IconLocation = "$installedIco, 0"
    } elseif (Test-Path $IconPath) {
        $Shortcut.IconLocation = "$IconPath, 0"
    }
} else {
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.WorkingDirectory = $WorkingDir
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = "$IconPath, 0"
    }
}

$Shortcut.Save()

# Notify Windows Explorer Shell to refresh icon cache immediately
try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class ShortcutShellRefresh {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
"@ -ErrorAction SilentlyContinue
    [ShortcutShellRefresh]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Output "✅ Desktop shortcut created successfully at: $ShortcutPath"
