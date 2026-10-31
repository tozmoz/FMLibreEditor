//! Setting the game up on macOS so the editor can reach it: the bridge library goes to a fixed
//! place, and a Steam launch option has the game load it (see `fmlibre_mem::bridge`).
//!
//! The launch option lives in each Steam account's `localconfig.vdf`, which Steam reads when
//! it starts and writes back when it quits, so it is only changed while Steam is not running.
//! A launch option the player already has stays: the bridge is added in front of it, and next
//! to any library another tool has the game load.

use std::fmt;
use std::path::{Path, PathBuf};

use fmlibre_mem::find_processes;

/// Steam's app id of Football Manager 27.
pub const STEAM_APP_ID: u32 = 4_530_370;

/// File name of the bridge library.
pub const BRIDGE_FILE: &str = "libfmlibre_bridge.dylib";

/// The process of the Steam client on macOS.
const STEAM_EXE: &str = "steam_osx";

/// The variable that names the libraries the game loads at start.
const INSERT: &str = "DYLD_INSERT_LIBRARIES=";

/// Where things are, from the user's home folder.
#[derive(Debug, Clone)]
pub struct Places {
    /// Where the bridge is installed: outside the app, which macOS may run from a temporary
    /// copy and which updates replace.
    pub bridge: PathBuf,
    /// Steam's folder of user data, with a folder per account.
    pub steam_users: PathBuf,
}

impl Places {
    pub fn of(home: &Path) -> Self {
        let support = home.join("Library/Application Support");
        Self { bridge: support.join("FMLibreEditor").join(BRIDGE_FILE), steam_users: support.join("Steam/userdata") }
    }
}

/// How far the bridge is set up.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BridgeStatus {
    /// Whether the bridge library is in place.
    pub installed: bool,
    /// The launch option that loads the bridge.
    pub launch_option: String,
    /// Each Steam account on this Mac, and whether FM27 loads the bridge when it starts the game.
    pub accounts: Vec<Account>,
    pub steam_running: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Account {
    /// The account's `localconfig.vdf`.
    pub config: PathBuf,
    /// FM27's launch options, as Steam has them.
    pub launch_options: Option<String>,
    pub loads_bridge: bool,
}

impl BridgeStatus {
    /// Whether starting the game from Steam loads the bridge, for some account.
    pub fn ready(&self) -> bool {
        self.installed && self.accounts.iter().any(|account| account.loads_bridge)
    }
}

#[derive(Debug)]
pub enum SetupError {
    /// Steam keeps the launch options while it runs and writes them back when it quits.
    SteamRunning,
    /// No Steam account on this Mac has a `localconfig.vdf`.
    NoSteamAccount,
    /// The bridge library to install is missing from the app.
    NoLibrary(PathBuf),
    /// A `localconfig.vdf` is not in the shape the editor knows; it was left alone.
    UnknownConfig(PathBuf),
    Io(PathBuf, std::io::Error),
}

impl fmt::Display for SetupError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SetupError::SteamRunning => {
                write!(
                    f,
                    "Steam is running and keeps FM27's launch options while it does, so they were left alone; quit Steam and try again"
                )
            }
            SetupError::NoSteamAccount => write!(f, "found no Steam account on this Mac; start Steam and sign in once"),
            SetupError::NoLibrary(path) => write!(f, "the bridge library is missing: {}", path.display()),
            SetupError::UnknownConfig(path) => {
                write!(f, "{} is not in a shape FMLibreEditor knows, so it was left alone", path.display())
            }
            SetupError::Io(path, err) => write!(f, "{}: {err}", path.display()),
        }
    }
}

impl std::error::Error for SetupError {}

impl crate::Coded for SetupError {
    fn code(&self) -> &'static str {
        match self {
            SetupError::SteamRunning => "setup.steamRunning",
            SetupError::NoSteamAccount => "setup.noSteamAccount",
            SetupError::NoLibrary(_) => "setup.noLibrary",
            SetupError::UnknownConfig(_) => "setup.unknownConfig",
            SetupError::Io(..) => "setup.io",
        }
    }

    fn params(&self) -> Vec<(&'static str, String)> {
        match self {
            SetupError::NoLibrary(path) | SetupError::UnknownConfig(path) => {
                vec![("path", path.display().to_string())]
            }
            SetupError::Io(path, err) => vec![("path", path.display().to_string()), ("error", err.to_string())],
            _ => Vec::new(),
        }
    }
}

/// The launch option that has the game load the bridge at `bridge`.
pub fn launch_option(bridge: &Path) -> String {
    format!("{INSERT}{} %command%", quoted(bridge))
}

/// Whether the Steam client is running.
pub fn steam_running() -> bool {
    find_processes(STEAM_EXE).is_ok_and(|found| !found.is_empty())
}

/// What is set up, read from the files; changes nothing.
pub fn status(places: &Places) -> BridgeStatus {
    let accounts = configs(&places.steam_users)
        .into_iter()
        .map(|config| {
            let launch_options =
                std::fs::read_to_string(&config).ok().and_then(|text| Vdf::parse(&text)?.launch_options(STEAM_APP_ID));
            let loads_bridge = launch_options.as_deref().is_some_and(|options| loads(options, &places.bridge));
            Account { config, launch_options, loads_bridge }
        })
        .collect();
    BridgeStatus {
        installed: places.bridge.is_file(),
        launch_option: launch_option(&places.bridge),
        accounts,
        steam_running: steam_running(),
    }
}

/// Installs the bridge `library` and adds it to FM27's launch options for every Steam account.
/// While Steam runs, only the library is installed, for a launch option set in Steam by hand.
pub fn set_up(places: &Places, library: &Path) -> Result<BridgeStatus, SetupError> {
    let bytes = std::fs::read(library).map_err(|_| SetupError::NoLibrary(library.to_owned()))?;
    // A new file in place of the old: a game still running keeps the library it loaded.
    write_new(&places.bridge, &bytes)?;

    if steam_running() {
        return Err(SetupError::SteamRunning);
    }
    let configs = configs(&places.steam_users);
    if configs.is_empty() {
        return Err(SetupError::NoSteamAccount);
    }
    for config in configs {
        let text = std::fs::read_to_string(&config).map_err(|err| SetupError::Io(config.clone(), err))?;
        let vdf = Vdf::parse(&text).ok_or_else(|| SetupError::UnknownConfig(config.clone()))?;
        let current = vdf.launch_options(STEAM_APP_ID);
        let wanted = with_bridge(current.as_deref(), &places.bridge);
        if current.as_deref() == Some(wanted.as_str()) {
            continue;
        }
        let changed = vdf
            .set_launch_options(STEAM_APP_ID, Some(&wanted))
            .ok_or_else(|| SetupError::UnknownConfig(config.clone()))?;
        keep_backup(&config)?;
        write_new(&config, changed.as_bytes())?;
    }
    Ok(status(places))
}

/// Takes the bridge out of FM27's launch options, and removes the library once no launch
/// option names it: the game does not start when a library it is told to load is missing.
pub fn remove(places: &Places) -> Result<BridgeStatus, SetupError> {
    if steam_running() {
        return Err(SetupError::SteamRunning);
    }
    for config in configs(&places.steam_users) {
        let text = std::fs::read_to_string(&config).map_err(|err| SetupError::Io(config.clone(), err))?;
        let Some(vdf) = Vdf::parse(&text) else {
            continue;
        };
        let Some(current) = vdf.launch_options(STEAM_APP_ID) else {
            continue;
        };
        let rest = without_bridge(&current, &places.bridge);
        if rest == current {
            continue;
        }
        let rest = (!rest.is_empty() && rest != "%command%").then_some(rest);
        let changed = vdf
            .set_launch_options(STEAM_APP_ID, rest.as_deref())
            .ok_or_else(|| SetupError::UnknownConfig(config.clone()))?;
        keep_backup(&config)?;
        write_new(&config, changed.as_bytes())?;
    }
    if status(places).accounts.iter().any(|account| account.loads_bridge) {
        return Ok(status(places));
    }
    match std::fs::remove_file(&places.bridge) {
        Ok(()) => {}
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
        Err(err) => return Err(SetupError::Io(places.bridge.clone(), err)),
    }
    Ok(status(places))
}

/// The `localconfig.vdf` of every Steam account.
fn configs(steam_users: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(steam_users) else {
        return Vec::new();
    };
    let mut found: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path().join("config").join("localconfig.vdf"))
        .filter(|path| path.is_file())
        .collect();
    found.sort();
    found
}

/// Writes `bytes` to a new file that then takes the place of `path`.
fn write_new(path: &Path, bytes: &[u8]) -> Result<(), SetupError> {
    let io = |err| SetupError::Io(path.to_owned(), err);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(io)?;
    }
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".fmlibre-new");
    let temporary = PathBuf::from(temporary);
    std::fs::write(&temporary, bytes).map_err(io)?;
    std::fs::rename(&temporary, path).map_err(io)
}

/// Copies `config` aside once, before the editor first changes it.
fn keep_backup(config: &Path) -> Result<(), SetupError> {
    let mut backup = config.as_os_str().to_owned();
    backup.push(".fmlibre-backup");
    let backup = PathBuf::from(backup);
    if !backup.exists() {
        std::fs::copy(config, &backup).map_err(|err| SetupError::Io(backup, err))?;
    }
    Ok(())
}

/// `path` in double quotes, for the shell Steam runs the launch options in.
fn quoted(path: &Path) -> String {
    let text =
        path.to_string_lossy().replace('\\', "\\\\").replace('"', "\\\"").replace('$', "\\$").replace('`', "\\`");
    format!("\"{text}\"")
}

/// Whether the launch options `options` load the bridge at `bridge`.
fn loads(options: &str, bridge: &Path) -> bool {
    options.contains(INSERT) && options.contains(&quoted(bridge))
}

/// The launch options `current` with the bridge at `bridge` added.
fn with_bridge(current: Option<&str>, bridge: &Path) -> String {
    let current = current.unwrap_or("").trim();
    if loads(current, bridge) {
        return current.to_owned();
    }
    let path = quoted(bridge);
    if let Some(at) = current.find(INSERT) {
        // Another tool's library: the shell joins `"ours":theirs` into one list.
        let at = at + INSERT.len();
        return format!("{}{path}:{}", &current[..at], &current[at..]);
    }
    let rest = match current {
        "" => "%command%".to_owned(),
        options if options.contains("%command%") => options.to_owned(),
        // Options without %command% are arguments, which Steam adds after the game.
        options => format!("%command% {options}"),
    };
    format!("{INSERT}{path} {rest}")
}

/// The launch options `current` without the bridge at `bridge`.
fn without_bridge(current: &str, bridge: &Path) -> String {
    let path = quoted(bridge);
    let alone = format!("{INSERT}{path} ");
    let listed = format!("{path}:");
    current.replacen(&alone, "", 1).replacen(&listed, "", 1).trim().to_owned()
}

/// A Steam KeyValues text, with the places of its keys and values, so that it can be changed
/// in place and the rest kept byte for byte.
struct Vdf<'a> {
    text: &'a str,
    root: Vec<Node>,
}

enum Node {
    /// A key and its text, and where the key starts and the text ends, quotes included.
    Value { key: String, value: String, start: usize, value_end: usize },
    /// A key and its entries, and where its opening brace is.
    Block { key: String, open: usize, children: Vec<Node> },
}

const APPS_PATH: [&str; 5] = ["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"];

impl<'a> Vdf<'a> {
    /// `None` when `text` is not plain KeyValues: quoted keys and values, and braces.
    fn parse(text: &'a str) -> Option<Self> {
        let mut tokens = Tokens { text, at: 0 };
        let root = Self::nodes(&mut tokens, true)?;
        Some(Self { text, root })
    }

    fn nodes(tokens: &mut Tokens, top: bool) -> Option<Vec<Node>> {
        let mut nodes = Vec::new();
        loop {
            match tokens.next()? {
                Token::End if top => return Some(nodes),
                Token::Close if !top => return Some(nodes),
                Token::Text { text: key, start, .. } => match tokens.next()? {
                    Token::Text { text: value, end, .. } => {
                        nodes.push(Node::Value { key, value, start, value_end: end });
                    }
                    Token::Open { at } => {
                        let children = Self::nodes(tokens, false)?;
                        nodes.push(Node::Block { key, open: at, children });
                    }
                    _ => return None,
                },
                _ => return None,
            }
        }
    }

    /// The entries of the block at `path`, keys compared as Steam does, ignoring case.
    fn block(&self, path: &[&str]) -> Option<&[Node]> {
        let mut nodes = self.root.as_slice();
        for name in path {
            nodes = nodes.iter().find_map(|node| match node {
                Node::Block { key, children, .. } if key.eq_ignore_ascii_case(name) => Some(children.as_slice()),
                _ => None,
            })?;
        }
        Some(nodes)
    }

    fn launch_options(&self, app: u32) -> Option<String> {
        let mut path = APPS_PATH.to_vec();
        let app = app.to_string();
        path.push(&app);
        self.block(&path)?.iter().find_map(|node| match node {
            Node::Value { key, value, .. } if key.eq_ignore_ascii_case("LaunchOptions") => Some(value.clone()),
            _ => None,
        })
    }

    /// The text with app `app`'s launch options set to `options`, or taken out for `None`.
    fn set_launch_options(&self, app: u32, options: Option<&str>) -> Option<String> {
        let app = app.to_string();
        let apps = self.block(&APPS_PATH)?;
        // Each level is a tab further in: the apps' blocks are as deep as the path is long.
        let depth = APPS_PATH.len();
        let block = apps.iter().find_map(|node| match node {
            Node::Block { key, open, children } if *key == app => Some((*open, children)),
            _ => None,
        });
        let Some((open, children)) = block else {
            let Some(options) = options else {
                return Some(self.text.to_owned());
            };
            // The app has no settings yet: open a block for it at the top of the apps.
            let open = self.open_of(&APPS_PATH)?;
            let (outer, inner) = ("\t".repeat(depth), "\t".repeat(depth + 1));
            let block = format!(
                "\n{outer}\"{app}\"\n{outer}{{\n{inner}\"LaunchOptions\"\t\t\"{}\"\n{outer}}}",
                escape(options)
            );
            return Some(self.insert(open + 1, &block));
        };
        let existing = children.iter().find_map(|node| match node {
            Node::Value { key, start, value_end, .. } if key.eq_ignore_ascii_case("LaunchOptions") => {
                Some((*start, *value_end))
            }
            _ => None,
        });
        match (existing, options) {
            (Some((start, end)), Some(options)) => {
                let line = format!("\"LaunchOptions\"\t\t\"{}\"", escape(options));
                Some(format!("{}{line}{}", &self.text[..start], &self.text[end..]))
            }
            (Some((start, end)), None) => {
                // Takes the line out with the line break and indent before it.
                let line_start = self.text[..start].trim_end_matches(['\t', ' ']).trim_end_matches(['\n', '\r']).len();
                Some(format!("{}{}", &self.text[..line_start], &self.text[end..]))
            }
            (None, Some(options)) => {
                let indent = "\t".repeat(depth + 1);
                Some(self.insert(open + 1, &format!("\n{indent}\"LaunchOptions\"\t\t\"{}\"", escape(options))))
            }
            (None, None) => Some(self.text.to_owned()),
        }
    }

    /// Where the opening brace of the block at `path` is.
    fn open_of(&self, path: &[&str]) -> Option<usize> {
        let mut nodes = self.root.as_slice();
        let mut open = None;
        for name in path {
            let (at, children) = nodes.iter().find_map(|node| match node {
                Node::Block { key, open, children } if key.eq_ignore_ascii_case(name) => Some((*open, children)),
                _ => None,
            })?;
            open = Some(at);
            nodes = children;
        }
        open
    }

    fn insert(&self, at: usize, piece: &str) -> String {
        format!("{}{piece}{}", &self.text[..at], &self.text[at..])
    }
}

enum Token {
    Text { text: String, start: usize, end: usize },
    Open { at: usize },
    Close,
    End,
}

struct Tokens<'a> {
    text: &'a str,
    at: usize,
}

impl Tokens<'_> {
    /// The next token; `None` for anything that is not quoted text, a brace or a comment.
    fn next(&mut self) -> Option<Token> {
        let bytes = self.text.as_bytes();
        loop {
            while self.at < bytes.len() && bytes[self.at].is_ascii_whitespace() {
                self.at += 1;
            }
            if self.text[self.at..].starts_with("//") {
                self.at = self.text[self.at..].find('\n').map_or(bytes.len(), |end| self.at + end);
                continue;
            }
            break;
        }
        let Some(&byte) = bytes.get(self.at) else {
            return Some(Token::End);
        };
        let start = self.at;
        match byte {
            b'{' => {
                self.at += 1;
                Some(Token::Open { at: start })
            }
            b'}' => {
                self.at += 1;
                Some(Token::Close)
            }
            b'"' => {
                let mut text = String::new();
                let mut chars = self.text[start + 1..].char_indices();
                while let Some((i, c)) = chars.next() {
                    match c {
                        '"' => {
                            self.at = start + 1 + i + 1;
                            return Some(Token::Text { text, start, end: self.at });
                        }
                        '\\' => match chars.next()?.1 {
                            'n' => text.push('\n'),
                            't' => text.push('\t'),
                            other => text.push(other),
                        },
                        c => text.push(c),
                    }
                }
                None
            }
            _ => None,
        }
    }
}

/// `text` as a KeyValues string, without the quotes around it.
fn escape(text: &str) -> String {
    text.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "\\n").replace('\t', "\\t")
}

#[cfg(test)]
mod tests {
    use super::*;

    const BRIDGE: &str = "/Users/me/Library/Application Support/FMLibreEditor/libfmlibre_bridge.dylib";

    fn config(app_block: &str) -> String {
        format!(
            "\"UserLocalConfigStore\"\n{{\n\t\"Software\"\n\t{{\n\t\t\"Valve\"\n\t\t{{\n\t\t\t\"Steam\"\n\t\t\t{{\n\
             \t\t\t\t\"apps\"\n\t\t\t\t{{\n\t\t\t\t\t\"1295660\"\n\t\t\t\t\t{{\n\t\t\t\t\t\t\"LastPlayed\"\t\t\"1\"\n\
             \t\t\t\t\t}}{app_block}\n\t\t\t\t}}\n\t\t\t}}\n\t\t}}\n\t}}\n}}\n"
        )
    }

    #[test]
    fn the_launch_option_quotes_the_path() {
        assert_eq!(launch_option(Path::new(BRIDGE)), format!("DYLD_INSERT_LIBRARIES=\"{BRIDGE}\" %command%"));
        assert_eq!(quoted(Path::new("/a \"b\" $c")), r#""/a \"b\" \$c""#);
    }

    #[test]
    fn the_bridge_joins_what_is_there() {
        let bridge = Path::new(BRIDGE);
        let ours = format!("DYLD_INSERT_LIBRARIES=\"{BRIDGE}\"");
        assert_eq!(with_bridge(None, bridge), format!("{ours} %command%"));
        assert_eq!(with_bridge(Some("-windowed"), bridge), format!("{ours} %command% -windowed"));
        assert_eq!(with_bridge(Some("FOO=1 %command% -x"), bridge), format!("{ours} FOO=1 %command% -x"));
        // Next to another tool's library, in the same list.
        let other = "DYLD_INSERT_LIBRARIES=\"/Applications/Other.app/plugin.dylib\" %command%";
        let joined = with_bridge(Some(other), bridge);
        assert_eq!(
            joined,
            format!("DYLD_INSERT_LIBRARIES=\"{BRIDGE}\":\"/Applications/Other.app/plugin.dylib\" %command%")
        );
        assert!(loads(&joined, bridge));
        // Set up twice, changed once; taken out, as it was.
        assert_eq!(with_bridge(Some(&joined), bridge), joined);
        assert_eq!(without_bridge(&joined, bridge), other);
        assert_eq!(without_bridge(&with_bridge(Some("-windowed"), bridge), bridge), "%command% -windowed");
        assert_eq!(without_bridge(&with_bridge(None, bridge), bridge), "%command%");
    }

    #[test]
    fn launch_options_are_set_in_place() {
        let fm = "\n\t\t\t\t\t\"4530370\"\n\t\t\t\t\t{\n\t\t\t\t\t\t\"LastPlayed\"\t\t\"2\"\n\t\t\t\t\t}";
        let text = config(fm);
        let vdf = Vdf::parse(&text).expect("parse");
        assert_eq!(vdf.launch_options(STEAM_APP_ID), None);

        let set = vdf.set_launch_options(STEAM_APP_ID, Some("A=\"x y\" %command%")).expect("set");
        assert!(set.contains(
            "\t\t\t\t\t{\n\t\t\t\t\t\t\"LaunchOptions\"\t\t\"A=\\\"x y\\\" %command%\"\n\t\t\t\t\t\t\"LastPlayed\""
        ));
        let vdf = Vdf::parse(&set).expect("parse again");
        assert_eq!(vdf.launch_options(STEAM_APP_ID).as_deref(), Some("A=\"x y\" %command%"));

        let changed = vdf.set_launch_options(STEAM_APP_ID, Some("-windowed")).expect("change");
        assert_eq!(Vdf::parse(&changed).and_then(|v| v.launch_options(STEAM_APP_ID)).as_deref(), Some("-windowed"));
        let removed = Vdf::parse(&changed).and_then(|v| v.set_launch_options(STEAM_APP_ID, None)).expect("remove");
        assert_eq!(removed, text);
        // Other apps are left alone.
        assert!(Vdf::parse(&removed).and_then(|v| v.launch_options(1_295_660)).is_none());
    }

    #[test]
    fn an_app_without_settings_gets_a_block() {
        let text = config("");
        let vdf = Vdf::parse(&text).expect("parse");
        let set = vdf.set_launch_options(STEAM_APP_ID, Some("%command%")).expect("set");
        assert!(set.contains("\t\t\t\t{\n\t\t\t\t\t\"4530370\"\n\t\t\t\t\t{\n\t\t\t\t\t\t\"LaunchOptions\"\t\t\"%command%\"\n\t\t\t\t\t}\n"));
        assert_eq!(Vdf::parse(&set).and_then(|v| v.launch_options(STEAM_APP_ID)).as_deref(), Some("%command%"));
        assert_eq!(vdf.set_launch_options(STEAM_APP_ID, None).as_deref(), Some(text.as_str()));
    }

    #[test]
    fn unknown_shapes_are_left_alone() {
        assert!(Vdf::parse("\"a\" { \"b\" unquoted }").is_none());
        assert!(Vdf::parse("\"a\" { \"b\" \"c\"").is_none());
        let text = "\"UserLocalConfigStore\" { \"Other\" { } }";
        assert!(Vdf::parse(text).expect("parse").set_launch_options(STEAM_APP_ID, Some("x")).is_none());
    }

    #[test]
    fn sets_up_and_removes_in_a_steam_folder() {
        let home = std::env::temp_dir().join(format!("fmlibre-setup-test-{}", std::process::id()));
        let places = Places::of(&home);
        let account = places.steam_users.join("123/config");
        std::fs::create_dir_all(&account).expect("account folder");
        let config_text = config("");
        std::fs::write(account.join("localconfig.vdf"), &config_text).expect("config");
        let library = home.join("bundle").join(BRIDGE_FILE);
        std::fs::create_dir_all(library.parent().expect("parent")).expect("bundle folder");
        std::fs::write(&library, b"bridge").expect("library");

        // These run only while Steam is closed, which the test cannot arrange.
        if !steam_running() {
            let status = set_up(&places, &library).expect("set up");
            assert!(status.ready(), "{status:?}");
            assert_eq!(std::fs::read(&places.bridge).expect("installed"), b"bridge");
            assert_eq!(status.accounts[0].launch_options.as_deref(), Some(status.launch_option.as_str()));
            assert!(account.join("localconfig.vdf.fmlibre-backup").is_file());

            let status = remove(&places).expect("remove");
            assert!(!status.installed && !status.ready());
            // The block opened for FM27 stays, empty, as Steam keeps them.
            let text = std::fs::read_to_string(account.join("localconfig.vdf")).expect("config");
            let empty_block = "\"apps\"\n\t\t\t\t{\n\t\t\t\t\t\"4530370\"\n\t\t\t\t\t{\n\t\t\t\t\t}\n";
            assert_eq!(text, config_text.replacen("\"apps\"\n\t\t\t\t{\n", empty_block, 1));
        }
        std::fs::remove_dir_all(&home).expect("clean up");
    }
}
