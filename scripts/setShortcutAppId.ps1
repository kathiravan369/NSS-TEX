Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("886D8EEB-8CF2-4446-8D02-C33D3059F14D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IPropertyStore
{
    int GetCount(out uint cProps);
    int GetAt(uint iProp, out PROPERTYKEY pkey);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
    int Commit();
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct PROPERTYKEY
{
    public Guid fmtid;
    public uint pid;
}

[StructLayout(LayoutKind.Explicit)]
public struct PROPVARIANT
{
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(8)] public IntPtr pwszVal;
}

public class WinPropertyStore
{
    [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int SHGetPropertyStoreFromParsingName(
        string pszPath,
        IntPtr pbc,
        uint flags,
        ref Guid riid,
        out IPropertyStore ppv
    );

    public static readonly PROPERTYKEY AppUserModelIDKey = new PROPERTYKEY
    {
        fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
        pid = 5
    };

    private static readonly Guid IID_IPropertyStore = new Guid("886D8EEB-8CF2-4446-8D02-C33D3059F14D");

    public static string GetAppId(string path)
    {
        try {
            IPropertyStore store;
            Guid iid = IID_IPropertyStore;
            int hr = SHGetPropertyStoreFromParsingName(path, IntPtr.Zero, 0, ref iid, out store);
            if (hr != 0 || store == null) return null;

            PROPERTYKEY key = AppUserModelIDKey;
            PROPVARIANT pv;
            store.GetValue(ref key, out pv);
            if (pv.vt == 31 && pv.pwszVal != IntPtr.Zero)
            {
                return Marshal.PtrToStringUni(pv.pwszVal);
            }
        } catch (Exception ex) {
            Console.WriteLine("GetAppId error: " + ex.Message);
        }
        return null;
    }

    public static bool SetAppId(string path, string appId)
    {
        try {
            IPropertyStore store;
            Guid iid = IID_IPropertyStore;
            // GPS_READWRITE = 2
            int hr = SHGetPropertyStoreFromParsingName(path, IntPtr.Zero, 2, ref iid, out store);
            if (hr != 0 || store == null) {
                Console.WriteLine("SHGetPropertyStoreFromParsingName failed with hr: 0x" + hr.ToString("X"));
                return false;
            }

            PROPERTYKEY key = AppUserModelIDKey;
            PROPVARIANT pv = new PROPVARIANT();
            pv.vt = 31; // VT_LPWSTR
            pv.pwszVal = Marshal.StringToCoTaskMemUni(appId);

            hr = store.SetValue(ref key, ref pv);
            if (hr != 0) {
                Console.WriteLine("SetValue failed with hr: 0x" + hr.ToString("X"));
                return false;
            }

            hr = store.Commit();
            if (hr != 0) {
                Console.WriteLine("Commit failed with hr: 0x" + hr.ToString("X"));
                return false;
            }
            return true;
        } catch (Exception ex) {
            Console.WriteLine("SetAppId exception: " + ex.Message);
            return false;
        }
    }
}
"@

$appId = "com.nsstowels.erp"
$desktopLnk = "C:\Users\skeer\Desktop\NSS-TEX ERP.lnk"
$startMenuLnk = "C:\Users\skeer\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\NSS-TEX ERP.lnk"

Write-Output "--- Current AppUserModelIDs ---"
if (Test-Path $desktopLnk) {
    Write-Output ("Desktop Lnk AppId: " + [WinPropertyStore]::GetAppId($desktopLnk))
}
if (Test-Path $startMenuLnk) {
    Write-Output ("Start Menu Lnk AppId: " + [WinPropertyStore]::GetAppId($startMenuLnk))
}

Write-Output "--- Setting AppUserModelID to '$appId' ---"
if (Test-Path $desktopLnk) {
    $ok1 = [WinPropertyStore]::SetAppId($desktopLnk, $appId)
    Write-Output ("Desktop Lnk Set Result: " + $ok1)
}
if (Test-Path $startMenuLnk) {
    $ok2 = [WinPropertyStore]::SetAppId($startMenuLnk, $appId)
    Write-Output ("Start Menu Lnk Set Result: " + $ok2)
}

Write-Output "--- Verification ---"
if (Test-Path $desktopLnk) {
    Write-Output ("Desktop Lnk AppId: " + [WinPropertyStore]::GetAppId($desktopLnk))
}
if (Test-Path $startMenuLnk) {
    Write-Output ("Start Menu Lnk AppId: " + [WinPropertyStore]::GetAppId($startMenuLnk))
}
