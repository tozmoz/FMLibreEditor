# Developing FMLibreEditor

How the editor works, how to build and release it, and how to use the command-line probe.
For installing and using the app, see [INSTALL.md](INSTALL.md).

## Goals

- Attach to a running FM27 and edit players, staff and clubs live, in the spirit of
  FMRTE and FM Live Editor, but free and open source.
- First-class support for the **Game Pass / Microsoft Store** and **Steam** builds; Epic
  later. The **Steam build on macOS** too.
- A modern interface that feels like FM: attribute colours, a pitch position map,
  faces and logos from your installed graphics packs, mass editing with a preview,
  and an undo history.
- Survive game patches: find the game's data again automatically, and fall back to
  read-only whenever something does not check out.

## How it works

FM27's interface is Unity (IL2CPP), but the game itself, its database and
simulation, lives in a native, anti-tamper protected module: `game_plugin.dll`.
FMLibreEditor runs as a separate process and reads that module's heap data with
`ReadProcessMemory`. To edit, it writes values back with `WriteProcessMemory`, into the
game's heap, and into the plugin's own data at one place only: the pool of contracts
(below). It never patches the game's code. It takes memory in the game (`VirtualAllocEx`
on Windows, `mach_vm_allocate` on the game's task port on macOS, see `own_memory.rs`) for
two things: a stadium's name that does not fit the block of the old one, a string laid out
as the game's with a count of holders the game never brings down to nothing, so the game
never hands it to its allocator (see `stadium_name.rs`); and a list with no room for one
more, a player's relations for a tie added (see `relations.rs`), a club's department for
a member of staff (see `staff_move.rs`) or a squad for a player who joins it (see
`transfer.rs`), whose elements it moves there (see `own_memory.rs`). It never gives that
memory back.

A contract for a free agent it signs, or for a member of staff with no club, is the game's
own: the game keeps its contracts in a pool, a static of the plugin that hands out 200-byte
slots and chains the free ones, and the editor takes the first free slot as the game does,
writing the pool's first free slot and its counts (`object_pool.rs`, `signing.rs`,
`staff_move.rs`; `Process::write_static` writes only a module's writable data, never its
code). On Windows it puts no code of its own in the
game; on macOS the game loads one small library of ours, the bridge (see
[On macOS](#on-macos)).

A transfer arranged for the game to make needs memory the game gives back to the C
runtime's `free()` later, which memory of the editor's own would not survive: the move due
on a day (on Windows), and any list larger than the game's own allocator hands out, such as
the transfer manager's list of offers. The editor has the game's C runtime take that memory:
it runs `_strdup` in the game, on a thread of its own, with a string of the size it needs,
unlike any other, and checks the block `_strdup` took by that string; it gives a block back
with the runtime's `free` the same way (`heap.rs`). On Windows that is `ucrtbase.dll`'s,
run with `CreateRemoteThread` (see `Process::call`). macOS has no such call: the editor makes
a bare Mach thread in the game whose registers call `pthread_create_from_mach_thread`, the
one function macOS lets such a thread call, to start a thread like the game's own that runs
the system's `strdup` or `free`; the bare thread then returns to address 0, and its fault
goes to the editor alone, which ends it (`fmlibre-mem`'s `macos/call.rs`). That works on
Apple silicon only: Rosetta does not let a thread's registers be set. These are functions the
game has loaded; the editor writes no code into the game for them. The offer and the
contract of such a transfer go in slots of the game's pools, as above (see `arranged.rs`).
A loan is arranged the same way, with an offer of the game's loan class and a loan contract
(see docs/recon/fm27-loans.md), on Windows and on Apple silicon Macs.
Until the day, the app refuses to move, swap or release the player another way: the game
makes the transfer from the club he is at.

Before every write it checks five things:
- the game still has the save the editor read (see [When the game loads a save](#when-the-game-loads-a-save));
- the object still belongs to the same person;
- the new value is one the field can take;
- the current value looks like that field's (otherwise the layout does not fit);
- the value reads back as written.

If any check fails, nothing changes.

### When the game loads a save

The editor reads the game's lists when it connects, and again when the data is reloaded, and writes to the objects
they found. A save loaded in the game meanwhile, the same one or another, gives the game new objects, mostly at other
places but not always: the lists can stay where they were, with a player of the same UID at the same place in another
career, where a check of the object alone would let a freeze of the other save through. To tell, the editor reads a
count the game keeps (issue #122): its one object of the class `game_plugin::GAME_UI`, which a static of the plugin
points at, counts the saves loaded since the game started (`[game] loads` in `layout.toml`, `+0x100`). Loading a save
adds one; saving does not, as only the code that loads a save writes it. Neither does starting a new game, which the
main menu tells instead: there the lists are empty.

Once the count has changed, or the lists were seen empty, since the editor read them, `Session::save_changed` says so
until they are read again (`Session::recheck`). Meanwhile the editor writes nothing (`Lock::SaveChanged`, which
`field_lock` and `structure_lock` give before any other check), holds nothing frozen, and says so under the masthead,
with Reload data. The names of stadiums renamed in the editor are the one exception, as the game drops them on every
load: their hold checks for itself that the game has a save of the same career (the same human managers), reads the
clubs again where they moved, and only then gives the names back (`Session::vouch_for_save`).

The build profiles place the static (`game_ui`, 0x3C80 before the players pair on both Windows builds of November
2026); a build without a profile finds it as it finds the retirement manager's (below). The Mac keeps the count in the
same object at the same place (read on Steam build 26385295, where loading the save again raised it from 1 to 2).
Copy diagnostics (and `fmlibre-probe diagnostics`) says where the count was read, how it was found and what it is
("Saves loaded"), and its Writing line says when writes wait for Reload data.

### National teams

The Clubs tab lists the nations' national teams behind its National teams switch (`TeamsSwitch`), read from two arrays
of containers in the game plugin's writable data (see [fm27-national-teams.md](recon/fm27-national-teams.md)). Where
they are is a matter of the build, and a build profile names them under `[national_teams]` (`men` and `women`, the RVAs
of their `(begin, end)` pairs); how a container reads is the layout's `[national]` section, in `layout.toml` and
`layout-macos.toml` (the nation points at its containers 8 bytes earlier on Windows). A build whose profile has no
`[national_teams]`, or whose arrays do not read as the game's (a container must point at a nation that points back at
it, with the kind it is in; nearly all of them must), shows a note saying why in place of the list, and reads nothing
else. The profiles that name them:
Game Pass 0.9.2435.0, 0.9.2524.0 and 0.9.2562.0 and Steam builds 26577676, 26620374 and 26797085 on Windows, and
Steam builds 26385295, 26620374 and 26797085 on macOS, Apple silicon. For another build, find the two arrays as the
recon note says (`fmlibre-probe instances db::NATION` leads to the nations, which point at the containers; the arrays
are the two pairs of pointers to them that sit next to the clubs' array: on each of those builds 0xA8 and 0xC0 past
the players' pair, which `fmlibre-probe column game_plugin.dll+<RVA> 0x0C` shows as 251 UIDs each) and add them; the
unit test `only_the_builds_read_place_the_national_teams` lists the builds that have them.

Each container lists the senior team and the youth teams, laid out as a club's teams (`[team]`). A national team's
profile reads them all (`Session::national_sides`) and edits each one's reputation: `reputation` is the senior team's,
`team.<kind>.reputation` the one team of that kind in the container (`Place::NationalTeamOfKind`), for the kinds in
`national::OTHER_KINDS`. A kind two teams of a container share is neither shown nor written. The app names the kinds by
`national.teamKinds` in the languages' files, and a kind missing there as "Type N".

The containers also place the nation's youth rating and its federation's settings (8 bytes later on the Mac than on
Windows): game importance, FA financial power and FA patience. The game keeps the youth rating and the first two
settings twice, and as a save goes on it moves some second copies a point away from the first. The editor writes both
copies to the new value and refuses a write only while the second holds a value the field cannot; an undo puts the first
copy's old value into both. The attendance of the nation's matches, its least and its most, are
in a record the container points at (`container_record`), and the nation's economic factor and state of development are
in the nation itself, which its men's and women's teams share. See
[fm27-national-teams.md](recon/fm27-national-teams.md).

The senior team's profile has Heal all, Inspire all and Refresh all for the players it lists, as a club's Squad tab
has them: the `national_team_action` command reads the squad (`Session::national_squad`) and hands it to
`act_on_players`, which `team_action` uses for a club's team too. The changes are one batch, undone as one.

Above the teams, the profile shows what the game shows of the nation and its federation, read only
(`Session::nation_details`, #210): the year the federation was founded, from the container, the continent's name, from
the nation, and the federation's staff as the game's staff list of the nation's team has them: each team's manager and
the people of the container's medical, coaching and scouting lists, each with the job and the team of his contract with
the federation, which is not his contract with a club. Where they are is the layout's `[national.details]`, which only
`layout-macos.toml` has so far: on Windows the profile shows none of it. `fmlibre-probe national-teams italia
--details` prints them, and then how many of all the containers have each and the jobs of all their staff.

### After an update of the game

Each build of the game moves its static data. A build profile in `profiles/` (identified by `game_plugin`'s headers)
places the entity arrays, the in-game date, the retirement manager, the game's own object and the tactics and training
managers for each build the editor was checked with.
For a build without one, or where a place a profile names does not check out, the editor looks for them itself
(`crates/fmlibre-core/src/locate.rs`):
- **The entity arrays** by scanning the plugin, in about half a second.
- **The in-game date** among the values in the plugin's writable data that read as dates: 76 on the Steam test save
  of August 2027. Only a date that two independent witnesses agree with is used:
  - nearly every sampled contract was signed before it, and the latest not long before;
  - nine in ten of the current injuries began on or before it and are not over by then.

  Contracts alone cannot rule out a later date the game keeps for something else: 22 September and 11 October 2027
  on that save. The injuries can, as only 12 and 3 of 110 fitted those. The day before is harder: the game keeps a
  value for it too, and as the witnesses leave some room, it fits unless enough contracts were signed and injuries
  begun on the day. On Game Pass 0.9.2435.0 on 11 January 2028, `game_plugin.dll+0x53886f8` held the 10th: 3 of 3,712
  contract dates came after it and 161 of 173 injuries fitted it, against none and all 173 for the date. When values
  that fit read as several dates, the date is, in turn:
  - the latest of them, if the field beside the arrays holds it: that is where the builds before November 2026 kept
    the date, and 0.9.2409.0 keeps it there too once the game has moved on a day after a load;
  - the one read within 0x400 bytes of where the other builds keep their date, by its distance from the players'
    array: the date's own variable has kept that distance to within 0x38 bytes from one build to the next, while the
    value for the day before sits some 0x2F000 bytes away;
  - the one that fits the witnesses better than every other: no more contracts after it, no fewer injuries, and
    better on one count. On a day on which no contract was signed and no injury began, the day before fits exactly
    as well as the date, so this alone cannot tell them apart;
  - of the dates none fits better than, the one held in more places than any other. Game Pass 0.9.2524.0 keeps a
    value for the day after (`game_plugin.dll+0x53bb3b4`), which only an injury over on the day rules out: on a save
    of 23 October 2026 none was, and the 24th fitted exactly as well as the 23rd, which three places held against its
    one. Each value for another day seen so far was held in one place.

  Otherwise none is used, as where two dates are held in as many places: right after a load the date's own variable
  can be the only place that holds it.
- **The retirement manager's static** where other builds keep it, as far from the players' array, checked by the
  name of the class its object has. Otherwise the plugin's writable data is searched for a pointer to an object of
  the class `RETIREMENT_MANAGER`, which takes about half a second.
- **The game object's static**, whose count of saves loaded tells a load from a save, the same way: where other builds
  keep it, else by a search for a pointer to the one object of the class `game_plugin::GAME_UI`. Two statics point at
  it on Game Pass 0.9.2409.0 (0x5670EC8 and 0x5680140); either leads to it, and the profiles keep the second, which
  is where Steam build 26340721 keeps its own.
- **The tactics and training managers' statics**, which the tactic in use, the players' familiarity with it and Max
  tactics read, the same way: the one object of `TACTICS_MANAGER` and of `TRAINING_MANAGER`. On Game Pass 0.9.2562.0
  without its profile the guess held the first (0xD218 before the players pair, as in 0.9.2524.0) and the search found
  the second, 8 bytes off the distance 0.9.2524.0 keeps it at.

With those, and the object layout of the newest build (see below), a build that keeps the layout of the last one shows
ages, planned retirements, club finances and the tactic in use as before. What stays different for such a build:
- **No writes by default.** The app says that this version of the game is new to it. It writes nothing until the user
  presses Edit anyway, which lasts until the app is closed or connects again.
- **Checks before any write** (`crates/fmlibre-core/src/health.rs`), on every build. Each check samples up to 2,000
  players, members of staff or clubs, and looks for what a layout that reads the wrong bytes cannot fake:
  - every player rates 20 in his natural position;
  - goalkeepers are better at goalkeeping than outfield players, strikers at finishing and centre-backs at tackling;
  - goalkeeping coaches, physios and scouts are better than others at what their job is about;
  - contracts point back at their players, and some were signed after the player joined;
  - teams list their players, and clubs' senior teams point back at them.

  A check that does not pass leaves what it covers read-only: its fields, or for the contracts, teams, staff and clubs,
  every change to the game's lists and records. The app lists such checks under the masthead.
- **No date read from the wrong place.** Even where a profile places the in-game date, it is only used when the
  contracts fit it, and the current injuries too when there are enough of them to tell. Otherwise the app shows no
  ages, rather than wrong ones, and a transfer leaves the dates of the contract as they were.

Each check was tried against a layout broken on purpose (a field group moved by a byte or a pointer's width), and each
such layout failed its check. A layout that changed is not found again automatically: its checks keep what they cover
read-only until `profiles/fm27/layout.toml` is fixed.

Some of what the layout places has no check of its own among those, and a change there is meant to leave something
unread, by a guard of its own (see below for how far that holds). The update of 17 November 2026 made two such changes:
- The club finance record moved corporate facilities from 0x8A9 to 0x8AD. The full record is told from the smaller one
  of the clubs outside the leagues being played by values that look real (`finances_look_real` in `clubs.rs`), so no
  club's finances were read.
- A team's tactics moved the list of tactics from 0x1010 to 0x1018 and the index of the one in use from 0x1028 to
  0x1030, so no tactic was found in use, and the players' familiarity with it was not read (nor Max tactics offered).

The Mac halves of Steam build 26620374 made the same two changes on the Mac layout's places: corporate facilities from
0x8A9 to 0x8AD, and the tactics from 0x1000 and 0x1018 to 0x1008 and 0x1020.

As the builds before keep the old places, the layout keeps them, and the profiles of the builds since say where theirs
are, in `[layout.<section>]` tables: a session reads its build's layout with those fields in place of the layout's
(`layout_of`). The smoke tests `clubs` (finances) and `tactics` notice either change. The update of 24 November 2026
(Game Pass 0.9.2562.0, and Steam build 26797085 on Windows and on the Mac) kept both changes, and its profiles the same
tables. A build without a profile is read with the layout's own places, so until its profile is out, such a build
shows no club's finances and no tactic in use.

A build without a profile reads its objects as the newest build of its kind lays them out (`layout_lender` in
`profile.rs`): with the `[layout.*]` tables of the newest built-in profile for the same kind of plugin (Windows' or
the Mac's, whose tables are of different layout files), of its own storefront where there is one, and never with its
own, so that `FMLIBRE_IGNORE_PROFILES=1` rehearses an update. On Windows the newest is the last linked, by the time stamp
of the PE header; a Mac's UUID holds no time, so there it is the last one `BUILDS` lists, which a unit test keeps in
the order of the Steam builds. An update is likelier to keep what the build before it moved than to move it back: the
update of 24 November 2026 kept both places of 17 November, and Game Pass 0.9.2562.0, read without its profile, shows
the same finances and the same tactics in use as with it. What an update moves itself stays unread until its profile
says where, as on 17 November.

Nobody has read the borrowed fields on the new build, so every field a profile may override has to be one a check
guards, which leaves it unread rather than read wrong. A unit test (`every_override_is_a_field_a_check_guards` in
`profile.rs`) refuses an override of any other; add one only with such a check, and say here which. Those of today:
- `club_finance.corporate`. A club's finances are read only where the whole record looks real (`finances_look_real` in
  `clubs.rs`: corporate facilities of 1–20, a ticket price of £1–1,000, budgets not below zero), and written only to
  records of the class nearly all such records share. That alone does not hold: read at 0x8B1 on Game Pass 0.9.2562.0,
  ten records of the smaller class, `db::CLUB_FINANCE_BASE`, looked real with values read past their end, and their
  class passed for the full record's. So on a build without a profile that class must also be the one
  `[club_finance]` names, `db::CLUB_FINANCE`, by the name of its type (`Session::finance_class`), and only the records
  of that class show finances (`Session::club_details`).
- `tactics.tactics` and `tactics.current`. On a build without a profile a team's tactics are taken only where their
  list is that of a `simatch::PREPARED_TACTICS_CREATOR_ARRAY`, by its vtable 8 bytes before the list
  (`Session::tactic_in_use`): the team's tactics hold one, after the set-piece routines. The index of the tactic in use
  is that object's own, 0x18 after the list (a unit test keeps every layout and profile so), and must be within it.

Where the borrowed places are wrong, the app shows what it showed before it borrowed them: in a club's profile "FM keeps
finances only for clubs in the leagues being played." and no money to edit or freeze; in the Squad tab no tactical
familiarity, Max tactics off with its hover text, and Team at its best skipping it (`team.noTactics`). Nothing is
written to them. Tried on Game Pass 0.9.2562.0 with the lender's places moved on purpose (corporate facilities at
0x8B1, the tactics at 0x1020 and 0x1038): no class of the full finance record, no club's finances, no tactic in use.

#### On the day of an update

1. Load a save in the updated game. If the probe finds values that read as two dates a day apart (the value the
   game keeps for the day before, or for the day after), it says how it chose between them: check that the date it
   took is the one the game shows, and that it read it where the other builds keep their date.
2. `fmlibre-probe profile --out profiles/fm27/<storefront>-<version>.toml` looks for everything as for a build
   without a profile, runs the checks with what it found, and writes the profile. It lists the values that read as a
   plausible date, and whether the guessed and the searched places of the retirement manager, the game object and the
   tactics and training managers agree. It writes the `[layout.*]` tables the session read with: for a new build those
   of the newest build of its kind (see above), which only what it says next vouches for. It says whether the class of
   the full finance record is found, and whether the tactic in use is found for each human manager's club: where the
   game keeps finances for the clubs of the leagues being played and the class is not found, the record moved.
   Compare a club's record (the pointer at +0x150 of the object `fmlibre-probe club UID` names, dumped with
   `fmlibre-probe dump`) with what the build before read for the same club (an export of the clubs, `fmlibre-probe
   clubs --export`), and put what moved under the profile's `[layout.club_finance]`; `fmlibre-probe fields club
   --stats` then finds the class. Likewise, where a human manager picks his team's tactic and none is found in use
   (`fmlibre-probe training-history <his club>`), follow the tactics manager's map to the team's tactics as `[tactics]`
   in layout.toml describes it, and put what moved under `[layout.tactics]`. It does not look for the national teams'
   arrays (it keeps those of the built-in profile, where there is one; for a new build, find them as their notes in the
   other profiles say).
3. Add the file to `BUILDS` in `crates/fmlibre-core/src/profile.rs`; a unit test fails until it is there.
   A club's finances show no league prize money on the new build, and cannot change it, until someone has checked
   that `fmlibre-probe prizes` lists the amounts the game's Rules pages show, and added `prize_money = true` to the
   profile. The same goes for a club's sponsorship deals: `fmlibre-probe sponsorships <club UID>` has to list the
   deals the game's Sponsorship screen shows, with its amounts and dates, before `sponsorships = true` goes in; and
   for the Competitions tab's squad rules: `fmlibre-probe rules <a league's UID>` has to list the rules the game's
   Competition Stages page lists for it, this season's and next season's, and a rule changed with `--next` has to show
   on that page and come back from a save, before `squad_rules = true` goes in.
4. Build the app (`npm run release`), and run the smoke tests on both storefronts (see
   [`tools/smoke`](../tools/smoke/README.md)).
5. Add the build to its table in [COMPATIBILITY.md](COMPATIBILITY.md), with what its profile turns on.

To rehearse this on a build the editor knows, set `FMLIBRE_IGNORE_PROFILES=1` before starting the app or the probe:
every build is then one without a profile. On both builds of November 2026, the search finds exactly the places their
profiles name, and `fmlibre-probe profile` says so ("the same places"). On Game Pass 0.9.2562.0 it writes every place
and override its profile names but the national teams' arrays and what was checked against the game's screens
(`prize_money`, `sponsorships`, `squad_rules`). The build then borrows its layout from the newest other profile of its
kind (`fmlibre-probe calibrate` says which, in its "Object layout" line): on the first build of an update that moved
what a profile overrides, that is the layout from before the update, so finances or the tactic in use stay unread
there, as they would have on the day.

### On macOS

macOS lets no app read another app's memory unless the other app allows debugging, and
Football Manager does not: it is signed with Apple's hardened runtime. Unless System
Integrity Protection is turned off, macOS lets no other app attach to it. What the game
does allow is loading extra libraries named in `DYLD_INSERT_LIBRARIES` (Steam's overlay uses
the same door), so FMLibreEditor comes with a small one, the bridge (`crates/fmlibre-bridge`).

Steam on macOS runs a launch option as a program, with the game among its arguments, so the
launch option names a small launcher, `fmlibre-launch`, that comes with the bridge. The
launcher puts the bridge in `DYLD_INSERT_LIBRARIES` (in front of the libraries Steam names
there) and then turns into the game, so Steam keeps following the process it started. The
bridge hooks nothing, patches nothing and reads none of the game's data. It only answers the editor of the
same user with the game's task port, macOS's handle to a process's memory. From there the
editor works as it does on Windows: it reads with `mach_vm_read_overwrite`, writes with
`mach_vm_write` into the game's heap only, and makes the same four checks before every write.
It hands `mach_vm_write` less than a page at a time: given whole pages, the kernel puts pages
of the editor's in place of the game's, splits the game's region around them, and reports the
pieces as shared.

The connect panel of the app sets the bridge up (**Set up the bridge**) or takes it out
again. Setting up copies the bridge and the launcher to
`~/Library/Application Support/FMLibreEditor/` and puts the launcher in front of FM27's
launch options in Steam, which only works while Steam is closed; Steam keeps the launch
options to itself while it runs. With Steam open, set the launch option yourself: right-click
Football Manager 27 in Steam, then **Properties › General › Launch Options**, and enter

```text
'/Users/<you>/Library/Application Support/FMLibreEditor/fmlibre-launch' %command%
```

The panel shows the line with your own folder in it. Launch options you already have stay,
behind the launcher; another tool's launcher among them is started in turn.

> **Before you delete these files by hand,** take the launch option out: Steam cannot start
> the game through a launcher that is not there. **Remove the bridge** in the app does both,
> in the right order. Without the bridge library, the launcher starts the game as it is.

## Repository layout

| Path | Contents |
|---|---|
| `crates/fmlibre-mem` | Process access on Windows and macOS: processes, modules, memory regions, PE and Mach-O headers, guarded writes |
| `crates/fmlibre-bridge` | macOS: the library the game loads to hand its memory to the editor, and the launcher Steam starts the game through |
| `crates/fmlibre-core` | Football Manager logic: game detection, calibration, decoders, editable fields |
| `crates/fmlibre-probe` | Command-line probe |
| `profiles/` | Object layouts per edition and addresses per game build |
| `app/` | Tauri 2 desktop app (React + TypeScript) |
| `tools/smoke` | Smoke tests that drive the built app against a running game |
| `docs/` | Install guide, roadmap and reverse-engineering notes (`recon/`) |
| `docs/design/` | The interface's design system (`DESIGN.md`) and product notes (`PRODUCT.md`) |

## Building

Requirements: Windows 10/11, Rust stable (via [rustup](https://rustup.rs)),
Visual Studio Build Tools with the C++ workload, and Node.js 20+ for the app.

```powershell
cargo build --release -p fmlibre-probe
cd app; npm install; npm run tauri dev     # run the desktop app
npm run release                            # build target\release\FMLibreEditor.exe
```

`npm run release` builds a stand-alone `FMLibreEditor.exe` without an installer. It
needs the WebView2 runtime, which Windows 10 and 11 already have.

On macOS: Xcode's command line tools, Rust stable with the Intel target as well
(`rustup target add x86_64-apple-darwin`, for the bridge to load in Intel builds of the
game), and Node.js 20+.

```sh
cargo build --release -p fmlibre-probe -p fmlibre-bridge
cd app; npm install; npm run tauri dev     # run the desktop app
npm run release:mac                        # build FMLibreEditor.app, universal, with the bridge
```

`npm run release:mac` writes the app to
`target/universal-apple-darwin/release/bundle/macos/FMLibreEditor.app`, signed ad hoc: it
has no Developer ID and is not notarized. macOS opens a copy downloaded from the internet
only once it is allowed in **System Settings › Privacy & Security** (**Open Anyway**).

`npm run dev` in `app/` serves the interface in a plain browser with made-up sample
players, for working on the UI without the game.

The app reads graphics packs from
`Documents\Sports Interactive\Football Manager 27\graphics` on Windows and from
`~/Library/Application Support/Sports Interactive/Football Manager 27/graphics` on macOS.
If FM keeps its user data somewhere else, set the environment variable `FMLIBRE_GRAPHICS`
to that graphics folder before starting the app.

The app remembers what was frozen in each save in `frozen.json` in its data folder
(`%APPDATA%\io.github.tozmoz.fmlibreeditor` on Windows,
`~/Library/Application Support/io.github.tozmoz.fmlibreeditor` on macOS). A save is told
apart by the storefront and the UIDs of its human managers. To test without touching that
file, set `FMLIBRE_DATA` to another folder before starting the app.

The changes written to each career are kept in the same data folder, in
`history\<storefront>-<UIDs of the human managers>.jsonl`: one JSON line per change or undo, added
to the end as they are made, so the Changes view lists them again after a restart (see `History`
in `app/src-tauri/src/lib.rs`). A change from an earlier session is undone as a new edit back to
its old value, with every check; one whose undo needed the game's memory as it was (a move,
healing, a tie, a clause, a name...) stays as history. Clear history in the Changes view empties
the file.

How a career's players develop is kept there too, in `timeline\<storefront>-<UIDs of the human
managers>.jsonl.gz` (see `Records` in `app/src-tauri/src/lib.rs` and
`crates/fmlibre-core/src/timeline.rs`). As the lists are read, on connecting and on Reload data, a
record is added to the end of the file when seven days of the game's time have passed since the
last: every player's current and potential ability, transfer value and attributes (1–20), taken
from the lists as read, so that it costs no further reading of the game. The first record holds
every player whole; a later one only what changed, and the new players. Each record is one line
of JSON, compressed on its own, so `gzip -dc` gives the file as lines. A date before the last
record's means the game has gone back to an older save: that record is whole again, and the ones
dated on or after it no longer count. Nothing is recorded without a human manager in the save, or
where the checks of the players' values or of their attributes fail. Deleting the file starts the
records afresh.

The same file as the freezes (`frozen.json`) keeps the names the editor gave stadiums. The game keeps no stadium names in
its saves and gives each stadium the name in its database whenever it loads one, so the app
gives the new names again: on connecting, on a reload, and from its hold, which every 2 s
notices when the game has loaded a save (the clubs' array has moved), checks it is the same
save before writing, and reads the clubs again (see `Connection::hold_stadiums`).

Exports go to `Documents\FMLibreEditor\Exports` (`~/Documents/FMLibreEditor/Exports` on
macOS); `FMLIBRE_EXPORTS` names another folder. The columns and the JSON keys are in
`crates/fmlibre-core/src/export.rs`. The Changes view's export (`export_changes`) is CSV only: the
window sends the rows its search and filters leave, with the texts only it has (the values as
shown, the field's name, the time in its zone), and `export_changes` in `export.rs` writes them
with the same quoting, separator and byte order mark as the lists.

### Releasing

1. **Bump the version** in three places:
   - `version` in the root `Cargo.toml` (`[workspace.package]`);
   - `app/package.json`;
   - `app/src-tauri/tauri.conf.json`.

   Commit the bump.

   **What's new:** before that, add the version to `whatsNew.versions` in `app/src/i18n/en.ts`
   (a few short lines, each led by a few words in bold) and in the other languages, and the
   people to thank to `THANKS` in `app/src/whatsNew.ts`. The app shows them once, the first
   time it starts after it was updated to that version; a language without the version shows
   it in English, and a version with no notes shows nothing.
2. **Tag it and push the tag:** `git tag v0.1.0` and `git push origin v0.1.0`.
3. **The `Release` workflow** (`.github/workflows/release.yml`) builds, on GitHub's Windows
   and macOS machines:
   - `FMLibreEditor-Setup.exe`, a per-user NSIS installer in English, Turkish, Spanish, German,
     French, Italian, Japanese, Korean, Brazilian Portuguese, Russian and Simplified Chinese;
   - `FMLibreEditor-portable.zip`;
   - `FMLibreEditor-macOS.zip`, the universal app with the bridge and its launcher;
   - `FMLibreEditor-macOS.app.tar.gz`, the same app, which installed macOS apps update from.

   Once CI has passed for the tagged commit (the checks are CI's, and are not run again), it
   opens a **draft** release with these files, `latest.json` and `docs/release-notes.md` as its
   text. The version bump's pull request builds none of them; the tag does.
4. **Write what is new in the draft and publish it.** From then on, installed Windows copies
   and macOS apps of a version with the updater (any after 0.4.1) offer **Update** in their
   notice.

The download links in the README point at the latest published release. People outside the
repository can use them once it is public.

#### Updates from inside the app

A copy the Windows installer put in place, and the macOS app, update themselves with Tauri's
updater plugin: it reads `latest.json` from the latest published release (the endpoint in
`app/src-tauri/tauri.conf.json`), downloads the file it names for the system, and checks its
signature against the public key in the same file.

- **Windows:** the installer runs in passive mode; the app closes and the installer opens
  the new version.
- **macOS:** the app in `FMLibreEditor-macOS.app.tar.gz` takes the place of the running
  one's bundle (macOS asks for an administrator's password where the user may not change
  it), and the app starts again (`restart_app`). An app opened where it was downloaded runs
  from a read-only copy (App Translocation): the bundle it was copied from, which the
  Security framework names, is the one replaced and started again
  (`app/src-tauri/src/self_update.rs`). The new bundle is not quarantined, so macOS runs it
  where it is from then on. At startup an app run from its bundle puts its bridge and
  launcher in place of the installed ones where they differ (`bridge_setup::refresh`), so
  the game loads the new bridge the next time it starts.

Portable copies and development builds open the release's page instead (`can_self_update`).

The workflow signs the installer and the macOS archive with the private key in the
repository's secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`,
and writes `latest.json` from the signatures. The maintainer keeps a copy of the key and its
password outside the repository: a release signed with another key is refused by every
installed copy, which would then have to be updated by hand once. The macOS archive is made
after the app is notarized, so its build makes no updater files itself
(`tauri.bridge.conf.json`); a local `npm run release` or `npm run release:mac` needs no
key.

## Using the probe

Start FM27, load a save, then run:

```powershell
fmlibre-probe info                                   # process, storefront, modules, game_plugin.dll layout
fmlibre-probe calibrate                              # identify the build; locate players, staff, clubs, the date, the saves loaded
fmlibre-probe health                                 # the checks the editor makes before it writes, and what each found
fmlibre-probe diagnostics                            # what the app's Copy diagnostics copies: no names or paths
fmlibre-probe profile                                # a build profile for this build, looked for as for a new build
fmlibre-probe players "arda guler"                   # search players (accents ignored), best first
fmlibre-probe players --position st --max-age 20 --min-pa 170 --sort pa   # wonderkid strikers
fmlibre-probe players --max-age 21 --export young.csv   # every match to a file, as the app's Export writes it (.json: JSON; --semicolon)
fmlibre-probe player 7458500                         # everything read for one player
fmlibre-probe staff arteta                           # search staff; staff-member <id> for details; --export FILE as players
fmlibre-probe clubs tottenham                        # search clubs; club <uid> for details; --export FILE as players
fmlibre-probe national-teams italia --squad            # a nation's men's and women's teams, and the first one's squad; no writes
fmlibre-probe national-teams italia --details          # what their profiles show of the nation and federation; no writes
fmlibre-probe fields player                          # what the editor can change (also: staff)
fmlibre-probe get player 7458500                     # those fields' values for one player
fmlibre-probe set player 7458500 attribute.finishing 18 --shown   # change one: this writes to the game
fmlibre-probe move 13200568 1139 --restore           # move a player to a club and back: this writes too
fmlibre-probe room                                   # the clubs whose senior squad list is full, best known first
fmlibre-probe room 597                               # how full one is, and whom a move there can release to make room
fmlibre-probe plan 28106491 597 --release 2000031611 # whether a move can be made, as the app's dialog asks; no writes
fmlibre-probe move 28106491 597 --release 2000031611 --restore   # move him there in that player's place, and back
fmlibre-probe swap 13200568 72048035 --restore       # two players swap clubs and back: this writes too
fmlibre-probe release 91100466 --restore             # release a player from his club and back: this writes too
fmlibre-probe staff-move 4000571 1139 --restore      # move a member of staff to a club and back: this writes too
fmlibre-probe staff-move 4102655 676 --job 88 --restore   # the same, as another job (a code, see staff-job)
fmlibre-probe staff-job 4000571 14 --restore         # give a member of staff another job and back: this writes too
fmlibre-probe staff-sign 9318 728 2 --restore        # sign one with no club, as a coach, and back: this writes too
fmlibre-probe staff-release 5129148 103353 --restore # release staff from their clubs and back: this writes too
fmlibre-probe staff-refs 5129148 --show "no class"   # what points at a member of staff, by holder; no writes
fmlibre-probe staff-places                           # where clubs keep their staff, job by job; no writes
fmlibre-probe staff-places --club-offset 0x148       # what one place of every club holds: its director of football
fmlibre-probe contract-classes                       # full and basic contracts of players and staff, counted
fmlibre-probe staff-at 0x28eb75773a0 --len 0x100     # name the staff a stretch of memory points at, e.g. after refs
fmlibre-probe injuries 728                           # the current injuries of a club's players
fmlibre-probe heal 37055843 --heal --restore         # heal a player and list his injuries again: this writes too
fmlibre-probe bans                                   # every player with a ban; bans <uid> for one player's
fmlibre-probe bans 29120248 --lift --restore         # lift a player's bans and list them again: this writes too
fmlibre-probe ties 2000138835                        # secondary nationalities and homegrown status, numbered
fmlibre-probe tie-set 2000138835 0 --nation 765 --restore   # point tie 0 at England and back: this writes too
fmlibre-probe teams 680                              # a club's teams: kinds, captains, players' fitness and morale
fmlibre-probe cohesion 680 --raw                     # each senior player's cohesion with the club, and his other entries
fmlibre-probe familiarity 2188                       # each senior player's record of familiarity, area by area (macOS)
fmlibre-probe training-history 2188                  # the areas each player's history of training adds up to (macOS)
fmlibre-probe training-history 2188 --max --grow --restore   # Max tactics' history, and back: this writes too
fmlibre-probe concerns --all                         # every reason to be unhappy, whom it is about, and the groups
fmlibre-probe captain 680 43425040 --restore         # make a player captain (--vice: vice-captain) and back
fmlibre-probe prizes                                 # the prize money competitions pay, by final position and per match
fmlibre-probe prizes 130286 --win 1234567 --restore  # change what a Süper Lig win pays and back: this writes too
fmlibre-probe rules                                  # the competitions with squad rules; rules 130286 for the Süper Lig's
fmlibre-probe rules 130286 --current 1 16 --restore  # change rule 1 of this season's list and back: this writes too
fmlibre-probe rules 11 --where --sources             # where its lists are, and what each of the nation's records holds
fmlibre-probe rules 1301394 --current 4 30 --restore # the Champions League's: no record keeps them, so the list alone
fmlibre-probe sponsorships 2188                      # a club's sponsorship deals: kind, term, amounts (reads only)
fmlibre-probe scan                                   # find arrays of game objects in game_plugin.dll
fmlibre-probe refs 0x1a5a5396990 --span 0x3c8        # every pointer into an object (holders, lists, squads too)
fmlibre-probe dump game_plugin.dll+0x1000 --len 0x100
fmlibre-probe element game_plugin.dll+0x5681dc0 0    # follow an array and dump element 0
fmlibre-probe column game_plugin.dll+0x5681dc0 0x294 --find 7458500   # find a player by UID
fmlibre-probe find "18 July 2026"                    # search memory for text (UTF-8 and UTF-16)
fmlibre-probe find "c7 80 ea 07" --as hex --module game_plugin.dll
```

Addresses and lengths are hexadecimal. Add `--json report.json` to `info` or `scan`
to save the results. `calibrate --scan` ignores the build profile and finds the
arrays, the in-game date, the retirement manager and the game object the way it would on an unknown build.

Only `set`, `move`, `swap`, `release`, `staff-move`, `staff-job`, `staff-sign`, `staff-release`, `heal --heal`,
`bans --lift`, `tie-set`, `tie-add`, `tie-remove`, `captain`, `cohesion --set`, `familiarity --set`,
`training-history --max`, `prizes` with an amount to change and `rules` with `--current` or `--next` write to the
game. Unlike the app, the probe writes to a build without a profile too, as far as the checks allow, so
that a new build can be mapped.
- `set` changes one field after the checks above. Values are as stored:
  attributes run 0–100, or 1–20 with `--shown`.
- `move` moves a player to a club's senior team; `release` leaves him a free agent, and `staff-release` a member of
  staff without a club.
- With `--restore`, each one puts the old values back straight away, to test
  without changing the save. `set`, `move`, `release`, `staff-release`, `heal`, `bans`, the `tie`
  commands, `captain`, `cohesion`, `familiarity`, `training-history`, `prizes` and `rules` also take
  `--hold <seconds>` to wait first, so the
  change can be looked at in the game. The Dynamics page shows a team's cohesion as the game last
  worked it out, and works it out again only once the game moves on (Continue); so do the pages that show this
  season's squad rules.

If Windows denies access, run the probe from an administrator terminal.

On macOS, `fmlibre-probe bridge` shows whether the game loads the bridge;
`fmlibre-probe bridge setup` installs the bridge and the launcher built next to the probe
and sets the launch option (quit Steam first), and `fmlibre-probe bridge remove` takes them
out again.
Then start FM27 from Steam: the other commands work as on Windows, with `game_plugin` in
place of `game_plugin.dll` in addresses.

