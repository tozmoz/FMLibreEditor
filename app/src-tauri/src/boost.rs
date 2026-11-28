//! Match boost: every attribute of a team's players at its best for one day of the game, a match day, and put back as
//! it was once that day is over. What a boost is, and the rules that decide what becomes of it; the app's connection
//! (`Connection` in lib.rs) reads and writes the game.

use std::cmp::Ordering;
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// A player whose attributes the editor gave their best for one day of the game: the day, and what each attribute was
/// before, as stored. Once the day is over the editor puts each back where the game still holds it better (see `tick`
/// and `settle`). It is kept once it is over too: a save made during it holds its values, and loading that save on its
/// day brings it back.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Boost {
    /// The game's day it was given on, as a number like 20261019.
    pub day: i64,
    /// What each attribute was, as stored, by key: those it holds and puts back.
    pub originals: BTreeMap<String, i64>,
    /// What each attribute the user wrote himself while it held was before it: let go of, it keeps what he wrote. An
    /// undo that writes its best back, as before his change, has it boosted again.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub released: BTreeMap<String, i64>,
    /// Whether it holds now: false once it was put back, or found not to be in the game.
    pub active: bool,
}

impl Boost {
    /// The user wrote `value` to the attribute `key`, whose best is `best`: a value other than its best is his, and
    /// the boost lets go of the attribute; its best, as an undo of his change writes back, has it boosted again. Says
    /// whether anything changed.
    pub fn written(&mut self, key: &str, value: i64, best: i64) -> bool {
        let (from, to) = if value == best {
            (&mut self.released, &mut self.originals)
        } else {
            (&mut self.originals, &mut self.released)
        };
        match from.remove(key) {
            Some(original) => {
                to.insert(key.to_owned(), original);
                true
            }
            None => false,
        }
    }
}

/// How much of a boost the game holds now, among the attributes it raised: those that were not at their best before.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Seen {
    All,
    Some,
    None,
}

impl Seen {
    /// From what each attribute of a boost was before it, is now and is at its best, as stored.
    pub fn of(values: impl IntoIterator<Item = (i64, i64, i64)>) -> Self {
        let (mut raised, mut held) = (0, 0);
        for (before, now, best) in values {
            if before != best {
                raised += 1;
                if now == best {
                    held += 1;
                }
            }
        }
        match held {
            0 => Seen::None,
            _ if held == raised => Seen::All,
            _ => Seen::Some,
        }
    }
}

/// What becomes of a boost.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Settle {
    /// It holds: its attributes stay at their best until its day is over.
    Hold,
    /// Each attribute goes back to what it was, where the game holds it better than that; then the boost is over.
    PutBack,
    /// It is over, and nothing is written.
    End,
    /// It stays as it is.
    Keep,
}

/// What the hold does with a boost that holds, every little while, when the game's day is `today` and no save was
/// loaded since the lists were read: holds it through its day, and puts it back once the game has moved on from it. A
/// day before it, which only a load brings, is left for the lists to be read again (see `settle`).
pub fn tick(boost: &Boost, today: i64) -> Settle {
    match today.cmp(&boost.day) {
        Ordering::Equal => Settle::Hold,
        Ordering::Greater => Settle::PutBack,
        Ordering::Less => Settle::Keep,
    }
}

/// What becomes of `boost` once the lists were read again, on connecting or a reload, when the game's day is `today`
/// and the game holds `seen` of it. The game may have loaded another save of the career since: one of the boost's day,
/// made before it (nothing raised) or during it; one of an earlier day; or one of a later day, played on to while the
/// app was closed.
pub fn settle(boost: &Boost, today: i64, seen: Seen) -> Settle {
    match today.cmp(&boost.day) {
        // Its day: while the game holds all of it, it goes on until the day is over. Otherwise what the game holds of
        // it goes back, as what each attribute was before it is that day's own.
        Ordering::Equal if seen == Seen::All => Settle::Hold,
        Ordering::Equal => Settle::PutBack,
        // A later day, played on to with the app closed: what the game still holds of it goes back.
        Ordering::Greater if boost.active && seen != Seen::None => Settle::PutBack,
        // An earlier day, or a later one with nothing of it: there is nothing to put back.
        _ if boost.active => Settle::End,
        _ => Settle::Keep,
    }
}

/// Whether `now` is better than `then`: higher, or lower where lower is better.
pub fn better(lower_is_better: bool, now: i64, then: i64) -> bool {
    if lower_is_better { now < then } else { now > then }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DAY: i64 = 20_261_019;

    fn boost(active: bool) -> Boost {
        let originals = BTreeMap::from([("attribute.finishing".to_owned(), 60)]);
        Boost { day: DAY, originals, released: BTreeMap::new(), active }
    }

    #[test]
    fn what_the_user_writes_is_his_until_an_undo_writes_the_best_back() {
        let mut boost = boost(true);
        // He types 14 over the boosted 20: the boost lets go of finishing, and will not put it back.
        assert!(boost.written("attribute.finishing", 70, 100));
        assert!(boost.originals.is_empty() && boost.released["attribute.finishing"] == 60);
        // Another value of his own changes nothing more.
        assert!(!boost.written("attribute.finishing", 75, 100));
        // The undo of his change writes 20 back: boosted again, to go back to 12 once the day is over.
        assert!(boost.written("attribute.finishing", 100, 100));
        assert!(boost.released.is_empty() && boost.originals["attribute.finishing"] == 60);
        // An attribute it never held is none of its business.
        assert!(!boost.written("attribute.pace", 70, 100));
        assert!(!boost.written("attribute.pace", 100, 100));
    }

    #[test]
    fn seen_counts_only_what_the_boost_raised() {
        // Finishing 12 and pace 20 before: pace was at its best already, so only finishing tells.
        assert_eq!(Seen::of([(60, 100, 100), (100, 100, 100)]), Seen::All);
        assert_eq!(Seen::of([(60, 60, 100), (100, 100, 100)]), Seen::None);
        assert_eq!(Seen::of([(60, 100, 100), (70, 95, 100)]), Seen::Some);
        // Injury proneness is best at 1 (5 stored): 14 before, 1 now.
        assert_eq!(Seen::of([(70, 5, 5)]), Seen::All);
        // Nothing was raised: nothing of it to see.
        assert_eq!(Seen::of([(100, 100, 100)]), Seen::None);
        assert_eq!(Seen::of([]), Seen::None);
    }

    #[test]
    fn the_hold_puts_a_boost_back_once_its_day_is_over() {
        let active = boost(true);
        assert_eq!(tick(&active, DAY), Settle::Hold);
        assert_eq!(tick(&active, DAY + 1), Settle::PutBack);
        // A month on, as on 1 November after 31 October: the numbers keep the days in order.
        assert_eq!(tick(&Boost { day: 20_261_031, ..active.clone() }, 20_261_101), Settle::PutBack);
        assert_eq!(tick(&active, DAY - 1), Settle::Keep);
    }

    #[test]
    fn a_save_of_the_boosts_day_holds_it_again_or_puts_back_what_it_holds() {
        for active in [true, false] {
            let boost = boost(active);
            assert_eq!(settle(&boost, DAY, Seen::All), Settle::Hold);
            assert_eq!(settle(&boost, DAY, Seen::Some), Settle::PutBack);
            assert_eq!(settle(&boost, DAY, Seen::None), Settle::PutBack);
        }
    }

    #[test]
    fn a_later_day_puts_back_only_a_boost_that_held_and_shows() {
        assert_eq!(settle(&boost(true), DAY + 3, Seen::All), Settle::PutBack);
        assert_eq!(settle(&boost(true), DAY + 3, Seen::Some), Settle::PutBack);
        // Played on from a save made before the boost: nothing of it to put back.
        assert_eq!(settle(&boost(true), DAY + 3, Seen::None), Settle::End);
        // Put back already: a value at its best weeks later is the player's own.
        assert_eq!(settle(&boost(false), DAY + 3, Seen::Some), Settle::Keep);
    }

    #[test]
    fn an_earlier_day_writes_nothing() {
        assert_eq!(settle(&boost(true), DAY - 30, Seen::Some), Settle::End);
        assert_eq!(settle(&boost(false), DAY - 30, Seen::All), Settle::Keep);
    }

    #[test]
    fn better_is_lower_where_lower_is_better() {
        assert!(better(false, 100, 60));
        assert!(!better(false, 60, 60));
        assert!(better(true, 5, 70));
        assert!(!better(true, 70, 5));
    }
}
