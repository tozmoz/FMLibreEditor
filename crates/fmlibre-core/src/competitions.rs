//! The game's competitions: its leagues and cups.
//!
//! The game keeps them in a pool of objects of one class (`db::COMP`, see `object_pool.rs`), each slot an object: its
//! UID where clubs keep theirs, its names as FM strings, pointers to the nation and continent it belongs to, its
//! reputation, the matches a team plays in it and the season it runs in. Only reads memory.
//!
//! The pool is found by its slot size and checked by what the slots hold (see [`competition_pool`]): the game has more
//! than one pool of slots that size, and only this one holds competitions.
//!
//! A competition's fields are read as stored; a few are written (see `edit.rs`), each into the object itself, and the
//! editor's checks that the build is one it knows cover them as they do the clubs'. Prize money is a competition's
//! stages' (see `prize_money.rs`).

use fmlibre_mem::{Process, is_user_pointer};
use serde::Serialize;

use crate::date::FmDate;
use crate::index::{Listed, SearchIndex};
use crate::object_pool::ObjectPool;
use crate::profile::{CompetitionLayout, Layout};
use crate::text::read_fm_string;

/// The most stages a league has: none, or one when its play-offs are a stage of their own (the Championship's). A cup
/// is played in two or more (the FA Cup's 2, the Champions League's 21), which is what tells them apart.
const MOST_LEAGUE_STAGES: u16 = 1;

/// The slots sampled to tell the competitions' pool from the game's other pools of the same slot size. They are spread
/// over the whole pool: a save loads some slots later than others, so the first few can read empty through no fault of
/// the pool.
const SAMPLES: u64 = 24;

/// The alpha the game packs into every colour it stores: three bytes of blue, green and red under it.
const COLOUR_ALPHA: u32 = 0xFF00_0000;

/// A competition's colours, as the game stores them: blue, green and red under an alpha of 255, so that the
/// Premier League's background reads `0xFFF8F8F8` (`#F8F8F8`) and its foreground `0xFF380030` (`#380030`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Colours {
    /// Behind the competition's name.
    pub background: u32,
    /// The text on it.
    pub foreground: u32,
    /// The kit its teams wear in it.
    pub kit: u32,
    /// The colour of the champion's name.
    pub text: u32,
    /// The kit it switches to in winter, between its two winter dates.
    pub winter_kit: u32,
}

/// The fields shown in competition lists.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompetitionSummary {
    pub uid: u32,
    /// Full name, e.g. "英格兰超级联赛".
    pub name: String,
    pub short_name: Option<String>,
    /// The game's own tag for it, e.g. "英超".
    pub abbreviation: Option<String>,
    /// The nation it belongs to; none for an international competition.
    pub nation: Option<String>,
    pub continent: Option<String>,
    /// 1–200, the game's scale for how big a competition is: the Champions League 200, the Premier League 189, the
    /// Championship 136. None where the layout does not place it.
    pub reputation: Option<u16>,
    /// The substitution rule its matches are played under, overriding the rule the competition is stored with; 0xFF
    /// leaves that rule alone. The codes are the game's (see `edit.rs`), and none where the layout does not place it.
    pub substitution_rules: Option<u8>,
    /// The stages it is played in: 0 or 1 in a league, more in a cup.
    pub stages: Option<u16>,
    /// The matches one team plays in it: 38 in the Premier League, 46 in the Championship; none before they are drawn,
    /// and none in a cup.
    pub matches: Option<u16>,
    /// The first and last day of the season it is in.
    pub season_start: Option<FmDate>,
    pub season_end: Option<FmDate>,
    /// The days it wears its winter kit between, where the game sets them.
    pub winter_start: Option<FmDate>,
    pub winter_end: Option<FmDate>,
    /// Its colours, where the layout places them and they read as colours.
    pub colours: Option<Colours>,
    #[serde(skip)]
    pub address: u64,
}

impl CompetitionSummary {
    /// Whether it is played as a league, whose teams each play the others over a season, rather than as a cup. Taken
    /// from its stages (see [`MOST_LEAGUE_STAGES`]); a competition the layout does not place them in is neither.
    pub fn is_league(&self) -> bool {
        self.stages.is_some_and(|stages| stages <= MOST_LEAGUE_STAGES)
    }
}

impl CompetitionSummary {
    /// The game object this is, for the fields the editor writes to it.
    pub fn target(&self) -> crate::edit::Target {
        crate::edit::Target { entity: crate::edit::Entity::Competition, uid: self.uid, address: self.address, shift: 0 }
    }
}

impl CompetitionSummary {
    /// Brings the fields a list row shows up to date after `field` was set to `value`.
    pub fn note_change(&mut self, field: &str, value: i64) {
        match field {
            "reputation" => self.reputation = u16::try_from(value).ok(),
            "substitution_rules" => self.substitution_rules = u8::try_from(value).ok(),
            "season_start" => self.season_start = FmDate::from_number(value),
            "season_end" => self.season_end = FmDate::from_number(value),
            "winter_start" => self.winter_start = FmDate::from_number(value),
            "winter_end" => self.winter_end = FmDate::from_number(value),
            // A colour is a `u32` packed with its alpha; one written a byte at a time comes back the same.
            "colour.background" => self.set_colour(|c| &mut c.background, value),
            "colour.foreground" => self.set_colour(|c| &mut c.foreground, value),
            "colour.kit" => self.set_colour(|c| &mut c.kit, value),
            "colour.text" => self.set_colour(|c| &mut c.text, value),
            "colour.winter_kit" => self.set_colour(|c| &mut c.winter_kit, value),
            _ => {}
        }
    }

    fn set_colour(&mut self, which: impl FnOnce(&mut Colours) -> &mut u32, value: i64) {
        if let (Some(colours), Ok(colour)) = (self.colours.as_mut(), u32::try_from(value)) {
            *which(colours) = colour;
        }
    }
}

impl Listed for CompetitionSummary {
    fn uid(&self) -> u32 {
        self.uid
    }

    fn names(&self) -> String {
        let mut names = self.name.clone();
        for other in [&self.short_name, &self.abbreviation] {
            if let Some(text) = other
                && *text != self.name
            {
                names.push(' ');
                names.push_str(text);
            }
        }
        names
    }

    fn display_name(&self) -> &str {
        &self.name
    }

    /// The biggest competitions first: a list of 8,000 names is no use in the game's own order.
    fn rank(&self) -> i32 {
        self.reputation.map_or(-1, i32::from)
    }
}

pub type CompetitionIndex = SearchIndex<CompetitionSummary>;

/// The UID of the competition at `address`, when it is one: a slot the game has freed keeps neither its UID nor a name.
fn competition_at(process: &Process, layout: &CompetitionLayout, address: u64) -> Option<u32> {
    let head = process.read_bytes(address, layout.end() as usize).ok()?;
    let u32_at =
        |offset: u64| u32::from_le_bytes(head[offset as usize..offset as usize + 4].try_into().expect("4 bytes"));
    let uid = u32_at(layout.uid);
    // A competition holds its UID twice, the second time 4 bytes on.
    if uid == 0 || u32_at(layout.uid + 4) != uid {
        return None;
    }
    let name = u64::from_le_bytes(head[layout.name as usize..layout.name as usize + 8].try_into().expect("8 bytes"));
    read_fm_string(process, name).map(|_| uid)
}

/// How many of `SAMPLES` slots spread over the pool hold a competition.
fn sample(pool: &ObjectPool, process: &Process, layout: &CompetitionLayout) -> (u64, u64) {
    let total: u64 = (0..pool.chunks.len()).map(|index| pool.slots_of(index)).sum();
    if total == 0 {
        return (0, 0);
    }
    let step = (total / SAMPLES).max(1);
    let mut seen = 0;
    let mut fit = 0;
    let mut index = 0;
    let mut slot = 0;
    while seen < SAMPLES && index < pool.chunks.len() {
        let address = pool.chunks[index] + slot * u64::from(pool.slot_size);
        seen += 1;
        fit += u64::from(competition_at(process, layout, address).is_some());
        slot += step;
        while index < pool.chunks.len() && slot >= pool.slots_of(index) {
            slot -= pool.slots_of(index);
            index += 1;
        }
    }
    (seen, fit)
}

/// The game's pool of competitions, out of the pools the session found, when one of them holds them: slots of one size
/// whose sample are nearly all competitions. `None` where the layout does not place competitions, or no pool holds them.
pub fn competition_pool(process: &Process, layout: &Layout, pools: &[ObjectPool]) -> Option<ObjectPool> {
    let competition = layout.competition.as_ref()?;
    let mut best: Option<(f64, ObjectPool)> = None;
    for pool in pools {
        // A slot has to be at least as large as the layout's last field: the game's stadiums are 192-byte slots and
        // hold a UID pair and a readable name too, so without this they can pass for competitions.
        if u64::from(pool.slot_size) < competition.end() {
            continue;
        }
        let (seen, fit) = sample(pool, process, competition);
        if seen == 0 || fit == 0 {
            continue;
        }
        let share = fit as f64 / seen as f64;
        if share >= 0.9 && best.as_ref().is_none_or(|(score, _)| share > *score) {
            best = Some((share, pool.clone()));
        }
    }
    best.map(|(_, pool)| pool)
}

/// Reads the name of the nation or continent `pointer` names, when it points at one.
fn linked_name(process: &Process, pointer: u64) -> Option<String> {
    if !is_user_pointer(pointer) {
        return None;
    }
    // Both keep their name at +0x18 behind their class, as `[nation] name` says.
    let at = process.read_u64(pointer + 0x18).ok()?;
    read_fm_string(process, at)
}

/// Reads every competition in `pool`, in the order the pool keeps them. Slots the game has freed are skipped, and so
/// are objects without a readable name. Only reads memory.
pub fn read_competitions(
    process: &Process,
    layout: &Layout,
    pool: &ObjectPool,
) -> fmlibre_mem::Result<Vec<CompetitionSummary>> {
    let Some(c) = layout.competition.as_ref() else {
        return Ok(Vec::new());
    };
    let mut competitions = Vec::new();
    for (index, &chunk) in pool.chunks.iter().enumerate() {
        let slots = pool.slots_of(index);
        for slot in 0..slots {
            let address = chunk + slot * u64::from(pool.slot_size);
            let Some(uid) = competition_at(process, c, address) else {
                continue;
            };
            competitions.push(read_competition(process, c, address, uid));
        }
    }
    Ok(competitions)
}

/// Reads the competition at `address` again, when that slot still holds the one whose UID is `uid`: what its profile
/// shows once the game, or the editor, has changed it. `None` where the slot holds another competition now, or nothing.
pub fn read_competition_at(
    process: &Process,
    layout: &Layout,
    address: u64,
    uid: u32,
) -> Option<CompetitionSummary> {
    let c = layout.competition.as_ref()?;
    (competition_at(process, c, address)? == uid).then(|| read_competition(process, c, address, uid))
}

/// Reads the competition at `address`, whose UID is `uid` as just read. Fields the layout does not place are left out.
fn read_competition(
    process: &Process,
    c: &CompetitionLayout,
    address: u64,
    uid: u32,
) -> CompetitionSummary {
    let read = process.read_bytes(address, c.end() as usize).unwrap_or_default();
    let u16_at = |offset: Option<u64>| {
        offset.and_then(|offset| {
            let bytes: [u8; 2] = read.get(offset as usize..offset as usize + 2)?.try_into().ok()?;
            Some(u16::from_le_bytes(bytes))
        })
    };
    let u32_at = |offset: Option<u64>| {
        offset.and_then(|offset| {
            let bytes: [u8; 4] = read.get(offset as usize..offset as usize + 4)?.try_into().ok()?;
            Some(u32::from_le_bytes(bytes))
        })
    };
    let u64_at = |offset: u64| {
        read.get(offset as usize..offset as usize + 8).and_then(|bytes| bytes.try_into().ok()).map(u64::from_le_bytes)
    };
    let date_at = |offset: Option<u64>| {
        offset.and_then(|offset| {
            FmDate::from_raw(u16_at(Some(offset))?, u16_at(Some(offset + 2))?)
        })
    };
    let text_at = |offset: Option<u64>| offset.and_then(u64_at).and_then(|p| read_fm_string(process, p));

    // The reputation is kept twice, the same value: a pair that differs means the layout does not fit this object.
    let reputation = c.reputation.and_then(|offset| {
        let (first, second) = (u16_at(Some(offset))?, u16_at(Some(offset + 2))?);
        // Kept twice, the same value in both; the second reads 65,535 where the game keeps none, and a first of 0 is
        // a competition it never rated.
        let kept_twice = second == first || second == u16::MAX;
        (kept_twice && first != 0 && first <= 200).then_some(first)
    });

    // A colour is a `u32` under an alpha of 255; five in a row that are not mean the layout does not fit this object,
    // and none are shown.
    let colour = |offset: Option<u64>| u32_at(offset).filter(|colour| colour & COLOUR_ALPHA == COLOUR_ALPHA);
    let colours = (|| {
        Some(Colours {
            background: colour(c.colour_background)?,
            foreground: colour(c.colour_foreground)?,
            kit: colour(c.colour_kit)?,
            text: colour(c.colour_text)?,
            winter_kit: colour(c.colour_winter_kit)?,
        })
    })();

    CompetitionSummary {
        uid,
        name: text_at(Some(c.name)).unwrap_or_default(),
        short_name: text_at(Some(c.short_name)),
        abbreviation: c.abbreviation.and_then(|_| text_at(c.abbreviation)),
        nation: c.nation.and_then(u64_at).and_then(|p| linked_name(process, p)),
        continent: c.continent.and_then(u64_at).and_then(|p| linked_name(process, p)),
        reputation,
        substitution_rules: c.substitution_rules.and_then(|offset| read.get(offset as usize).copied()),
        stages: c.stages.and_then(|offset| u16_at(Some(offset))),
        matches: c.matches.and_then(|offset| {
            let matches = u16_at(Some(offset))?;
            // 0 until the season's matches are drawn, 255 in a cup (a byte of its own set to all ones): neither is a
            // count of the matches a team plays.
            (matches != 0 && matches != 255).then_some(matches)
        }),
        season_start: date_at(c.season_start),
        season_end: date_at(c.season_end),
        winter_start: date_at(c.winter_start),
        winter_end: date_at(c.winter_end),
        colours,
        address,
    }
}
