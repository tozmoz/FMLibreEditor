# FM27: where the game keeps the season's statistics

Notes behind the Season tab of a player's profile. They were read from the Mac Steam build
(arm64), on the "Tyrone Demarcus - Arsenal" save at 15 November 2026, with the probe and a few
scratch searches. FMRTE 27 showed the same save at the same date: its figures for Arda Güler
were the reference.

## Finding them

Nothing the editor already reads points at the statistics: Arda's player object has six
pointers to it (the global arrays and two squad lists), and the records do not hold his UID.

The game binary keeps C++ type names (`15GAME_COMP_STATS`, `N2db4TEAME`). On macOS a type
info's second word points at the name, and a vtable's slot before its functions points at the
type info, after an offset to the top of the object (0 for a whole object). So a class's
vtables can be found from its name, and its objects by searching the heap for a vtable. The
names that mention statistics include `GAME_COMP_STATS`, `GAME_MATCH_PLAYER_STATS`,
`GAME_PLAYER_SEASON_KEY_STATS`, `PLAYER_STATS_MANAGER` and `OFFICIAL_STATS_MANAGER`.

- `GAME_MATCH_PLAYER_STATS`: 21,517 objects of 0x110 bytes, one per player per match, but only
  for recent matches. Arda had ten, copies of four matches.
- `GAME_COMP_STATS`: 235 objects of 0x1318 bytes, one per competition the game keeps statistics
  for, in one array. These hold the season.

Finding the 235 objects takes about 1.3 s, a pass over the 4.6 GB the game has allocated.
Reading every player's record after that takes about 35 ms (40,166 records).

## A competition's statistics (`GAME_COMP_STATS`)

| Offset | Field |
| --- | --- |
| `+0x7B8` | pointer to the competition, `db::COMP` |
| `+0x1278` | `(begin, end, capacity)` of pointers to the players' records |
| `+0x12A8` | the rows of the league table: empty for a cup |
| `+0x12C0` | the teams' records: empty for a stage of another competition |

A stage holds the records of its parent's players a second time: "European International
League Division A" repeats Arda's five caps that "European International League" holds. Only
competitions with teams' records are counted.

The competition (`db::COMP`, 0x1B0 bytes, 8,220 of them):

| Offset | Field |
| --- | --- |
| `+0x40` | full name, FM string: "English FA Cup" |
| `+0x48` | short name: "FA Cup" |
| `+0x58` | the continent |
| `+0x60` | the nation; null for a continental or international competition |
| `+0xB0` | the game's object for it: `sicomps::ACTUAL_COMP`, `RESERVE_CHILD_COMP` for a reserve or youth league, `FRIENDLY_ACTUAL_COMP` for friendlies |

From the game's object, `+0x138` points back at the competition and `+0x390` at its statistics.

The kind of a competition, as the Season tab splits a season:

- **international**: the record's team is a national team (`db::NATIONAL_TEAM`);
- **continental**: no nation;
- **league**: a nation, and a league table or a reserve league;
- **cup**: a nation and neither.

Friendlies are left out.

## A player's record

0xAC bytes. The records sit one after another, so half of them start 4 bytes past a multiple
of 8. Counts are `u16` unless the table says otherwise. Arda's four club competitions, with
FMRTE's totals for the same competitions:

| Offset | Field | PL | UCL | Carabao Cup | Shield | Sum | FMRTE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `+0x00` | `u32` person id (player `+0x390`) | 25883 | | | | | |
| `+0x04` | `u32` team id (team `+0x08`) | 461 | 461 | 461 | 461 | | Arsenal |
| `+0x08` | ratings added up, tenths | 667 | 202 | 138 | 67 | 1074 | 6.71 over 16 |
| `+0x0A` | `u8` appearances | 10 | 3 | 2 | 1 | 16 | 16 |
| `+0x0B` | `u8` rated appearances | 10 | 3 | 2 | 1 | 16 | 16 rated |
| `+0x0C` | `u8` goals | 1 | 0 | 0 | 0 | 1 | 1 |
| `+0x0D` | `u8` goals let in as goalkeeper | | | | | | |
| `+0x18` | `f32` xG | 2.12 | 0.80 | 0.24 | 0 | 3.16 | 3.17 |
| `+0x1C` | `f32` xA | 0.73 | 0.25 | 0.30 | 0.04 | 1.32 | 1.33 |
| `+0x24` | `f32` non-penalty xG | 2.12 | 0.80 | 0.24 | 0 | 3.16 | 3.17 |
| `+0x34` | minutes | 613 | 201 | 180 | 27 | 1021 | 1021 |
| `+0x38` | passes | 388 | 119 | 106 | 10 | 623 | |
| `+0x3A` | passes completed | 333 | 108 | 99 | 8 | 548 | 88.0% |
| `+0x3C` | tackles | 5 | 0 | 2 | 0 | 7 | 7 |
| `+0x3E` | tackles won | 4 | 0 | 2 | 0 | 6 | 6 |
| `+0x40` | dribbles | 8 | 1 | 4 | 1 | 14 | 1.23 per 90 |
| `+0x42` | shots | 15 | 7 | 3 | 0 | 25 | 25 |
| `+0x44` | shots on target | 7 | 4 | 1 | 0 | 12 | 12 |
| `+0x46` | fouls made | 10 | 3 | 2 | 0 | 15 | 15 |
| `+0x48` | fouls won | 5 | 1 | 3 | 0 | 9 | 9 |
| `+0x4A` | distance, hundreds of metres | 904 | 284 | 267 | 45 | 1500 | 13.2 km per 90 |
| `+0x58` | key passes | 12 | 4 | 3 | 1 | 20 | 20 |
| `+0x5A` | key tackles | 1 | 0 | 0 | 0 | 1 | 0.09 per 90 |
| `+0x5E` | interceptions | 11 | 2 | 5 | 1 | 19 | 1.67 per 90 |
| `+0x68` | headers | 9 | 1 | 2 | 0 | 12 | 12 |
| `+0x6A` | headers won | 3 | 0 | 0 | 0 | 3 | 3 |
| `+0x6C` | headers lost | 6 | 1 | 2 | 0 | 9 | 9 |
| `+0x70` | clear-cut chances created | 1 | 1 | 1 | 0 | 3 | 3 |
| `+0x72` | blocks | 5 | 1 | 0 | 0 | 6 | 0.53 per 90 |
| `+0x76` | possession won | 26 | 9 | 12 | 2 | 49 | 4.32 per 90 |
| `+0x78` | possession lost | 73 | 18 | 13 | 3 | 107 | 9.43 per 90 |
| `+0x7A` | clearances | 5 | 0 | 0 | 0 | 5 | 0.44 per 90 |
| `+0x7C` | shots on target faced, as goalkeeper | | | | | | |
| `+0x7E` | progressive passes | 25 | 2 | 3 | 0 | 30 | 30 |
| `+0x80` | sprints | 72 | 20 | 17 | 7 | 116 | 10.2 per 90 |
| `+0x82` | pressures | 29 | 6 | 11 | 1 | 47 | 47 |
| `+0x84` | pressures won | 7 | 2 | 4 | 1 | 14 | 14 |
| `+0x86` | open-play key passes | 11 | 3 | 3 | 0 | 17 | 17 |
| `+0x95` | `u8` appearances off the bench | 2 | 0 | 0 | 1 | 3 | 3 |
| `+0x9A` | `u8` assists | 1 | 1 | 0 | 0 | 2 | 2 |
| `+0x9F` | `u8` yellow cards | 0 | 1 | 0 | 0 | 1 | 1 |
| `+0xA0` | `u8` red cards | | | | | 0 | 0 |
| `+0xA1` | `u8` Player of the Match | | | | | 0 | 0 |
| `+0xA6` | `u8` best and worst rating, tenths | 75, 60 | 72, 64 | 69, 69 | 67, 67 | | |

The Carabao Cup and the Community Shield together are FMRTE's cups: 3 appearances, 207
minutes, 6.83. Arda's fifth record, for Türkiye in the European International League (team
652, a `db::NATIONAL_TEAM`), has the 5 caps and 450 minutes FMRTE lists apart.

FMRTE's xG and xA are a hundredth above these sums; they may be added up from the matches.

The fields FMRTE does not show were told by the whole Premier League's 431 records (100
matches): goals let in add up to the goals scored; shots on target faced add up to the shots
on target; headers won and lost add up to the headers; appearances off the bench leave 2,200
starts (22 a match); Player of the Match is 100; yellow cards are 3.7 a match. Red cards (5)
and key tackles are the least certain.

The other bytes, not used: `+0x0E` is 1 in every record; `+0x10` and `+0x88..+0x8F` look like
flags; `+0x4C..+0x56`, `+0x5C`, `+0x60..+0x66` (goalkeepers only), `+0x6E`, `+0x9B..+0x9E` and
`+0xA2` are counts not yet named.

## Teams and people

- The person id is the `u32` before the UID in the player's identity block (`+0x390` on
  macOS). All 431 Premier League records name a player that way.
- The team id is the `u32` at `+0x08` of a team. A club's team points at its club at `+0x30`;
  a national team points there at a container (`db::NATIONAL_TEAM_CONTAINER`), whose `+0x170`
  is the nation.

## Not yet

- Windows: the game's Windows builds keep MSVC's type descriptors, which the editor does not
  read for this yet, and the offsets above are unchecked there. The Season tab says so.
- The x86_64 half of the Mac build (Rosetta) shares the layout, but was not run.
