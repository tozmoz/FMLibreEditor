//! The game's matches: which teams play each other, and on what day.
//!
//! The game keeps every match it has arranged, the season's league and cup ties and the friendlies, as an object of
//! one class (see [`FixtureLayout`]) that points at its two teams and keeps the day it is played on. Nothing the editor
//! reads otherwise leads to them, so they are found by their class, in one pass over the game's memory that takes a
//! second or two (see docs/recon/fm27-fixtures.md). The app reads them to tell a team's match day.
//!
//! [`FixtureLayout`]: crate::FixtureLayout

use std::collections::{BTreeSet, HashMap};
use std::fmt;

use fmlibre_mem::is_user_pointer;

use crate::date::FmDate;
use crate::profile::FixtureLayout;
use crate::rtti;
use crate::session::Session;

/// The classes of the teams a match points at, as written in C++: a club's team, or a nation's. The Game Pass build
/// 0.9.2562.0 keeps national teams' matches first in memory, so the first matches read may all be theirs.
const TEAM_CLASSES: [&str; 2] = ["db::TEAM", "db::NATIONAL_TEAM"];

/// How many matches are checked to point at two teams: where most do not, the layout is not this build's.
const CHECKED: usize = 16;

/// A match: its home team and its away team, where they are in the game's memory, and the day it is played on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Match {
    pub home: u64,
    pub away: u64,
    pub day: FmDate,
}

/// The game's matches, with the days each team plays on.
#[derive(Debug, Clone, Default)]
pub struct Fixtures {
    matches: Vec<Match>,
    days: HashMap<u64, BTreeSet<FmDate>>,
}

impl Fixtures {
    /// The matches `matches`, each once, with the days each of their teams plays on.
    pub fn new(mut matches: Vec<Match>) -> Self {
        // A block the game has taken back may hold a copy of a match.
        matches.sort_by_key(|found| (found.day, found.home, found.away));
        matches.dedup();
        let mut days: HashMap<u64, BTreeSet<FmDate>> = HashMap::new();
        for found in &matches {
            days.entry(found.home).or_default().insert(found.day);
            days.entry(found.away).or_default().insert(found.day);
        }
        Self { matches, days }
    }

    /// Every match, by day.
    pub fn matches(&self) -> &[Match] {
        &self.matches
    }

    /// Whether the team at `team` plays a match on `day`.
    pub fn plays_on(&self, team: u64, day: FmDate) -> bool {
        self.days.get(&team).is_some_and(|days| days.contains(&day))
    }

    /// The first day after `day` that the team at `team` plays a match on; `None` when the game has arranged it none.
    pub fn next_after(&self, team: u64, day: FmDate) -> Option<FmDate> {
        self.days.get(&team)?.iter().copied().find(|&played| played > day)
    }

    /// The days the team at `team` plays a match on, in order.
    pub fn days_of(&self, team: u64) -> impl Iterator<Item = FmDate> + '_ {
        self.days.get(&team).into_iter().flatten().copied()
    }
}

/// Why the game's matches cannot be read.
#[derive(Debug)]
pub enum FixtureError {
    /// The layout does not place them, or the game names no such class: a version of the game they have not been
    /// checked in.
    Unknown,
    /// What their class holds does not read as matches: the layout is not this build's.
    Unread,
    Memory(fmlibre_mem::Error),
}

impl fmt::Display for FixtureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FixtureError::Unknown => {
                f.write_str("the editor does not know where this version of the game keeps its matches")
            }
            FixtureError::Unread => f.write_str("what the game keeps for its matches does not read as matches"),
            FixtureError::Memory(err) => err.fmt(f),
        }
    }
}

impl std::error::Error for FixtureError {}

impl From<fmlibre_mem::Error> for FixtureError {
    fn from(err: fmlibre_mem::Error) -> Self {
        FixtureError::Memory(err)
    }
}

impl Session {
    /// Every match the game has arranged, read now, in one pass over its memory. A block the game has taken back may
    /// keep a match's class and what it held: such a match counts as any other. Fails where the layout does not place
    /// them, or where the first matches read do not point at teams.
    pub fn fixtures(&self) -> Result<Fixtures, FixtureError> {
        let layout = self.layout.fixture.as_ref().ok_or(FixtureError::Unknown)?;
        let vtables = self.fixture_class.get_or_init(|| rtti::vtables(&self.process, &self.plugin, &layout.class));
        if vtables.is_empty() {
            return Err(FixtureError::Unknown);
        }
        let len = (layout.home.max(layout.away).max(layout.day) + 8) as usize;
        let mut matches = Vec::new();
        for object in rtti::objects(&self.process, &self.plugin, vtables)?.into_values().flatten() {
            if let Ok(bytes) = self.process.read_bytes(object, len)
                && let Some(found) = read_match(&bytes, layout)
            {
                matches.push(found);
            }
        }
        // A layout that is not this build's reads other words as the teams: they lead to no team.
        let teams: Vec<String> = TEAM_CLASSES.iter().map(|class| rtti::mangled(class)).collect();
        let is_team =
            |at: u64| rtti::class_of(&self.process, &self.plugin, at).is_some_and(|class| teams.contains(&class));
        let checked: Vec<bool> =
            matches.iter().take(CHECKED).map(|found| is_team(found.home) && is_team(found.away)).collect();
        if checked.is_empty() || checked.iter().filter(|&&teams| teams).count() * 2 <= checked.len() {
            return Err(FixtureError::Unread);
        }
        Ok(Fixtures::new(matches))
    }
}

/// The match whose object starts with `bytes`, laid out as `layout` says; `None` where it does not point at two teams
/// or holds no day.
fn read_match(bytes: &[u8], layout: &FixtureLayout) -> Option<Match> {
    let word = |at: u64| -> Option<u64> {
        let at = usize::try_from(at).ok()?;
        Some(u64::from_le_bytes(bytes.get(at..at + 8)?.try_into().ok()?))
    };
    let half = |at: u64| -> Option<u16> {
        let at = usize::try_from(at).ok()?;
        Some(u16::from_le_bytes(bytes.get(at..at + 2)?.try_into().ok()?))
    };
    let (home, away) = (word(layout.home)?, word(layout.away)?);
    if !is_user_pointer(home) || !is_user_pointer(away) || home == away {
        return None;
    }
    let day = FmDate::from_raw(half(layout.day)?, half(layout.day + 2)?)?;
    Some(Match { home, away, day })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout() -> FixtureLayout {
        FixtureLayout { class: "sicomps::FIXTURE".to_owned(), home: 0x08, away: 0x10, day: 0x4C }
    }

    /// A match's object as the Mac Steam build 26797085 laid out Arsenal's first league match: Arsenal at home on 14
    /// August 2027, the day kept with flags above its 9 bits as the game keeps them.
    fn object(home: u64, away: u64, day: u16, year: u16) -> Vec<u8> {
        let mut bytes = vec![0xFF; 0x58];
        bytes[..8].copy_from_slice(&0x1_7271_7350_u64.to_le_bytes());
        bytes[0x08..0x10].copy_from_slice(&home.to_le_bytes());
        bytes[0x10..0x18].copy_from_slice(&away.to_le_bytes());
        bytes[0x4C..0x4E].copy_from_slice(&day.to_le_bytes());
        bytes[0x4E..0x50].copy_from_slice(&year.to_le_bytes());
        bytes
    }

    const ARSENAL: u64 = 0x7b_30b6_70c8;
    const BRIGHTON: u64 = 0x7b_30b6_84e8;

    #[test]
    fn a_match_reads_its_teams_and_its_day() {
        // 0x36E2: day 226 of 2027 (14 August), with flags 27 above it.
        let found = read_match(&object(ARSENAL, BRIGHTON, 0x36E2, 2027), &layout());
        assert_eq!(found, Some(Match { home: ARSENAL, away: BRIGHTON, day: FmDate { year: 2027, month: 8, day: 14 } }));
    }

    #[test]
    fn what_holds_no_teams_or_no_day_is_no_match() {
        assert_eq!(read_match(&object(0, BRIGHTON, 0x36E2, 2027), &layout()), None);
        assert_eq!(read_match(&object(ARSENAL, ARSENAL, 0x36E2, 2027), &layout()), None);
        // A friendly's other date, unset: 1 January 1900.
        assert_eq!(read_match(&object(ARSENAL, BRIGHTON, 0x0001, 1900), &layout()), None);
        assert_eq!(read_match(&object(ARSENAL, BRIGHTON, 0x36E2, 2027)[..0x40], &layout()), None);
    }

    #[test]
    fn a_team_plays_on_the_days_of_its_matches() {
        let day = |month, day| FmDate { year: 2027, month, day };
        let fixtures = Fixtures::new(vec![
            Match { home: ARSENAL, away: BRIGHTON, day: day(8, 14) },
            Match { home: BRIGHTON, away: ARSENAL, day: day(12, 26) },
            Match { home: 0x7b_0000_1000, away: ARSENAL, day: day(7, 22) },
        ]);
        assert!(fixtures.plays_on(ARSENAL, day(7, 22)) && fixtures.plays_on(BRIGHTON, day(12, 26)));
        assert!(!fixtures.plays_on(BRIGHTON, day(7, 22)) && !fixtures.plays_on(ARSENAL, day(7, 18)));
        assert_eq!(fixtures.next_after(ARSENAL, day(7, 18)), Some(day(7, 22)));
        // Today's match is not the next one.
        assert_eq!(fixtures.next_after(ARSENAL, day(7, 22)), Some(day(8, 14)));
        assert_eq!(fixtures.next_after(ARSENAL, day(12, 26)), None);
        assert_eq!(fixtures.next_after(0x7b_0000_2000, day(7, 18)), None);
        assert_eq!(fixtures.days_of(ARSENAL).count(), 3);
        // By day.
        assert_eq!(fixtures.matches()[0].day, day(7, 22));
    }

    #[test]
    fn a_copy_of_a_match_counts_once() {
        let found = Match { home: ARSENAL, away: BRIGHTON, day: FmDate { year: 2027, month: 8, day: 14 } };
        assert_eq!(Fixtures::new(vec![found, found]).matches(), &[found]);
    }
}
