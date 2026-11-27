# FM27: nations and their national teams

Notes towards a tab for national teams (#169). They were read on the Mac Steam build 26385295 (27.0.1, Apple
silicon), on a save of 14 September 2026 with the game in Italian, with the probe only: nothing here was written to
the game. Italia's men's team was then checked against the game's own screens (see [Checked in the
game](#checked-in-the-game)).

## In short

A national team is not a club. The clubs array the Clubs tab reads holds none of them, so the tab cannot show them.
Each nation has two objects of their own, one for its men's teams and one for its women's, of the class
`db::NATIONAL_TEAM_CONTAINER`. Each holds a list of teams that are laid out like a club's teams (`[team]`): the same
kind, age limit, players, manager, captains and reputation. So most of what the club profile reads of a team, and its
Squad tab, would read a national team as it is.

```text
game_plugin+0x576eef8 ─> (begin, end) of 251 containers, the men's
game_plugin+0x576ef10 ─> (begin, end) of 251 containers, the women's

db::NATIONAL_TEAM_CONTAINER  +0x18 teams ─> db::NATIONAL_TEAM (laid out as [team])
                             +0x170      ─> db::NATION
db::NATION                   +0x110 men's container, +0x118 women's container
```

## Nations (`db::NATION`)

There are 251 of them, 0x208 bytes each, one after another in memory (`fmlibre-probe instances db::NATION`). The
editor so far only knew `uid` and `name`, from the people's `nation` pointers.

| Offset | Field |
| --- | --- |
| `+0x0C` | `u32` UID (Algeria 5, Inghilterra 765, Italia 776, Brasile 1651) |
| `+0x18` | name, an FM string ("Italia") |
| `+0x20` | short name; the same as the name for the nations looked at |
| `+0x28` | three-letter code ("ITA", "ENG", "SMR") |
| `+0x30` | nationality adjective ("italiano", "sammarinese") |
| `+0xF0` | pointer to its capital (`db::CITY`) |
| `+0xF8` | pointer to its continent (`db::CONTINENT`) |
| `+0x100` | pointer to its region (`db::REGION`) |
| `+0x108` | pointer to its currency (`db::CURRENCY_RECORD`) |
| `+0x110` | pointer to the container of its men's teams |
| `+0x118` | pointer to the container of its women's teams |
| `+0x1EC` | `u32`, its population: Italia 58,952,704, Brasile 211,998,573, San Marino 33,977 |

All 251 nations have both containers. From `+0x180` to `+0x200` there are more numbers (counts, four `f32`, small
bytes that could be ratings) that differ from nation to nation. Which of them the game shows, and where, can only be
told against its nation screens.

## Containers (`db::NATIONAL_TEAM_CONTAINER`)

There are 502 of them, 0x8A0 bytes each: 251 men's and 251 women's. Two arrays in the game plugin's writable data,
next to the players', staff's and clubs' arrays, each hold the 251 of one kind. The probe's `scan` does not list
them, since it only looks for arrays of 500 elements or more.

| Offset | Field |
| --- | --- |
| `+0x0C` | `u32` UID: the nation's for the men's (Algeria 5), its own for the women's (2000169518) |
| `+0x18` | the teams, `(begin, end, capacity)` of pointers; the first is the senior team |
| `+0x60`, `+0x78`, `+0x90` | its medical, coaching and scouting staff, where a club keeps them: Italia's physiotherapists (2), its coaches, goalkeeping coaches and fitness coaches of every team (16), and its scout and chief scout (2) |
| `+0xB9` | `u8`, 1 for a women's container, as a club's `women`: 0 at all 251 of the first array, 1 at all 251 of the second |
| `+0x170` | pointer back to its nation, at all 502 |
| `+0x1C8` | the clubs of the nation (Algeria: 20 clubs, among them Mouloudia Club d'Alger and Jeunesse Sportive de Kabylie) |
| `+0x870` | `u16`, the year its federation was founded (Italia 1898, Inghilterra 1863, Brasile 1914, Algeria 1962), the same in both containers of a nation; 0 at 50 of the 502 |

Past `+0x18`, a container is not laid out like a club: where a club has its name (`+0xC0`), a container has a list.
Its name is its nation's.

## National teams (`db::NATIONAL_TEAM`)

There are 3,586 of them, 0x108 bytes each (a club's team takes 0xB8). The fields of `[team]` read as they do for a
club's team:

| Offset | Field | Italia, senior team |
| --- | --- | --- |
| `+0x28` | kind | 0 |
| `+0x2C` | age limit | 100 |
| `+0x30` | pointer to its container, where a club's team points at its club | the men's container of Italia |
| `+0x38` | its players, `(begin, end, capacity)` of pointers | 23, from Donnarumma, Di Lorenzo, Bastoni, Mancini |
| `+0x80` | its manager, a member of staff | Roberto Mancini |
| `+0x88`, `+0x90` | its captain and vice-captain, pointers as a club's team holds them | Donnarumma, Barella |
| `+0xA8` | reputation, `u16` | 8500 |

The players are the squad the game shows for the team (see below). A player in the list still plays for his club's
team: his own `team` pointer still leads there (Donnarumma's to Manchester City's).

Across the save:

- Every men's container but one starts with a team of kind 0, its senior team, which points back at it. The one
  without is The United Kingdom of Great Britain and Ireland, which only has six other teams (kinds 9, 33, 10, 18,
  11, 12). The women's 251 all start with a senior team.
- The men's senior teams have a manager at 219 of 251, a captain at 136 and a vice-captain at 123; the women's at
  199, 121 and 99. They call up 0 to 40 players (median 9; 54 call up none). The women's call up 0 to 23 (102 call up
  none).
- The men's senior reputations run from 1 to 9,750: Francia and Spagna 9,750, Inghilterra 9,600, Argentina 9,400,
  Brasile 9,200. The women's run up to 9,950.
- The other kinds, with the age limits they had: 3 (none), 9 (23 or none), 10 (21 or none), 11 (19 or none), 12
  (none), 18 (20 or none) and 33 (none). See [Youth teams](#youth-teams) for their names and a count on a later save.
- The game plugin also keeps two arrays of national teams: 1,770 of the men's teams (`+0x576f0c8`) and 1,772 of the
  women's (`+0x576f170`). The array of every team (`+0x576f038`, 68,234) holds 3,542 national teams with the clubs'.

The game names more classes about national teams, among them `db::NATIONAL_TEAM_SQUAD_SELECTION_MONEY_INFO`,
`NATION_CALLUP_EDIT_SESSION` and `NATIONAL_SQUAD_SELECTION_EDIT_SESSION`. Calling a player up is likely more than
adding him to the team's list, and was not looked at.

## Checked in the game

With the game open on the same day, on Italia (Maschile), and nothing written:

- The game's search finds Italia three times: "Nazionale femminile", "Nazionale maschile" and "Nazione", the two
  containers and the nation.
- **Prima squadra › Rosa Italia** lists "Giocatori Prima squadra (23)": the 23 players of the senior team's list, in
  the order the list holds them, from Donnarumma, Di Lorenzo, Bastoni and Mancini to Acerbi and Scalvini.
- **Prima squadra › Staff** shows Roberto Mancini as the first team's Allenatore, the senior team's `manager`; and
  Silvio Baldini, Carmine Nunziata and Mauro Bianchessi as the managers of the under-21s (kind 10), under-20s (kind
  18) and under-19s (kind 11), each his team's `manager`. The physiotherapists, coaches and scouts it shows are those
  of the container's three lists. Mancini has a contract there (€4.41M a year); the editor reads none for him
  (`staff-member 12523`: contract none), so a national team's manager keeps his contract somewhere else.
- **Generale › Profilo nazione** shows the federation founded in 1898 (container `+0x870`), Classifica Mondiale 15°,
  Reputazione "Mondiale" (a word, not the number), and no main stadium, as the senior team points at none (`+0x78`
  is null).

The captain was not found on these screens: Donnarumma's profile does not say he is Italia's captain.

## In the editor

The Clubs tab's National teams list (#169) reads the containers from the two arrays above, lists each nation's men's
and women's team with the reputation of its senior team, shows the squad as the game lists it (a player's name opens
his profile) and edits the reputation through the same guarded write as a club's. Heal all, Inspire all and Refresh
all act on the players the senior team lists, as in a club's Squad tab (#210). Calling players up, the captains and
the manager's contract are not in it. It works where the build's profile names the two arrays (`[national_teams]`) and
the layout the containers (`[national]`): the Mac build above, and the Windows builds below. On the Mac build and a save
of 19 September 2026,
Italia's men's team lists 26 players now (23 when the notes above were written) from Donnarumma, Di Lorenzo, Bastoni
and Mancini, with a reputation of 8500; all 502 containers read. The men's team of The United Kingdom of Great Britain
and Ireland (UID 145174) has no senior team of kind 0, so it lists with no reputation and an empty squad; the other three
of its four have a senior team that lists no players, with a reputation of 1.

## A nation's details and its federation's staff

For #210, read on the Mac's Steam build 26620374 (Apple silicon), on a save of 28 September 2026 with the game in
Italian, with the probe only (`national-teams italia --details`), then checked against the game's screens on the same
save. Nothing was written.

The game's nation page (**Generale**) of Italia's men's shows, besides what the editor already had: "Federazione
Fondata nel" 1898 (container `+0x870`), and under the name the continent, "Europa". Brasile's says "Sud America",
Inghilterra's "Europa". The continent is the nation's `+0xF8`, a `db::CONTINENT` with these FM strings:

| Offset | Europe's |
| --- | --- |
| `+0x18` | its name in the game's language, "Europa": what the game shows |
| `+0x20` | "EUR" |
| `+0x28` | the adjective, "Europeo" |
| `+0x30` | its confederation's full name |
| `+0x38`, `+0x40` | "EUR_C", "EURO" |

Of the 502 containers, 458 lead to a continent (Africa 114, Asia 94, Europa 114, Nord America 86, Oceania 30, Sud
America 20). The 44 that do not are nations of the past or outside FIFA's, such as Jugoslavia, Unione Sovietica and The
Basque Country. 452 have a founding year, from 1863 (Inghilterra) to 2011.

The page shows no population and no currency, so the editor does not show them. What the nation holds of them: its
population at `+0x1EC` (above), and its currency at `+0x108`, a `db::CURRENCY_RECORD` whose `+0x18` and `+0x20` are
English names ("European Euro", "Euro", also in the Italian game), `+0x30` its symbol ("€") and `+0x38` an `f32`
(1.1641 for the Euro) that may be its value in pounds.

The staff list of the nation's team (**Staff › Tutto lo staff**, column "Incarico in Nazionale") shows 24 people for
Italia's men's: 13 for the senior team, 6 for the under-21s, 4 for the under-20s and 1 for the under-19s. They are:

- each team's manager, the team's `+0x80` (Mancini, Baldini, Nunziata, Bianchessi);
- the 20 people of the container's three lists (`+0x60`, `+0x78`, `+0x90`): 2 physiotherapists, 16 coaches of the
  senior, under-21 and under-20 teams, a scout and the chief scout.

The job the column shows is not the one of a club contract: of the two physiotherapists, Mauro Doimi works for a club
as a physio too, Walter Martinelli has no club, and the editor reads no contract for him (`staff-member 2000125079`).
Each of them has a contract with one of the federation's teams, which the staff object reaches through the record that
follows his contract pointer:

```text
staff object +0x178 ─> record of his other contracts
record       +0x10  ─> his contract with a federation's team (db::BASIC_CONTRACT; a manager's, db::FULL_CONTRACT)
contract     +0x08  owner (his identity block), +0x10 the team (db::NATIONAL_TEAM), +0x26 u8 job, as a club contract
```

For all 24, the job read there and the team it points at are what the game shows: manager (16) Allenatore,
goalkeeping coach (34) Allenatore dei portieri, coach (2) Collaboratore Tecnico, assistant coach (20) Allenatore in
seconda, fitness coach (26) Preparatore atletico, physio (12) Fisioterapista, scout (14) Osservatore, chief scout (44)
Capo Osservatore. Mancini's contract (above, "keeps his contract somewhere else") is the one this record points at.
Over the 502 containers, the managers and the three lists hold 2,090 people at 448 containers, and each of them has
such a contract with one of his container's teams: managers 594, chief scouts 446, assistant coaches 309, physios 186,
goalkeeping coaches 173, coaches 166, fitness coaches 143, scouts 49, head physios 11, set piece coaches 7, heads of
sports science 6.

The game's Italian names job 2 "Collaboratore Tecnico" in this column; the editor's Italian names it "Preparatore"
elsewhere. Which the game uses at a club was not checked.

The national team's profile in the editor shows the founding year, the continent and these people, each with his job
in the national team and his team, read only (`layout-macos.toml`, `[national.details]`). The record's place was only
read on the Mac; on Windows the profile shows none of this.

## Youth teams

On the Mac build and a save of 29 September 2026, with the probe (`national-teams --teams`, `--kinds`):

| Kind | Teams | Age limits | Name in the game |
| --- | --- | --- | --- |
| 0 | 501 | none | Prima squadra |
| 3 | 338 | none | none found |
| 9 | 457 | 23 at 140, none at 317 | U23 |
| 33 | 458 | 22 once, none at the rest | none found |
| 10 | 458 | 21 at 383, none at the rest | U21 |
| 18 | 458 | 20 at 346, none at the rest | U20 |
| 11 | 458 | 19 at 395, none at the rest | U19 |
| 12 | 458 | 18 once, none at the rest | U18 |

An age limit of 255 means none, as 100 does. Italia's men's container holds kinds 0, 9 (23), 33 (22), 10 (21), 18
(20), 11 (19) and 12 (18), in that order. Its women's container holds the same kinds, with players in the senior
team (23), kind 9 (20), kind 18 (21) and kind 11 (15).

With the game open on the same day, and nothing written:

- Italia (Maschile) has the menus Prima squadra, Italia U21, Italia U20, Italia U19 and Italia U18: kinds 10, 18, 11 and
  12. Its teams of kinds 9 and 33 list no players and have no menu.
- Italia (Femminile) has the menus Prima squadra, Italia U23, Italia U20 and Italia U19. Italia U23 › Rosa lists
  "Giocatori Squadra U23 (20)": the 20 players of its team of kind 9.
- No container in the save has a player in a team of kind 3 or 33, and the game showed neither on these screens. The
  editor names them "Type 3" and "Type 33".

The editor lists every team of a container, beside its senior team in the profile, and edits the reputation of each as
`team.<kind>.reputation`. `fmlibre-probe set national-team 776 team.10.reputation 5951 --restore` wrote Italia's U21
reputation (5950), another probe read 5951, and it was put back; `fields national-team --stats` read the 502 with none
implausible. On Windows the same team layout reads (see below), but the youth teams were not checked there.

## On Windows

Read on Game Pass 0.9.2435.0, on a save of 18 January 2028 (English, no women's football), with the probe only:

- The two arrays sit where they do on the Mac, counted from the players' pair: the men's 0xA8 past it
  (`game_plugin.dll+0x53B7E88`), the women's 0xC0 (`+0x53B7EA0`); 251 containers each, the men's from Algeria (UID 5)
  and the women's from UID 2000169482.
- A container (`db::NATIONAL_TEAM_CONTAINER`, 0x898 bytes apart, 0x8A0 on the Mac) holds what the editor reads where the
  Mac's does: its UID at `+0x0C`, its teams at `+0x18`, the women's flag at `+0xB9` (0 at all 251 men's, 1 at all 251
  women's) and its nation at `+0x170`.
- A nation (`db::NATION`, 0x200 bytes apart, 0x208 on the Mac) has its name, short name, code ("ITA") and nationality
  ("Italian") at `+0x18` to `+0x30`, as on the Mac, but everything from its capital on 8 bytes earlier: the capital at
  `+0xE8`, the continent `+0xF0`, the region `+0xF8`, the currency `+0x100`, and its two containers at `+0x108` and
  `+0x110`. Its population is at `+0x1E4` (Italy 58,952,704).
- A national team (`db::NATIONAL_TEAM`) reads as on the Mac and as a club's team: kind `+0x28`, age limit `+0x2C`, its
  container `+0x30`, players `+0x38`, this season's competition `+0x50`, manager `+0x80`, captain and vice-captain
  `+0x88` and `+0x90`, reputation `+0xA8`. Italy's senior team lists 23 players from Donnarumma, Kayode, Bastoni and
  Mancini, with a reputation of 8322; its container lists 7 teams.
- All 502 containers read; the men's team of The United Kingdom of Great Britain and Ireland (145174) has no senior team,
  as on the Mac. `fmlibre-probe fields national-team --stats`: 502 read, reputations 1 to 9,950, none implausible.
  `fmlibre-probe set national-team 776 reputation 8323 --restore` wrote and put back Italy's reputation.

On Steam build 26577676, on a save of 14 October 2026, the arrays sit at the same distances from the players' pair
(`game_plugin.dll+0x58208B8` and `+0x58208D0`), the containers 0x898 bytes apart, and the same layout reads all 502:
Italy's senior team lists 26 players from Donnarumma, Di Lorenzo, Bastoni and Mancini (as on the Mac's save of
September 2026), with a reputation of 8477.

### The youth rating (Windows)

The youth rating the pre-game editor shows for a nation is not in the nation: it is a `u16` of each container, at
`+0x86A`, with a second copy at `+0x86C`. The pre-game editor's values for four nations (San Marino 29, Poland 94,
England 135, France 155) were looked for in the 0x200 bytes of each nation and in the first 0x1000 bytes of every
object it points at, as a `u8`, `u16` and `u32`: only the men's container, `+0x108`, holds all four, at those two
places. The two are equal at all 502 containers; values run from 0 to 165 (Brazil's men 163). A women's container has
a youth rating of its own (England's 161, France's 160, Poland's 103, San Marino's 4). The `i16` at `+0x86E` follows it
(France 9, England -23, Poland -25, San Marino 7); what it is is not known. `fmlibre-probe set national-team 792
youth_rating 30 --restore` wrote both copies of San Marino's and put them back, and so did `set national-team
2000169648 youth_rating 5 --restore` for San Marino's women. The editor writes men's and women's containers alike.

### A nation's settings (Windows)

The pre-game editor's values for England, Poland and San Marino were looked for in the 0x200 bytes of each nation, in the
first 0x1000 bytes of every object it points at, and in the men's container, as `u8` and `u32`: all eight settings were
found, and then read on the 251 men's and 251 women's containers alike.

| key | where | kind | second copy | editor writes | plausible | ENG / POL / SMR (men) |
|---|---|---|---|---|---|---|
| `game_importance` | container `+0x87C` | `u8` | `+0x87D` | 1, 2, 3, 4 | 0 to 4 | 1 / 2 / 2 |
| `fa_financial_power` | container `+0x882` | `u8` | `+0x883` | 0 to 20 | 0 to 20 | 18 / 12 / 4 |
| `fa_patience` | container `+0x885` | `u8` | none | 0 to 20 | 0 to 20 | 8 / 8 / 20 |
| `attendance` | record `+0x68` | `u32` | none | 0 to 250,000 | 0 to 10,000,000 | 80,000 / 50,000 / 1,750 |
| `min_attendance` | record `+0x6C` | `u32` | none | 0 to 250,000 | 0 to 10,000,000 | 50,000 / 25,000 / 500 |
| `max_attendance` | record `+0x70` | `u32` | none | 0 to 250,000 | 0 to 10,000,000 | 100,000 / 55,000 / 4,900 |
| `economic_factor` | nation `+0x1F0` | `u8` | none | 0 to 20 | 0 to 20 | 19 / 16 / 12 |
| `state_of_development` | nation `+0x1EC` | `u8` | none | 1, 2, 3 | 0 to 3 | 1 / 1 / 1 |

A women's container holds the same six container and record fields at the same offsets, with values of its own: England
1 / 18 / 19 and 60,000 / 45,000 / 90,000, Poland 1 / 12 / 15 and 7,000 / 2,000 / 12,000, San Marino 4 / 1 / 0 and
800 / 200 / 1,600 (game importance, financial power, patience, then attendance, least and most). The two nation fields
are the nation's alone, so both containers share them: England 19 / 1, Poland 16 / 1, San Marino 12 / 1. A write from
either team changes what both profiles show.

A container, men's or women's, points at `+0xB0` (0x10 bytes before the women's flag at `+0xB9`) at a record of 0xB0
bytes of its own: a list at `+0x00`, then string pointers, then the attendance triple at `+0x68`. Every one of the 251
men's and 251 women's containers has a non-null one, and in the women's records the least is at most the attendance and
the attendance at most the most (the largest most is 90,000); 4 of the 251 men's records have an attendance outside
their minimum and maximum, as the game keeps them, so the editor does not require the order. The triple was found with
`fmlibre-probe find` on the men's attendance numbers, which led to `+0xB0`, and the values read there match the
pre-game editor's; the women's records were then read at the same offsets. The nation is reached through the pointer at
`container_nation` (`+0x170`), and it must point back at the container through `nation_men` (`+0x108`) for a men's
container, or `nation_women` (`+0x110`) for a women's, before the nation's settings are read.

Each field was confirmed on the running game: `fmlibre-probe set national-team 792 <field> <value> --restore` wrote
and put back all eight of San Marino's men's team; `fmlibre-probe set national-team 2000169648 <field> <value>
--restore` did the same for the six container and record fields of its women's team; `game_importance`, written to 3
without `--restore`, dumped `03 03` at `+0x87C` and `+0x87D` and was set back to 2; and `economic_factor`, written to 13
from the women's team, read 13 on the men's team and was set back to 12.

Game importance and the federation's financial power keep a second copy right after them, equal at all 251 men's and all
251 women's containers; the editor writes both, as it does the youth rating's, and reads both back. The enum codes are
the pre-game editor's: game importance 0 "Not set", 1 "Very important", 2 "Important", 3 "Fairly unimportant", 4
"Unimportant"; state of development 0 "Not set", 1 "Developed state", 2 "Developing state", 3 "Lower developed state".
Game importance is 0 at 23 men's containers, the defunct ones (USSR, Yugoslavia, GDR and so on), and 1, 2, 3 and 4 at
82, 57, 42 and 47; state of development is 1 at 56, 2 at 118 and 3 at 77; `fa_patience` is 0 at 86 men's and 218 women's
containers.

## What a tab could take from this

- A list of nations from the two arrays of containers, each container leading to its nation (name, code, flag by
  UID) and its teams.
- The senior team's reputation, at the place the club profile already edits a club's (`team.reputation`).
- The squad as the club profile's Squad tab shows it, captains included: same lists, same pointers.

## Still to check

- Where the game shows a national team's captain, and what it makes of a changed reputation over a game day; how it
  turns the reputation into words ("Mondiale").
- The world ranking (15 for Italia), which none of the three objects holds as a byte. Where a manager keeps his
  contract is now known (see [A nation's details](#a-nations-details-and-its-federations-staff)).
- A nation's details and its federation's staff on Windows, and whether the game's Italian names job 2 "Preparatore"
  anywhere.
- The two arrays' places on the Mac's Steam build 26577676 and on the Intel Macs (Windows Game Pass 0.9.2435.0 and
  Steam build 26577676 are read: see [On Windows](#on-windows)).
- The names of team kinds 3 and 33, and what the numbers from `+0x180` of a nation are.
- Which of the youth rating's two copies the game reads, what it makes of a changed one over a season and at its youth
  intakes, and where the Mac keeps it.
- The `u8` at container `+0x884`, between the financial power's copy and `fa_patience`: 17 to 21 across the nations
  (England 20, Poland and San Marino 21); what it is is not known.
- What a national team's 0x50 bytes past a club team's end hold.
