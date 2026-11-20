//! Finding the game's own variables in a build the editor has no profile for.
//!
//! Each build of the game moves its static data. A build profile ([`BuildProfile`]) places the entity arrays, the
//! in-game date, the static pointer to the retirement manager and the one to the game's own object for each build the
//! editor was checked with. For any other build, or where a place a profile names does not check out, the editor looks
//! for them:
//! - the entity arrays, by scanning the game plugin ([`crate::calibrate`]);
//! - the in-game date, among the values in the plugin's writable data that read as dates: the one the game's own data
//!   agrees with, which [`crate::health`] works out from contracts and injuries, the values about as far from the
//!   players' array as another build keeps its date marked as such;
//! - the retirement manager's static and the game object's, each as far from the players' array as another build keeps
//!   it, or else by searching the plugin's writable data for a pointer to the one object of its class (see
//!   [`crate::rtti`]).
//!
//! Only reads memory.

use std::collections::{HashMap, HashSet};

use fmlibre_mem::{Region, is_user_pointer, regions};
use serde::Serialize;

use crate::date::FmDate;
use crate::game::Storefront;
use crate::profile::{BuildProfile, PluginFingerprint, built_in_profiles};
use crate::retirement::MANAGER_CLASS;
use crate::session::Session;

/// Bytes read at a time.
const CHUNK: u64 = 1 << 20;

/// The most of the plugin's writable data that is searched. The builds seen so far have about 1 MiB of it, besides
/// the large section that is writable and executable, which holds no such variables and is left out.
const MOST_SEARCHED: u64 = 64 << 20;

/// How far a value may be from where another build would have the in-game date and still count as found there. From
/// one build of a storefront to the next, the date's distance from the players' array has changed by 0x38 bytes at
/// most (Steam on macOS, 27.0.0 to 27.0.1), while the value the game keeps for the day before sits some 0x2F000 bytes
/// from the date (Game Pass).
pub const NEAR_GUESS: u64 = 0x400;

/// How the editor found a place in the game plugin.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Found {
    /// Where the build profile puts it.
    Profile,
    /// Beside the entity arrays, where the layout puts the in-game date ([`crate::profile::ClusterLayout`]): its place
    /// in the builds before November 2026. Later builds keep the date there too, but only once the game has moved on
    /// a day after a save is loaded.
    BesideArrays,
    /// As far from the players' array as another build keeps it: exactly, for the retirement manager's static, and
    /// within [`NEAR_GUESS`] for the in-game date.
    Guessed,
    /// By searching the plugin's writable data.
    Searched,
}

impl Found {
    /// How it was found, in a few words, for the probe.
    pub fn describe(self) -> &'static str {
        match self {
            Found::Profile => "from the build profile",
            Found::BesideArrays => "beside the entity arrays",
            Found::Guessed => "about as far from the players' array as in another build",
            Found::Searched => "found by searching",
        }
    }
}

/// A place in the game plugin, by its RVA, and how it was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Place {
    pub rva: u64,
    pub found: Found,
}

/// A value in the game plugin that reads as a date the game could be on: where it is, the date it read, and how it
/// was found.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatePlace {
    pub rva: u64,
    pub date: FmDate,
    pub found: Found,
}

/// The date that 4 bytes hold as the game keeps its date (the day of the year in the low 9 bits of the first `u16`,
/// flags above them, then the year), when it is one a game could be on.
pub(crate) fn game_date_from(raw: u32) -> Option<FmDate> {
    FmDate::from_raw(raw as u16, (raw >> 16) as u16).filter(|date| (2000..=2200).contains(&date.year))
}

/// Calls `visit` with each stretch of the plugin's writable data, not its code, and where the stretch starts.
pub(crate) fn each_stretch(session: &Session, mut visit: impl FnMut(u64, &[u8])) {
    let plugin = &session.plugin;
    let data: Vec<Region> = regions(&session.process, plugin.base, plugin.end())
        .into_iter()
        .filter(|region| region.is_writable() && !region.is_executable())
        .collect();
    let mut searched = 0;
    for region in data {
        let mut offset = 0;
        while offset < region.size && searched < MOST_SEARCHED {
            let len = (region.size - offset).min(CHUNK);
            if let Ok(bytes) = session.process.read_bytes(region.base + offset, len as usize) {
                visit(region.base + offset, &bytes);
            }
            offset += len;
            searched += len;
        }
    }
}

/// Every value in the plugin's writable data, at a multiple of 4 bytes, that reads as a date the game could be on: the
/// in-game date among them, if the game keeps it there. The places the build profile (unless every place is searched
/// for) and the layout name for it are marked as such, and so are those near where other builds keep their date
/// ([`date_guesses`]).
pub fn date_candidates(session: &Session) -> Vec<DatePlace> {
    let base = session.plugin.base;
    let beside = session.arrays.players.as_ref().map(|players| players.pair_rva + session.layout.cluster.current_date);
    let profiled = session.placed_date().filter(|&(_, found)| found == Found::Profile).map(|(rva, _)| rva);
    let guesses = date_guesses(session);
    let near_guess = |rva: u64| guesses.iter().any(|&guess| rva.abs_diff(guess) <= NEAR_GUESS);
    let mut found = Vec::new();
    each_stretch(session, |start, bytes| {
        for (i, word) in bytes.as_chunks::<4>().0.iter().enumerate() {
            let Some(date) = game_date_from(u32::from_le_bytes(*word)) else {
                continue;
            };
            let rva = start + 4 * i as u64 - base;
            let how = match Some(rva) {
                at if at == profiled => Found::Profile,
                at if at == beside => Found::BesideArrays,
                _ if near_guess(rva) => Found::Guessed,
                _ => Found::Searched,
            };
            found.push(DatePlace { rva, date, found: how });
        }
    });
    found
}

/// Where the static pointer to the retirement manager is: where the build profile puts it, or as far from the
/// players' array as another build keeps it, or else wherever the plugin's writable data points at the manager.
/// `None` when the layout does not place the manager's lists, or nothing checks out.
pub(crate) fn find_retirement_manager(session: &Session) -> Option<Place> {
    session.layout.retirement.as_ref()?;
    let profiled = session.placed_retirement_manager();
    if let Some(rva) = profiled.filter(|&rva| holds_retirement_manager(session, rva)) {
        return Some(Place { rva, found: Found::Profile });
    }
    let guessed = retirement_guesses(session).into_iter().find(|&rva| holds_retirement_manager(session, rva));
    if let Some(rva) = guessed {
        return Some(Place { rva, found: Found::Guessed });
    }
    let found = search_retirement_manager(session);
    // Each pointer the search found leads to the manager; there has only ever been one.
    found.first().map(|&rva| Place { rva, found: Found::Searched })
}

/// Where other builds would have the static pointer to the retirement manager: as far from the players' array as each
/// built-in profile of the same kind of plugin keeps it, those of the same storefront first. This build's own profile
/// is left out, so that a build the editor knows can stand in for a new one.
pub fn retirement_guesses(session: &Session) -> Vec<u64> {
    guesses(session, |profile| profile.retirement_manager)
}

/// Where the static pointer to the game's own object is ([`crate::profile::GameLayout`]): where the build profile puts
/// it, or as far from the players' array as another build keeps it, or else wherever the plugin's writable data points
/// at the object. `None` when the layout does not place the object's count of saves loaded, or nothing checks out.
pub(crate) fn find_game_ui(session: &Session) -> Option<Place> {
    session.layout.game.as_ref()?;
    let profiled = session.placed_game_ui();
    if let Some(rva) = profiled.filter(|&rva| holds_game_ui(session, rva)) {
        return Some(Place { rva, found: Found::Profile });
    }
    let guessed = game_ui_guesses(session).into_iter().find(|&rva| holds_game_ui(session, rva));
    if let Some(rva) = guessed {
        return Some(Place { rva, found: Found::Guessed });
    }
    // More than one static points at the object (two on Game Pass 0.9.2409.0); each leads to it.
    search_game_ui(session).first().map(|&rva| Place { rva, found: Found::Searched })
}

/// Where other builds would have the static pointer to the game's own object, as [`retirement_guesses`] works it out.
pub fn game_ui_guesses(session: &Session) -> Vec<u64> {
    guesses(session, |profile| profile.game_ui)
}

/// Whether the 8 bytes at `rva` in the plugin point at the game's own object.
pub fn holds_game_ui(session: &Session, rva: u64) -> bool {
    session
        .process
        .read_u64(session.plugin.base + rva)
        .is_ok_and(|object| is_user_pointer(object) && session.is_game_ui(object))
}

/// Every place in the plugin's writable data that points at an object of the class of the game's own object, by RVA;
/// none when the layout does not name it.
pub fn search_game_ui(session: &Session) -> Vec<u64> {
    session.layout.game.as_ref().map_or_else(Vec::new, |game| pointers_to(session, &game.class))
}

/// Where other builds would have the in-game date, worked out as [`retirement_guesses`] works out the retirement
/// manager's static. The date's own variable has kept nearly the same distance from the players' array in every build
/// of a storefront, where the value the game keeps for the day before, which can fit the contracts and injuries as well
/// as the date, is far from it.
pub fn date_guesses(session: &Session) -> Vec<u64> {
    guesses(session, |profile| profile.current_date)
}

/// The guesses of [`retirement_guesses`], [`game_ui_guesses`] and [`date_guesses`], for a static that `place` reads
/// from a profile.
fn guesses(session: &Session, place: impl Fn(&BuildProfile) -> Option<u64>) -> Vec<u64> {
    let Some(players) = session.arrays.players.as_ref() else {
        return Vec::new();
    };
    let this = (players.pair_rva, session.fingerprint, session.game.storefront);
    guesses_from(this, built_in_profiles(), place).into_iter().filter(|&guess| guess < session.plugin.size).collect()
}

/// The guesses of [`guesses`] from `profiles`, for a build whose players' array pair is at an RVA, of a plugin and a
/// storefront, as `this` gives them; some may lie past the end of the plugin.
fn guesses_from(
    this: (u64, PluginFingerprint, Storefront),
    profiles: impl Iterator<Item = BuildProfile>,
    place: impl Fn(&BuildProfile) -> Option<u64>,
) -> Vec<u64> {
    let (players, fingerprint, storefront) = this;
    let same_kind = |profile: &BuildProfile| {
        matches!(
            (profile.plugin, fingerprint),
            (PluginFingerprint::Pe { .. }, PluginFingerprint::Pe { .. })
                | (PluginFingerprint::MachO { .. }, PluginFingerprint::MachO { .. })
        )
    };
    let mut others: Vec<BuildProfile> =
        profiles.filter(|profile| profile.plugin != fingerprint && same_kind(profile)).collect();
    others.sort_by_key(|profile| profile.storefront != storefront);
    let mut guesses = Vec::new();
    for profile in others {
        let Some(static_rva) = place(&profile) else {
            continue;
        };
        let guess = players.wrapping_sub(profile.arrays.players.wrapping_sub(static_rva));
        if !guesses.contains(&guess) {
            guesses.push(guess);
        }
    }
    guesses
}

/// Whether the 8 bytes at `rva` in the plugin point at the retirement manager.
pub fn holds_retirement_manager(session: &Session, rva: u64) -> bool {
    session
        .process
        .read_u64(session.plugin.base + rva)
        .is_ok_and(|object| is_user_pointer(object) && session.is_retirement_manager(object))
}

/// Every place in the plugin's writable data that points at an object of the retirement manager's class, by RVA. Its
/// vtables are found from the class's name, which takes a second or so.
pub fn search_retirement_manager(session: &Session) -> Vec<u64> {
    pointers_to(session, MANAGER_CLASS)
}

/// Every place in the plugin's writable data that points at an object of `class` (as written in C++), by RVA. Its
/// vtables are found from the class's name, which takes a second or so.
fn pointers_to(session: &Session, class: &str) -> Vec<u64> {
    let vtables: HashSet<u64> = crate::rtti::vtables(&session.process, &session.plugin, class).into_iter().collect();
    if vtables.is_empty() {
        return Vec::new();
    }
    // The heap pointers the data holds, by RVA; each object they point at is read once.
    let mut pointers: Vec<(u64, u64)> = Vec::new();
    each_stretch(session, |start, bytes| {
        for (i, word) in bytes.as_chunks::<8>().0.iter().enumerate() {
            let pointer = u64::from_le_bytes(*word);
            if is_user_pointer(pointer) && !session.plugin.contains(pointer) {
                pointers.push((start + 8 * i as u64 - session.plugin.base, pointer));
            }
        }
    });
    let mut classes: HashMap<u64, bool> = HashMap::new();
    pointers
        .into_iter()
        .filter(|&(_, pointer)| {
            *classes
                .entry(pointer)
                .or_insert_with(|| session.process.read_u64(pointer).is_ok_and(|vtable| vtables.contains(&vtable)))
        })
        .map(|(rva, _)| rva)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_read_as_the_game_keeps_them() {
        // The in-game date on the Game Pass test save, flags and all, and on the Steam one.
        assert_eq!(game_date_from(u32::from_le_bytes([0xFC, 0x3A, 0xEA, 0x07])), FmDate::from_number(20260909));
        assert_eq!(game_date_from(u32::from_le_bytes([0xE1, 0x00, 0xEB, 0x07])), FmDate::from_number(20270813));
        // Unset (1900), out of the years a game is on, and no day.
        assert_eq!(game_date_from(u32::from_le_bytes([0x01, 0x00, 0x6C, 0x07])), None);
        assert_eq!(game_date_from(u32::from_le_bytes([0x01, 0x00, 0xCF, 0x07])), None);
        assert_eq!(game_date_from(u32::from_le_bytes([0x00, 0x02, 0xEA, 0x07])), None);
    }

    #[test]
    fn builds_keep_the_date_about_as_far_from_the_players_array() {
        let profiles: Vec<BuildProfile> = built_in_profiles().collect();
        let guesses_for = |profile: &BuildProfile| {
            let this = (profile.arrays.players, profile.plugin, profile.storefront);
            guesses_from(this, profiles.iter().cloned(), |other| other.current_date)
        };
        let near = |guesses: &[u64], rva: u64| guesses.iter().any(|guess| guess.abs_diff(rva) <= NEAR_GUESS);
        // Each build whose date is a variable of its own has it near one of the places the other builds guess for it,
        // where another of its storefront has such a variable. On macOS that is a guess from a build of the same
        // half: the Intel and the Apple silicon half each keep the date at a distance of their own. The update of 17
        // November 2026 moved it about 0x1490 nearer the players pair, out of reach of every guess from the builds
        // before (0x14A0 on Game Pass 0.9.2524.0, 0x1480 on Steam build 26620374): there the search found it, the one
        // date that fits best on a save of 18 January 2028, and the only one but the field beside the arrays on a save
        // of 14 October 2026. Their profiles guess the next builds' dates.
        // The Epic profile of the same update now guesses Steam build 26620374's date, so it is no longer beyond the guesses.
        let kind = |profile: &BuildProfile| std::mem::discriminant(&profile.plugin);
        let beyond_the_guesses = |profile: &BuildProfile| {
            profile.package_version.as_deref() == Some("0.9.2524.0")
        };
        for profile in profiles.iter().filter(|profile| profile.current_date.is_some()) {
            let date = profile.current_date.expect("a date");
            let siblings = profiles.iter().any(|other| {
                other.plugin != profile.plugin
                    && other.storefront == profile.storefront
                    && kind(other) == kind(profile)
                    && other.current_date.is_some()
            });
            if siblings {
                let guessed = near(&guesses_for(profile), date);
                assert_eq!(guessed, !beyond_the_guesses(profile), "{}: {date:#x}", profile.name);
            }
        }
        // The value the game keeps for the day before, on Game Pass, is far from every guess.
        for (version, day_before) in [("0.9.2409.0", 0x56546F8), ("0.9.2435.0", 0x53886F8)] {
            let profile = profiles.iter().find(|p| p.package_version.as_deref() == Some(version)).expect(version);
            assert!(!near(&guesses_for(profile), day_before), "{version}");
            assert!(near(&guesses_for(profile), profile.current_date.expect("a date")), "{version}");
        }
    }
}
