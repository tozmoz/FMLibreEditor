//! `fmlibre-launch`: how Steam starts Football Manager on macOS with the bridge.
//!
//! Steam on macOS runs no shell for a launch option: it starts the option's first word as a
//! program, with `%command%`, the game's app bundle, among its arguments. So FM27's launch
//! option is `"…/fmlibre-launch" %command%`. This program puts the bridge beside it in front
//! of the libraries named in `DYLD_INSERT_LIBRARIES`, keeping those Steam names, and then
//! becomes the game, so that Steam goes on following the process it started. When the bridge
//! is not beside it, the game starts as it is.

#[cfg(not(target_os = "macos"))]
fn main() {}

#[cfg(target_os = "macos")]
fn main() -> std::process::ExitCode {
    use std::os::unix::process::CommandExt;
    use std::path::Path;
    use std::process::{Command, ExitCode};

    let mut args = std::env::args_os().skip(1);
    let Some(program) = args.next() else {
        eprintln!("usage: fmlibre-launch <app or program> [arguments]");
        return ExitCode::FAILURE;
    };
    let program = mac::executable(Path::new(&program));
    let mut command = Command::new(&program);
    command.args(args);
    if let Some(libraries) = mac::libraries() {
        command.env(mac::INSERT, libraries);
    }
    // Only returns when the game could not be started.
    let err = command.exec();
    eprintln!("fmlibre-launch: could not start {}: {err}", program.display());
    ExitCode::FAILURE
}

#[cfg(target_os = "macos")]
mod mac {
    use std::ffi::OsString;
    use std::path::{Path, PathBuf};

    pub const INSERT: &str = "DYLD_INSERT_LIBRARIES";

    const BRIDGE_FILE: &str = "libfmlibre_bridge.dylib";

    /// The bridge beside this program first, then the libraries the environment names already.
    pub fn libraries() -> Option<OsString> {
        let bridge = std::env::current_exe().ok()?.parent()?.join(BRIDGE_FILE);
        if !bridge.is_file() {
            return None;
        }
        let mut libraries = bridge.into_os_string();
        if let Some(others) = std::env::var_os(INSERT).filter(|others| !others.is_empty()) {
            libraries.push(":");
            libraries.push(others);
        }
        Some(libraries)
    }

    /// The executable of an app bundle; any other path as it is.
    pub fn executable(path: &Path) -> PathBuf {
        if path.extension().is_some_and(|extension| extension == "app")
            && let Some(name) = bundle_executable(path)
        {
            return path.join("Contents/MacOS").join(name);
        }
        path.to_owned()
    }

    /// The `CFBundleExecutable` of `app`'s Info.plist, or the only file in `Contents/MacOS`.
    fn bundle_executable(app: &Path) -> Option<OsString> {
        let named = std::fs::read_to_string(app.join("Contents/Info.plist")).ok().and_then(|text| {
            let after = &text[text.find("<key>CFBundleExecutable</key>")?..];
            let start = after.find("<string>")? + "<string>".len();
            let end = start + after[start..].find("</string>")?;
            Some(OsString::from(after[start..end].trim()))
        });
        named.or_else(|| {
            let mut files = std::fs::read_dir(app.join("Contents/MacOS")).ok()?.flatten();
            let only = files.next()?;
            files.next().is_none().then(|| only.file_name())
        })
    }
}
