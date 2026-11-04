$items = Get-ChildItem -Path 'd:\NSS-TEX\dist-electron\win-unpacked.tmp' -Recurse
foreach ($item in $items) {
    if (-not $item.PSIsContainer) {
        try {
            $s = [System.IO.File]::Open($item.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            $s.Close()
        } catch {
            Write-Output ("Locked file: " + $item.FullName + " - " + $_.Exception.Message)
        }
    }
}
Write-Output "Check completed."

