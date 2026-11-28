# The game's matches

Where FM27 keeps the matches it has arranged, as read for the boost for the match (#270), and read by the editor
(`crates/fmlibre-core/src/fixtures.rs`). The app reads them only to tell whether a team plays on the game's day: the
squad tab's Boost for the match can be ticked only then. Nothing is written to them.

## Finding them

Every match, a league or cup tie or a friendly, national teams' too, is an object of class `sicomps::FIXTURE`
(`N7sicomps7FIXTUREE` on the Mac). Nothing the editor reads otherwise leads to them, so they are found as the
competitions are for the squad rules: the class's vtable by its name, then the objects in one pass over the game's
memory, about two seconds. The app reads them once per day of the game, the first time a squad tab asks.

On the Arsenal save (Mac Steam build 26797085, Apple silicon, 18 July 2027) there were 16,295, almost all in one
block. A few more sat apart, and some were copies of others or matches of the season before, in blocks the game had
taken back; a copy counts once, and a past match tells nothing of a day to come.

## Layout

| Offset | Meaning |
|---|---|
| +0x00 | vtable |
| +0x08 | pointer to the home team (`db::TEAM`) |
| +0x10 | pointer to the away team |
| +0x20 | pointer to the match's name (`db::FIXTURE_NAME`) |
| +0x28 | pointer to the stadium (`db::STADIUM`) |
| +0x3B | `u8` the round of a league, from 0 (0 to 37 in the Premier League) |
| +0x48 | another date, not known: the league's last day for every league match, 1 January 1900 or a day near the match for a friendly |
| +0x4C | the day it is played on: `u16` day of the year (flags above bit 8), `u16` year |

The flags above the day differ between matches (27 or 37 on Saturdays, 57 midweek), perhaps the kick-off time; the
editor reads only the day.

Arsenal's 48 read as a season's fixtures: friendlies on 22, 26 and 31 July 2027, two more matches on 8 and 11
August, and 38 league matches on Saturdays from 14 August 2027 to 21 May 2028, with the midweek rounds between, each
opponent twice. On that day, 18 matches were to be played, Liverpool against Mainz among them.

`fmlibre-probe matches` lists the matches of the game's day, and `fmlibre-probe matches <club>` each of a club's
teams' matches by day.

## Windows

Not read on Windows. The object holds only pointers and numbers, which MSVC lays out as clang does, so the layout file
places it as on the Mac. The app checks that the first matches it reads point at two teams: where they do not, it
says it cannot read the game's matches, and the box waits.
