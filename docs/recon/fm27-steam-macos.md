# FM27 on macOS: the Steam build 26227640

Observed on 2026-10-31 on an Apple silicon Mac with macOS 27.0.1 and System Integrity
Protection on, from the Steam install under
`~/Library/Application Support/Steam/steamapps/common/Football Manager 27/` (app 4530370,
build 26227640, depot 4530373). Steam gives the Mac build the same build id as the Windows
one. The game had not been started on this Mac before; the layout below was then measured on
a new save (Tyrone Demarcus at Arsenal, 14 July 2026), with the game started by Steam through
the bridge's launcher.

## The app

`fm.app` is a Unity 6000.3.18f1 player, universal (arm64 and x86_64):

| | |
|---|---|
| Bundle id | `com.SportsInteractive.FootballManager27`, version 27.0.0.2486716 |
| Executable | `fm.app/Contents/MacOS/Football Manager 27`, the process name too |
| Game plugin | `fm.app/Contents/PlugIns/game_plugin.bundle/Contents/MacOS/game_plugin`, a Mach-O bundle |
| Other modules | `UnityPlayer.dylib` and `GameAssembly.dylib` in `Contents/Frameworks` |

`game_plugin` has a `LC_UUID` per architecture, which identifies the build as the PE header
does on Windows:

| | arm64 | x86_64 |
|---|---|---|
| `LC_UUID` | `9E8E47DE-F704-314C-917D-C32D12637678` | `22CFE5C3-B5CF-3C00-8043-1EA190A69B89` |

The arm64 image is `0x58F4000` bytes: `__TEXT` `0x54B0000`, `__DATA_CONST` `0x1F4000`,
`__DATA` `0x9C000` (with `__common` at `0x56D10D0` and `__bss` at `0x5721BA0`) and
`__LINKEDIT`. The `(begin, end)` pairs of the entity arrays are globals, so they should be in
`__DATA`; `calibrate --scan` scans the writable segments as it scans `.data` on Windows.

## Why macOS keeps the editor out

The app and `game_plugin` are signed by SEGA's Developer ID (`3JJX9QL35J`), notarized, and
built with the **hardened runtime**. Their entitlements:

```text
com.apple.security.cs.allow-dyld-environment-variables   true
com.apple.security.cs.disable-library-validation         true
com.apple.security.device.camera                         true
com.apple.security.personal-information.photos-library   true
```

There is no `com.apple.security.get-task-allow`, so macOS hands the game's task port, the
handle to its memory, to no debugger. A test process signed the same way confirmed it:
`task_for_pid` from the same user fails with `KERN_FAILURE` (5) while SIP is on. That is why
earlier Mac editors asked players to turn SIP off.

The first two entitlements are the way in. With them, dyld loads the libraries named in
`DYLD_INSERT_LIBRARIES`, signed by anyone; Steam relies on them for its overlay. FMRTE 27 for
Mac no longer needs SIP off either: its notes speak of a plug-in, set up through the
launchers' settings, that only loads after Steam has been quit.

## The bridge

`crates/fmlibre-bridge` builds `libfmlibre_bridge.dylib`. Loaded, it checks that the process
is Football Manager, checks in the Mach service `io.github.tozmoz.fmlibreeditor.bridge.<pid>`
and waits on it in a thread of its own. A request from a process of the same user, by the
audit token the kernel attaches, gets `mach_task_self()` back as a port descriptor; anyone
else gets an empty answer. The editor checks with `pid_for_task` that the port it got is the
game's. It hooks nothing and reads nothing of the game.

What the test process showed on macOS 27:

- `bootstrap_check_in` of a name launchd has never heard of works for a process of the GUI
  session, as Chromium uses it, and `bootstrap_look_up` finds it from another one.
- `mach_task_self()` of a third-party app may be sent to another process, which Chromium and
  Electron apps rely on. The **read** port, `TASK_READ_PORT`, may not: sending it killed the
  process with `EXC_GUARD` (`ILLEGAL_MOVE`). The bridge never sends it.
  `task_get_special_port(TASK_KERNEL_PORT)` is refused (`KERN_DENIED`).
- With the port, `mach_vm_read_overwrite`, `mach_vm_write`, `mach_vm_region_recurse` and
  `task_info(TASK_DYLD_INFO)` work as for a debugger. An 8-byte read takes about 0.9 µs, the
  list of 84 modules 3 ms.
- dyld stops the game before it starts when an inserted library is missing or has no slice
  for the game's architecture (`terminating because inserted dylib ... could not be loaded`).
  So the bridge is universal, it is replaced with a new file rather than overwritten, and
  removing it takes the launch option out first.
- SIP strips the `DYLD_*` variables from the environment of protected programs, and so
  from what they start: `DYLD_INSERT_LIBRARIES=... arch -x86_64 game` loses it on the way,
  `arch -x86_64 -e DYLD_INSERT_LIBRARIES=... game` does not.

## Heap-only writes

`mach_vm_region_recurse` reports a module's `__DATA` page that the process has written to as
private memory that no file backs: the copy-on-write copy is the process's own. So the write
guard also refuses any range that overlaps a module, as dyld lists them (read again after
30 seconds). `proc_regionfilename` was tried first: it names the module for such a page and
fails with `EINVAL` for heap memory. Under Rosetta, though, it names
`/usr/libexec/rosetta/runtime` for every region of the game, heap included, which would
refuse every write.

The game's objects live in memory from macOS's own allocator: the players' pool in
`MALLOC_LARGE` regions (tag 3), the teams' lists in a `MALLOC_MEDIUM` one (tag 12). The size
classes measured on Windows (`heap.block_sizes`) do not carry over, so on macOS a move only
uses the room a list's capacity leaves. Most squad lists have none: moving Ben Davies to
Juventus, Manchester United and five other clubs was refused.

## Steam's launch options

Steam on macOS starts a game's app bundle (`'…/fm.app'` in its logs). It runs **no shell** for
a launch option: it replaces `%command%` with the bundle's path, in single quotes, splits the
option into words and starts the first word as a program. The first launch option of the
bridge, `DYLD_INSERT_LIBRARIES="…" %command%`, which a shell would take, made it fail:

```text
Failed running GameID 4530370: "DYLD_INSERT_LIBRARIES="…/libfmlibre_bridge.dylib" '…/fm.app'" (OS Error 260)
```

Error 260 is Cocoa's "no such file": the variable was taken for the program. So the launch
option is `'…/fmlibre-launch' %command%`, quoted the way Steam quotes the game. The launcher
is a small program of `fmlibre-bridge`: it finds the bundle's executable from its
`Info.plist`, puts the bridge in front of the libraries `DYLD_INSERT_LIBRARIES` already names,
and `exec`s the game, which keeps the process id Steam follows. Without the bridge beside it,
it starts the game as it is. Started that way, FM27 (pid 14183) loaded the bridge next to the
two libraries Steam names, `steamloader.dylib` and `gameoverlayrenderer.dylib`, and the probe
attached to it with SIP on.

Steam starts the launch option's program as **Intel code**: FM27, started through a launcher
that simply `exec`'d it, ran under Rosetta, with the Intel half of `game_plugin` (UUID
`22CFE5C3-…`), though Steam itself and the game are universal. The launcher now becomes the
game with `posix_spawn`, `POSIX_SPAWN_SETEXEC` and the Mac's own architecture first: started
as Intel code itself, it brought a stand-in for the game up natively, with the bridge and the
other inserted library.

Each Steam account keeps them in
`~/Library/Application Support/Steam/userdata/<account>/config/localconfig.vdf`, under
`UserLocalConfigStore/Software/Valve/Steam/apps/4530370/LaunchOptions`. Steam reads the file
when it starts and writes it back when it quits, so the editor changes it only while Steam is
closed, keeps a `.fmlibre-backup` of the first version it changed, and edits the one value in
place. Set up and taken out again on a copy of a real file, it came back byte for byte.

## The object layout

`calibrate` found the arrays where Windows has them relative to each other: players at
`game_plugin+0x5C891C8` (38,007, the same as the Windows Steam test save), staff `0x48` and
clubs `0x1B8` after them. With the Windows layout no name decoded, as clang lays classes with
virtual bases out by the Itanium C++ ABI, not MSVC's. `profiles/fm27/layout-macos.toml` holds
the Mac offsets:

| | Windows | macOS |
|---|---|---|
| Player's own fields (positions, attributes, CA/PA, condition, morale, team, injuries) | | 8 bytes earlier: no vbptr |
| Person (names, nation, personality, birth date, contract, caps) | after the identity block, `+0x2B0` | first, `+0x278`; its fields 0x40 earlier |
| Identity block (UID; what contracts and captaincies point at) | `+0x288`, before the person | `+0x388`, after it |
| Player-coach shift | `0xF8` | `0xF8` (Paul Ifill's UID at `+0x48C`) |
| Staff's own fields (attributes, reputation, CA/PA) | | the same |
| Staff person / identity block | `+0x128` / `+0x100` | `+0xF8` / `+0x208` |
| Human manager shift | `0x340` | `0x340` (the save's own manager) |
| In-game date, from the players pair | `+0x848` | `+0x908` |

Contracts, clubs, club info, club finances, teams, nations and injuries are laid out as on
Windows. Witnesses on the running game:

- Lionel Messi: born 24 June 1987, 207 caps and 125 goals, 18 and 14 for the U21s, his
  positions and attributes, a contract that ends on 31 December 2028 with squad number 10.
- Tottenham Hotspur: 50,000 season tickets, founded 1882, supporter traits 18/14/7/14/7/14,
  £65 tickets, corporate facilities 20, reputation 7650; captain Micky van de Ven and
  vice-captain Pedro Porro, whose captaincies point at their identity blocks.
- Injuries: David Wotherspoon's moderate calf muscle strain, among others.

With the build profile of the Intel half, `calibrate` decoded 100% of the sampled players,
staff and clubs. The probe then wrote, read back and restored right away: Messi's finishing,
his ambition and his squad number; Pedro Porro as Tottenham's captain (the two captains
swap); Mikel Arteta's tactical attribute; Tottenham's balance; and a swap of Ben Davies with
Tom Heaton (14 writes).

## Still to do

- Start the game natively from Steam with the new launcher, and add the build profile of the
  arm64 `game_plugin` (UUID `9E8E47DE-…`); until then it is found by scanning, in under a
  second.
- Measure the allocator's block sizes on macOS, for moves to lists without spare capacity.
