//! How the players of a career change over time: a record of their abilities, value and attributes, taken every week
//! of the game's time while the editor is connected: from the lists as it reads them, and from the players read again
//! as the game moves on (see [`Timeline::due_later`]). The game keeps only what a player is now; the records are what a
//! profile draws his development from.
//!
//! The first record holds every player whole. Each later one holds only what changed since the one before, for the
//! players that changed, and the new players whole: most values stay as they are from one week to the next. A record
//! is one line of JSON, compressed on its own (a gzip member), so that a file of them is added to at its end (see
//! [`Timeline::record`] and [`Timeline::read`]).
//!
//! A date that is earlier than the last record's means the game has loaded an older save of the career: the record
//! taken then holds every player whole again, and the records dated on or after it are left out from then on, as they
//! belong to days the career is yet to play again.
//!
//! So that a long career does not grow without end, the records older than a year before the last one are thinned to
//! about one a month, as they are read and as they come of age (see [`Timeline::thin`]): what a record left out holds
//! is held from the next record kept, so that what each player was on every date kept stays as it was. Values that
//! repeat the one before them are left out too, as most of a whole record of an older save does; a file whose reading
//! leaves out enough is written whole anew from what was kept (see [`Timeline::rewrite_due`]).

use std::collections::{BTreeMap, HashMap};
use std::io::{Read, Write};

use flate2::Compression;
use flate2::bufread::GzDecoder;
use flate2::write::GzEncoder;
use serde::{Deserialize, Serialize};

use crate::date::FmDate;
use crate::details::ATTRIBUTE_GROUPS;
use crate::filter::attribute_keys;
use crate::players::PlayerSummary;

/// The version of a record's line. A line of another version is skipped.
const VERSION: u8 = 1;

/// How many days of the game's time pass between two records, at least.
pub const RECORD_EVERY_DAYS: i64 = 7;

/// How many days back from the last record every record is kept (see [`Timeline::thin`]): a year, the longest period a
/// profile's development offers besides all of it.
pub const KEEP_ALL_DAYS: i64 = 365;

/// Before that, how many days apart the records kept are at least: about a month.
pub const THINNED_EVERY_DAYS: i64 = 28;

/// A file is written anew once reading it leaves out at least one in this many of its values (see
/// [`Timeline::rewrite_due`]): as a whole record of an older save does, most of whose values repeat those before it.
pub const REWRITE_SHARE: usize = 4;

/// The most records a timeline holds: their indices fit in a point's 16 bits.
const MOST_RECORDS: usize = u16::MAX as usize;

/// The fields a record holds besides the attributes, first in [`timeline_fields`].
pub const CURRENT_ABILITY: &str = "current_ability";
pub const POTENTIAL_ABILITY: &str = "potential_ability";
pub const VALUE: &str = "value";

/// What a record holds of a player, in the order of [`timeline_values`]: his abilities, his transfer value in pounds,
/// and his attributes as FM shows them (1–20).
pub fn timeline_fields() -> Vec<String> {
    [CURRENT_ABILITY, POTENTIAL_ABILITY, VALUE]
        .into_iter()
        .chain(attribute_keys(ATTRIBUTE_GROUPS))
        .map(str::to_owned)
        .collect()
}

/// The values of `player` for [`timeline_fields`]; none for what the layout does not place.
pub fn timeline_values(player: &PlayerSummary) -> Vec<Option<i32>> {
    let abilities = [Some(i32::from(player.current_ability)), Some(i32::from(player.potential_ability))];
    let attributes = player.attributes.iter().map(|&value| (value > 0).then_some(i32::from(value)));
    abilities.into_iter().chain([player.transfer_value]).chain(attributes).collect()
}

/// One record as its line has it.
#[derive(Serialize, Deserialize)]
struct Line {
    v: u8,
    date: FmDate,
    /// When it was taken, in milliseconds since 1970.
    at: u64,
    /// Whether it holds every player whole, rather than what changed since the record before.
    full: bool,
    /// The fields the indices below stand for: a line says so itself, so that a later version of the app, with other
    /// fields or another order, still reads it.
    fields: Vec<String>,
    /// For each player it holds, his UID and pairs of a field's index and its value, one after the other.
    players: Vec<(u32, Vec<i32>)>,
}

/// A value a record holds: of the record `record` on, the field `field` of the player is `value`. Eight bytes: a
/// career's first record alone holds millions.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Point {
    record: u16,
    field: u8,
    value: i32,
}

/// The records of one career, as read from its file and added to since.
#[derive(Debug, Default)]
pub struct Timeline {
    fields: Vec<String>,
    /// The dates of the records, each later than the one before.
    records: Vec<FmDate>,
    /// When each record was taken, in milliseconds since 1970.
    taken: Vec<u64>,
    /// What the records hold of each player, in their order.
    players: HashMap<u32, Vec<Point>>,
    /// How many values the file read held, and how many of them reading left out: those of records a whole record of
    /// an older save dropped, of records thinned away, and those that repeated the value before them. Whether one of
    /// its lines was of another version or did not read. See [`Timeline::rewrite_due`].
    read_values: usize,
    left_out: usize,
    unknown: bool,
    /// Whether a whole record of an older save was taken since the records were last thinned: most of its values
    /// repeat those before it (see [`Timeline::thinning_due`]).
    repeats: bool,
}

/// How a player's values went, for his profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// The dates of the records since the first that holds him, the oldest first, and the game's date as the last:
    /// what he is now, as the lists have him.
    pub dates: Vec<FmDate>,
    /// For each field (see [`timeline_fields`]) that has a value, its value on each of the dates; none before the
    /// first record that holds one.
    pub series: BTreeMap<String, Vec<Option<i32>>>,
}

/// What a player's current ability was at the record to compare him with (see [`Timeline::earlier`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Earlier {
    pub uid: u32,
    pub date: FmDate,
    pub current_ability: i32,
}

impl Timeline {
    pub fn new() -> Self {
        Self { fields: timeline_fields(), ..Self::default() }
    }

    /// The records in `bytes`, the contents of a file, thinned (see [`Timeline::thin`]), and how many of its bytes they
    /// take: what follows is a record cut short, by a crash say, which the next record is to be written over.
    pub fn read(bytes: &[u8]) -> (Self, usize) {
        let mut timeline = Self::new();
        let mut rest = bytes;
        let mut values = 0;
        while !rest.is_empty() {
            let mut decoder = GzDecoder::new(rest);
            let mut text = String::new();
            if decoder.read_to_string(&mut text).is_err() {
                break;
            }
            rest = decoder.into_inner();
            match serde_json::from_str::<Line>(&text) {
                Ok(line) if line.v == VERSION => {
                    values += line.players.iter().map(|(_, pairs)| pairs.len() / 2).sum::<usize>();
                    timeline.take(&line);
                }
                // A line that does not read is skipped; so is one of a version this one does not know.
                _ => timeline.unknown = true,
            }
        }
        timeline.thin();
        timeline.read_values = values;
        timeline.left_out = values.saturating_sub(timeline.players.values().map(Vec::len).sum());
        (timeline, bytes.len() - rest.len())
    }

    /// How many records there are, and the dates of the first and the last.
    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    pub fn first_date(&self) -> Option<FmDate> {
        self.records.first().copied()
    }

    pub fn last_date(&self) -> Option<FmDate> {
        self.records.last().copied()
    }

    /// Whether a record of the game's date `date` is due as the game moves on: there is none yet, or
    /// [`RECORD_EVERY_DAYS`] have passed since the last. A date before the last one is not, though [`Timeline::record`]
    /// takes a record of it: only the lists read again tell an older save of the career from a date read while the game
    /// was loading one.
    pub fn due_later(&self, date: FmDate) -> bool {
        self.last_date().is_none_or(|last| date >= last.plus_days(RECORD_EVERY_DAYS))
    }

    /// Takes the record of the game's date `date`, when one is due, from the players as the lists have them (their
    /// UIDs and [`timeline_values`]), and gives the bytes to add to the end of the file. One is due when there is
    /// none yet, when [`RECORD_EVERY_DAYS`] have passed since the last, and when `date` is before the last: the game
    /// has gone back to an older save, and the records of the days after it are dropped. None without players.
    pub fn record(
        &mut self,
        date: FmDate,
        at: u64,
        players: impl IntoIterator<Item = (u32, Vec<Option<i32>>)>,
    ) -> Option<Vec<u8>> {
        let full = match self.last_date() {
            None => true,
            Some(last) if date < last => true,
            Some(last) if date >= last.plus_days(RECORD_EVERY_DAYS) && self.records.len() < MOST_RECORDS => false,
            Some(_) => return None,
        };
        let mut known = vec![None; self.fields.len()];
        let mut changed = Vec::new();
        for (uid, values) in players {
            known.fill(None);
            if !full && let Some(points) = self.players.get(&uid) {
                for point in points {
                    known[usize::from(point.field)] = Some(point.value);
                }
            }
            let mut pairs = Vec::new();
            for (field, value) in values.into_iter().enumerate().take(known.len()) {
                if let Some(value) = value
                    && known[field] != Some(value)
                {
                    pairs.extend([field as i32, value]);
                }
            }
            if !pairs.is_empty() {
                changed.push((uid, pairs));
            }
        }
        if full && changed.is_empty() {
            return None;
        }
        let line = Line { v: VERSION, date, at, full, fields: self.fields.clone(), players: changed };
        self.take(&line);
        encode(&line, Compression::default())
    }

    /// Adds what `line` holds. A whole record drops the records dated on or after it first. One of what changed counts
    /// when it is later than the last record, or of the same date (two copies of the app took it at once); an earlier
    /// one has nothing to be read against, and is skipped.
    fn take(&mut self, line: &Line) {
        if line.v != VERSION {
            return;
        }
        if line.full {
            self.repeats |= !self.records.is_empty();
            self.drop_from(line.date);
        }
        let record = match self.records.last() {
            Some(&last) if line.date == last => self.records.len() - 1,
            Some(&last) if line.date < last => return,
            None if !line.full => return,
            _ if self.records.len() >= MOST_RECORDS => return,
            _ => {
                self.records.push(line.date);
                self.taken.push(line.at);
                self.records.len() - 1
            }
        };
        // Fewer than `MOST_RECORDS`: the index fits.
        let record = record as u16;
        let fields: Vec<Option<u8>> = line
            .fields
            .iter()
            .map(|name| self.fields.iter().position(|field| field == name).and_then(|at| u8::try_from(at).ok()))
            .collect();
        for (uid, pairs) in &line.players {
            let points = self.players.entry(*uid).or_default();
            for &[at, value] in pairs.as_chunks::<2>().0 {
                let field = usize::try_from(at).ok().and_then(|at| fields.get(at).copied().flatten());
                if let Some(field) = field {
                    points.push(Point { record, field, value });
                }
            }
        }
    }

    /// Drops the records dated `date` or later, and what they hold.
    fn drop_from(&mut self, date: FmDate) {
        let keep = self.records.partition_point(|&record| record < date);
        if keep == self.records.len() {
            return;
        }
        self.records.truncate(keep);
        self.taken.truncate(keep);
        self.players.retain(|_, points| {
            points.retain(|point| usize::from(point.record) < keep);
            !points.is_empty()
        });
    }

    /// Which records thinning keeps (see [`Timeline::thin`]): all of those of the last [`KEEP_ALL_DAYS`] days up to the
    /// last record, and before them the first, then each one at least [`THINNED_EVERY_DAYS`] after the one kept before.
    fn kept(&self) -> Vec<bool> {
        let Some(&last) = self.records.last() else {
            return Vec::new();
        };
        let recent = last.plus_days(-KEEP_ALL_DAYS);
        let mut before: Option<FmDate> = None;
        self.records
            .iter()
            .map(|&date| {
                let keep = date >= recent || before.is_none_or(|kept| date >= kept.plus_days(THINNED_EVERY_DAYS));
                if keep {
                    before = Some(date);
                }
                keep
            })
            .collect()
    }

    /// Whether thinning would leave something out: a record the one just taken has made a year old, or the values of a
    /// whole record of an older save that repeat those before them.
    pub fn thinning_due(&self) -> bool {
        self.repeats || self.kept().contains(&false)
    }

    /// Leaves out the records more than [`KEEP_ALL_DAYS`] older than the last one but about one every
    /// [`THINNED_EVERY_DAYS`] (see [`Timeline::kept`]), and the values that repeat the one before them. What a record
    /// left out holds is held from the next record kept, so that what each player was on every date kept stays as it
    /// was. Returns whether anything was left out.
    pub fn thin(&mut self) -> bool {
        let keep = self.kept();
        // Where each record's values go: the index, among the records kept, of the first one kept on or after it. The
        // last record is always kept.
        let mut target = vec![0u16; keep.len()];
        let mut next = keep.iter().filter(|&&kept| kept).count();
        for (at, &kept) in keep.iter().enumerate().rev() {
            if kept {
                next -= 1;
            }
            target[at] = next as u16;
        }
        let mut left_out = keep.contains(&false);
        let mut place = vec![None::<usize>; self.fields.len()];
        let mut value = vec![None::<i32>; self.fields.len()];
        for points in self.players.values_mut() {
            let mut kept: Vec<Point> = Vec::with_capacity(points.len());
            place.fill(None);
            for point in points.iter() {
                let record = target[usize::from(point.record)];
                let field = usize::from(point.field);
                match place[field] {
                    // Two values in one record kept: the later one holds.
                    Some(at) if kept[at].record == record => kept[at].value = point.value,
                    _ => {
                        place[field] = Some(kept.len());
                        kept.push(Point { record, ..*point });
                    }
                }
            }
            // A value that repeats the one before it adds nothing.
            value.fill(None);
            kept.retain(|point| value[usize::from(point.field)].replace(point.value) != Some(point.value));
            left_out |= kept.len() < points.len();
            kept.shrink_to_fit();
            *points = kept;
        }
        if keep.contains(&false) {
            let mut kept = keep.iter().copied();
            self.records.retain(|_| kept.next().unwrap_or(true));
            let mut kept = keep.iter().copied();
            self.taken.retain(|_| kept.next().unwrap_or(true));
        }
        self.players.shrink_to_fit();
        self.repeats = false;
        left_out
    }

    /// Whether the file read is worth writing anew from the records kept (see [`Timeline::to_bytes`]): reading it left
    /// out at least one in [`REWRITE_SHARE`] of its values, and none of its lines was of another version or did not
    /// read, as writing it anew would lose those.
    pub fn rewrite_due(&self) -> bool {
        !self.unknown && self.left_out > 0 && self.left_out * REWRITE_SHARE >= self.read_values
    }

    /// The records as the lines of a file of their own: the first holding every player it holds whole, each later one
    /// what changed since. What a file is written anew from (see [`Timeline::rewrite_due`]).
    pub fn to_bytes(&self) -> Option<Vec<u8>> {
        let mut uids: Vec<u32> = self.players.keys().copied().collect();
        uids.sort_unstable();
        let mut bytes = Vec::new();
        for (index, (&date, &at)) in self.records.iter().zip(&self.taken).enumerate() {
            let record = index as u16;
            let players = uids
                .iter()
                .filter_map(|uid| {
                    let points = &self.players[uid];
                    let from = points.partition_point(|point| point.record < record);
                    let pairs: Vec<i32> = points[from..]
                        .iter()
                        .take_while(|point| point.record == record)
                        .flat_map(|point| [i32::from(point.field), point.value])
                        .collect();
                    (!pairs.is_empty()).then_some((*uid, pairs))
                })
                .collect();
            let line = Line { v: VERSION, date, at, full: index == 0, fields: self.fields.clone(), players };
            // A whole file is written while the app connects: level 4 takes a quarter of the default's time (0.7 s
            // against 2.6 s for 45 MB of lines) for a file 8% larger.
            bytes.extend(encode(&line, Compression::new(4))?);
        }
        Some(bytes)
    }

    /// The value of the field `field` of the points `points` at the record `record`: the last one given up to it.
    fn value_at(points: &[Point], field: usize, record: usize) -> Option<i32> {
        points
            .iter()
            .take_while(|point| usize::from(point.record) <= record)
            .filter(|point| usize::from(point.field) == field)
            .last()
            .map(|point| point.value)
    }

    /// How the values of the player `uid` went: the records that hold him, and what he is on `today`, the game's date,
    /// `now` (see [`timeline_values`]). A record of today's date gives way to what he is now: he may have been edited
    /// since it was taken.
    pub fn progress(&self, uid: u32, today: FmDate, now: &[Option<i32>]) -> Progress {
        let points = self.players.get(&uid).map_or(&[][..], Vec::as_slice);
        let records = match points.first() {
            Some(first) => {
                let end = self.records.partition_point(|&record| record < today);
                usize::from(first.record)..end.max(usize::from(first.record))
            }
            None => 0..0,
        };
        let mut dates: Vec<FmDate> = self.records[records.clone()].to_vec();
        dates.push(today);
        let mut series = BTreeMap::new();
        for (field, name) in self.fields.iter().enumerate() {
            let mut values = Vec::with_capacity(dates.len());
            let mut value = None;
            let mut next = points.iter().filter(|point| usize::from(point.field) == field).peekable();
            for record in records.clone() {
                while let Some(point) = next.next_if(|point| usize::from(point.record) <= record) {
                    value = Some(point.value);
                }
                values.push(value);
            }
            values.push(now.get(field).copied().flatten());
            if values.iter().any(Option::is_some) {
                series.insert(name.clone(), values);
            }
        }
        Progress { dates, series }
    }

    /// For each of the players `uids` that a record before `today` holds, his current ability at the record to compare
    /// him with: the oldest of the last `days` days, or the last one where all are older.
    pub fn earlier(&self, uids: &[u32], today: FmDate, days: i64) -> Vec<Earlier> {
        let before = self.records.partition_point(|&record| record < today);
        if before == 0 {
            return Vec::new();
        }
        let from = today.plus_days(-days);
        let oldest = self.records.partition_point(|&record| record < from).min(before - 1);
        let field = self.fields.iter().position(|field| field == CURRENT_ABILITY).unwrap_or(0);
        uids.iter()
            .filter_map(|&uid| {
                let points = self.players.get(&uid)?;
                let record = oldest.max(usize::from(points.first()?.record));
                (record < before).then_some(())?;
                let current_ability = Self::value_at(points, field, record)?;
                Some(Earlier { uid, date: self.records[record], current_ability })
            })
            .collect()
    }
}

/// The bytes `line` takes in a file: its JSON, compressed on its own (see the module's notes) at `level`.
fn encode(line: &Line, level: Compression) -> Option<Vec<u8>> {
    let mut encoder = GzEncoder::new(Vec::new(), level);
    // The line ends as a line does, so that the file, taken out of its compression, is one of lines.
    let mut text = serde_json::to_string(line).ok()?;
    text.push('\n');
    encoder.write_all(text.as_bytes()).ok()?;
    encoder.finish().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(year: u16, month: u8, day: u8) -> FmDate {
        FmDate { year, month, day }
    }

    /// A player's values: his abilities, his value, and two attributes.
    fn values(ca: i32, pa: i32, value: i32, corners: i32, crossing: i32) -> Vec<Option<i32>> {
        vec![Some(ca), Some(pa), Some(value), Some(corners), Some(crossing)]
    }

    fn series(progress: &Progress, field: &str) -> Vec<Option<i32>> {
        progress.series.get(field).cloned().unwrap_or_default()
    }

    #[test]
    fn fields_follow_the_summaries_attributes() {
        let fields = timeline_fields();
        assert_eq!(&fields[..4], ["current_ability", "potential_ability", "value", "corners"]);
        assert!(fields.len() < usize::from(u8::MAX));
    }

    #[test]
    fn records_what_changed_and_reads_it_back() {
        let mut timeline = Timeline::new();
        let mut file = Vec::new();
        let first = timeline.record(
            date(2026, 7, 1),
            1,
            [(7, values(120, 160, 5_000, 10, 12)), (9, values(90, 91, 100, 8, 8))],
        );
        file.extend(first.expect("the first record"));
        // Within a week of the last record none is due.
        assert!(timeline.record(date(2026, 7, 7), 2, [(7, values(121, 160, 5_000, 10, 12))]).is_none());
        // A week on: only what changed, and a new player whole. Player 9 is the same, and is left out.
        let second = timeline.record(
            date(2026, 7, 8),
            3,
            [(7, values(122, 160, 6_000, 10, 13)), (9, values(90, 91, 100, 8, 8)), (11, values(60, 150, 0, 5, 5))],
        );
        file.extend(second.expect("the second record"));
        assert_eq!(timeline.len(), 2);

        let (read, taken) = Timeline::read(&file);
        assert_eq!(taken, file.len());
        assert_eq!(read.len(), 2);
        assert_eq!((read.first_date(), read.last_date()), (Some(date(2026, 7, 1)), Some(date(2026, 7, 8))));
        for timeline in [&timeline, &read] {
            let progress = timeline.progress(7, date(2026, 7, 10), &values(123, 160, 6_000, 10, 13));
            assert_eq!(progress.dates, [date(2026, 7, 1), date(2026, 7, 8), date(2026, 7, 10)]);
            assert_eq!(series(&progress, "current_ability"), [Some(120), Some(122), Some(123)]);
            assert_eq!(series(&progress, "value"), [Some(5_000), Some(6_000), Some(6_000)]);
            assert_eq!(series(&progress, "corners"), [Some(10), Some(10), Some(10)]);
            assert_eq!(series(&progress, "crossing"), [Some(12), Some(13), Some(13)]);
            // An attribute no record holds has no series.
            assert!(!progress.series.contains_key("dribbling"));
            // The new player's begins with the record that first holds him.
            let newcomer = timeline.progress(11, date(2026, 7, 10), &values(60, 150, 0, 5, 5));
            assert_eq!(newcomer.dates, [date(2026, 7, 8), date(2026, 7, 10)]);
            // One no record holds has only what he is now.
            let unknown = timeline.progress(99, date(2026, 7, 10), &values(1, 2, 3, 4, 5));
            assert_eq!(unknown.dates, [date(2026, 7, 10)]);
            assert_eq!(series(&unknown, "current_ability"), [Some(1)]);
        }
    }

    #[test]
    fn a_record_is_due_a_week_on() {
        let mut timeline = Timeline::new();
        assert!(timeline.due_later(date(2026, 7, 1)));
        timeline.record(date(2026, 7, 1), 0, [(7, values(100, 160, 0, 10, 10))]);
        assert!(!timeline.due_later(date(2026, 7, 1)));
        assert!(!timeline.due_later(date(2026, 7, 7)));
        assert!(timeline.due_later(date(2026, 7, 8)));
        // A date before the last record's is not due as the game moves on, though a record of it would be taken.
        assert!(!timeline.due_later(date(2026, 6, 1)));
        assert!(timeline.record(date(2026, 6, 1), 0, [(7, values(90, 160, 0, 10, 10))]).is_some());
    }

    #[test]
    fn todays_record_gives_way_to_what_he_is_now() {
        let mut timeline = Timeline::new();
        timeline.record(date(2026, 7, 1), 1, [(7, values(120, 160, 5_000, 10, 12))]);
        let progress = timeline.progress(7, date(2026, 7, 1), &values(200, 200, 5_000, 20, 20));
        assert_eq!(progress.dates, [date(2026, 7, 1)]);
        assert_eq!(series(&progress, "current_ability"), [Some(200)]);
    }

    #[test]
    fn an_older_save_drops_the_days_after_it() {
        let mut timeline = Timeline::new();
        let mut file = Vec::new();
        for (day, ca) in [(1, 100), (8, 101), (15, 102)] {
            file.extend(timeline.record(date(2026, 7, day), 0, [(7, values(ca, 160, 0, 10, 10))]).expect("due"));
        }
        // The game went back to 10 July: the record is whole, and the one of 15 July is gone.
        file.extend(timeline.record(date(2026, 7, 10), 0, [(7, values(105, 160, 0, 10, 10))]).expect("due"));
        let (read, _) = Timeline::read(&file);
        for timeline in [&timeline, &read] {
            assert_eq!(timeline.len(), 3);
            let progress = timeline.progress(7, date(2026, 7, 12), &values(105, 160, 0, 10, 10));
            assert_eq!(progress.dates, [date(2026, 7, 1), date(2026, 7, 8), date(2026, 7, 10), date(2026, 7, 12)]);
            assert_eq!(series(&progress, "current_ability"), [Some(100), Some(101), Some(105), Some(105)]);
        }
        // The same day again: nothing is due.
        assert!(timeline.record(date(2026, 7, 10), 0, [(7, values(105, 160, 0, 10, 10))]).is_none());
    }

    #[test]
    fn a_record_cut_short_is_left_out() {
        let mut timeline = Timeline::new();
        let mut file = timeline.record(date(2026, 7, 1), 0, [(7, values(100, 160, 0, 10, 10))]).expect("due");
        let whole = file.len();
        let second = timeline.record(date(2026, 7, 8), 0, [(7, values(101, 160, 0, 10, 10))]).expect("due");
        file.extend(&second[..second.len() / 2]);
        let (read, taken) = Timeline::read(&file);
        assert_eq!((read.len(), taken), (1, whole));
        assert!(Timeline::read(b"not a record").0.is_empty());
    }

    #[test]
    fn compares_with_the_oldest_record_of_the_last_days() {
        let mut timeline = Timeline::new();
        timeline.record(date(2025, 1, 1), 0, [(7, values(90, 160, 0, 10, 10))]);
        timeline.record(date(2026, 3, 1), 0, [(7, values(100, 160, 0, 10, 10)), (9, values(50, 60, 0, 1, 1))]);
        timeline.record(date(2026, 6, 1), 0, [(7, values(110, 160, 0, 10, 10)), (9, values(50, 60, 0, 1, 1))]);
        // Within the last year the oldest record is the one of March; player 11 is in none.
        let earlier = timeline.earlier(&[7, 9, 11], date(2026, 7, 1), 365);
        assert_eq!(
            earlier,
            [
                Earlier { uid: 7, date: date(2026, 3, 1), current_ability: 100 },
                Earlier { uid: 9, date: date(2026, 3, 1), current_ability: 50 },
            ]
        );
        // All older than the days asked for: the last one.
        assert_eq!(timeline.earlier(&[7], date(2026, 7, 1), 10)[0].date, date(2026, 6, 1));
        // A record of today is not one to compare with.
        assert_eq!(timeline.earlier(&[7], date(2026, 6, 1), 365)[0].date, date(2026, 3, 1));
        assert!(timeline.earlier(&[7], date(2025, 1, 1), 365).is_empty());
    }

    #[test]
    fn a_whole_record_of_an_older_save_keeps_only_what_changed() {
        let mut timeline = Timeline::new();
        for (day, ability) in [(1, 100), (8, 101), (15, 102)] {
            let players = [(7, values(ability, 160, 0, 10, 10)), (9, values(50, 60, 0, 1, 1))];
            timeline.record(date(2026, 7, day), 0, players).expect("due");
        }
        assert!(!timeline.thinning_due());
        // The game went back to 10 July: the whole record taken then repeats all but one value.
        let players = [(7, values(105, 160, 0, 10, 10)), (9, values(50, 60, 0, 1, 1))];
        timeline.record(date(2026, 7, 10), 0, players).expect("due");
        assert!(timeline.thinning_due());
        let before = timeline.progress(7, date(2026, 7, 12), &values(105, 160, 0, 10, 10));
        assert!(timeline.thin());
        assert!(!timeline.thinning_due());
        assert_eq!(timeline.progress(7, date(2026, 7, 12), &values(105, 160, 0, 10, 10)), before);
        // Player 7: his five values, his ability on 8 July and on 10 July; player 9: his five values.
        assert_eq!((timeline.players[&7].len(), timeline.players[&9].len()), (7, 5));
    }

    #[test]
    fn a_point_takes_eight_bytes() {
        assert_eq!(std::mem::size_of::<Point>(), 8);
    }

    /// Two years of weekly records of player 7, from 1 January 2025, and the file they make: his current ability one
    /// higher every week, his crossing up and down by one every other week, his corners always the same. With what he
    /// was each week: (date, current ability, crossing).
    fn two_years() -> (Timeline, Vec<u8>, Vec<(FmDate, i32, i32)>) {
        let mut timeline = Timeline::new();
        let mut file = Vec::new();
        let mut truth = Vec::new();
        for week in 0..105 {
            let day = date(2025, 1, 1).plus_days(7 * week);
            let (ability, crossing) = (100 + week as i32, 10 + (week % 2) as i32);
            file.extend(timeline.record(day, 0, [(7, values(ability, 160, 0, 10, crossing))]).expect("due"));
            truth.push((day, ability, crossing));
        }
        (timeline, file, truth)
    }

    /// Checks that the records of `timeline` say what player 7 was on each of their dates, as `truth` has it.
    fn holds_what_he_was(timeline: &Timeline, truth: &[(FmDate, i32, i32)]) {
        let today = truth[truth.len() - 1].0.plus_days(1);
        let progress = timeline.progress(7, today, &values(0, 0, 0, 0, 0));
        let (abilities, crossings) = (series(&progress, "current_ability"), series(&progress, "crossing"));
        for (at, day) in progress.dates.iter().enumerate().take(progress.dates.len() - 1) {
            let &(_, ability, crossing) =
                truth.iter().find(|(then, ..)| then == day).expect("a date he was recorded on");
            assert_eq!((abilities[at], crossings[at]), (Some(ability), Some(crossing)), "on {day:?}");
        }
    }

    #[test]
    fn records_older_than_a_year_are_thinned_to_about_one_a_month() {
        let (mut timeline, _, truth) = two_years();
        let last = truth[truth.len() - 1].0;
        assert!(timeline.thinning_due());
        assert!(timeline.thin());
        assert!(!timeline.thinning_due());
        // Every record of the last year stays; before it the first, then one about every four weeks.
        let recent = last.plus_days(-KEEP_ALL_DAYS);
        let kept = timeline.records.clone();
        assert_eq!((kept.first(), kept.last()), (Some(&truth[0].0), Some(&last)));
        assert!(truth.iter().filter(|(day, ..)| *day >= recent).all(|(day, ..)| kept.contains(day)));
        let older: Vec<FmDate> = kept.iter().copied().filter(|&day| day < recent).collect();
        assert!(older.windows(2).all(|pair| pair[1] >= pair[0].plus_days(THINNED_EVERY_DAYS)));
        // 52 weeks before the last year, weeks 0, 4, ..., 48 of them kept; the 53 of the last year.
        assert_eq!((older.len(), kept.len()), (13, 66));
        assert_eq!(timeline.taken.len(), kept.len());
        holds_what_he_was(&timeline, &truth);
        // A value that never changed is held once, and nothing is left out a second time.
        assert_eq!(timeline.players[&7].iter().filter(|point| point.field == 3).count(), 1);
        assert!(!timeline.thin());
    }

    #[test]
    fn a_file_written_anew_reads_back_the_same() {
        let (_, file, truth) = two_years();
        // Read, the file is thinned, and enough of its lines are left out to write it anew.
        let (read, taken) = Timeline::read(&file);
        assert_eq!((taken, read.len()), (file.len(), 66));
        assert!(read.rewrite_due());
        holds_what_he_was(&read, &truth);
        let anew = read.to_bytes().expect("the file written anew");
        assert!(anew.len() < file.len());
        let (again, taken) = Timeline::read(&anew);
        assert_eq!((taken, again.records.clone(), again.taken.clone()), (anew.len(), read.records, read.taken));
        assert!(!again.rewrite_due());
        holds_what_he_was(&again, &truth);
        // Records still follow it.
        let mut again = again;
        let next = truth[truth.len() - 1].0.plus_days(RECORD_EVERY_DAYS);
        assert!(again.record(next, 0, [(7, values(205, 160, 0, 10, 11))]).is_some_and(|bytes| !bytes.is_empty()));
        assert_eq!(again.last_date(), Some(next));
    }

    #[test]
    fn a_file_is_written_anew_only_when_enough_of_it_is_left_out() {
        // Records of the last year only: nothing to leave out.
        let mut timeline = Timeline::new();
        let mut file = Vec::new();
        for week in 0..20 {
            let day = date(2026, 1, 1).plus_days(7 * week);
            file.extend(timeline.record(day, 0, [(7, values(100 + week as i32, 160, 0, 10, 10))]).expect("due"));
        }
        assert!(!Timeline::read(&file).0.rewrite_due());
        // An older save loaded: a whole record of week 11's date leaves out the nine records from that date on.
        file.extend(
            timeline.record(date(2026, 1, 1).plus_days(7 * 11), 0, [(7, values(90, 160, 0, 10, 10))]).expect("due"),
        );
        // Of its 29 values the nine dropped records' and four that repeat are left out.
        let (read, _) = Timeline::read(&file);
        assert_eq!((read.len(), read.read_values, read.left_out), (12, 29, 13));
        assert!(read.rewrite_due());
        // A line of another version is not to be lost.
        let other = Line {
            v: VERSION + 1,
            date: date(2026, 6, 1),
            at: 0,
            full: false,
            fields: Vec::new(),
            players: Vec::new(),
        };
        file.extend(encode(&other, Compression::default()).expect("a line"));
        assert!(!Timeline::read(&file).0.rewrite_due());
    }
}
