//! Windows launch-at-login integration.

use crate::errors::Result;

/// Enable or disable launching LucidClip when the current user signs in.
pub fn set_launch_on_startup(enabled: bool) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        windows_startup::set_launch_on_startup(enabled)
    }

    #[cfg(not(target_os = "windows"))]
    {
        if enabled {
            Err(crate::errors::AppError::System(
                "Launch at startup is only available on Windows".into(),
            ))
        } else {
            Ok(())
        }
    }
}

/// Read whether the current executable is registered to launch at login.
pub fn launch_on_startup_enabled() -> Result<bool> {
    #[cfg(target_os = "windows")]
    {
        windows_startup::is_enabled()
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[cfg(target_os = "windows")]
mod windows_startup {
    use std::ptr;

    use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_SUCCESS};
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegGetValueW, RegOpenKeyExW, RegSetValueExW, HKEY,
        HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE, REG_SZ, RRF_RT_REG_SZ,
    };

    use crate::errors::{AppError, Result};

    const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    const VALUE_NAME: &str = "LucidClip";

    struct RegistryKey(HKEY);

    impl Drop for RegistryKey {
        fn drop(&mut self) {
            unsafe {
                RegCloseKey(self.0);
            }
        }
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn open_key(access: u32) -> Result<RegistryKey> {
        let subkey = wide(RUN_KEY);
        let mut key: HKEY = ptr::null_mut();

        let status = unsafe {
            RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, access, &mut key)
        };

        if status != ERROR_SUCCESS {
            return Err(AppError::System(format!(
                "Failed to open the Windows startup registry key (error {status})"
            )));
        }

        Ok(RegistryKey(key))
    }

    pub fn set_launch_on_startup(enabled: bool) -> Result<()> {
        let key = open_key(KEY_SET_VALUE)?;
        let name = wide(VALUE_NAME);

        if enabled {
            let executable = std::env::current_exe()?;
            let command = format!("\"{}\"", executable.display());
            let data = wide(&command);
            let bytes = data.len() * std::mem::size_of::<u16>();

            let status = unsafe {
                RegSetValueExW(
                    key.0,
                    name.as_ptr(),
                    0,
                    REG_SZ,
                    data.as_ptr() as *const u8,
                    bytes as u32,
                )
            };

            if status != ERROR_SUCCESS {
                return Err(AppError::System(format!(
                    "Failed to register launch at startup (error {status})"
                )));
            }
        } else {
            let status = unsafe { RegDeleteValueW(key.0, name.as_ptr()) };
            if status != ERROR_SUCCESS && status != ERROR_FILE_NOT_FOUND {
                return Err(AppError::System(format!(
                    "Failed to remove launch at startup (error {status})"
                )));
            }
        }

        Ok(())
    }

    pub fn is_enabled() -> Result<bool> {
        let key = open_key(KEY_QUERY_VALUE)?;
        let subkey = wide(RUN_KEY);
        let name = wide(VALUE_NAME);
        let mut buffer = [0u16; 2_048];
        let mut size = (buffer.len() * std::mem::size_of::<u16>()) as u32;

        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                name.as_ptr(),
                RRF_RT_REG_SZ,
                ptr::null_mut(),
                buffer.as_mut_ptr() as *mut core::ffi::c_void,
                &mut size,
            )
        };

        drop(key);

        Ok(status == ERROR_SUCCESS)
    }
}
