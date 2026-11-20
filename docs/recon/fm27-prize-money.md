# FM27: where the game keeps prize money

Notes behind the probe's `prizes` (#123). The layout was found by RootTourist on the Windows Steam build
(26340721, a VfB Stuttgart save in 2028/29) and checked by Reckbeg on the Mac Steam build (a Brentford save on
17 August 2026) against the game's Competition Stages screens. It was read again on the Windows Game Pass build
(0.9.2409.0, a save loaded on 9 August 2027, with the Turkish leagues), and on the Mac Steam build 26385295 (Apple
silicon, a save of 12 July 2027): 386 league settings, 384 held by a stage being played or played and 2 by one not
started yet (the Champions League's and the Europa League's league phases), as the Windows offsets place them.

## Finding them

Nothing the editor reads leads to them, and no static points at them: a competition's stages and their settings
are objects of their own classes, found by class (see `rtti.rs`). `sicomps::PRIZE_MONEY_PROVIDER`, a name the binary
keeps, has no vtable and no objects.

## Stages and settings

| Class | Offset | What it holds |
| --- | --- | --- |
| `sicomps::LEAGUE_STAGE` | `+0x70` | the competition (`db::COMP`) |
| | `+0xF0` | its settings |
| `sicomps::FUTURE_STAGE`, a stage that has not started yet | `+0x70` | the competition |
| | `+0x90` | the settings it will be played with: `LEAGUE_SETTINGS`, `CUP_SETTINGS` or `GROUP_SETTINGS` |
| `sicomps::LEAGUE_SETTINGS`, 0x2F0 bytes apart | `+0x148` | `u32` pounds per win |
| | `+0x14C` | `u32`, the same as `+0x148` in every settings seen |
| | `+0x150` | `u32` pounds per draw |
| | `+0x154` | `u32` pounds per loss |
| | `+0x1E0` | `(begin, end, capacity)` of `u32` pounds by final position, the first place first |
| `db::COMP` | `+0x0C` | `u32` UID, held again at `+0x10` (the Champions League 1301394, the Süper Lig 130286) |
| | `+0x40`, `+0x48` | name and short name, FM strings in the game's language |

Also seen in the settings, and not used: at `+0x188` a list of pointers, 34 for an 18-team league and 38 for a
20-team one (the matchdays); at `+0x2A8` a pointer to a `sicomps::LEAGUE_POSITION_PLAYOFF`; at `+0x2B0` a list of
pointers, perhaps promotion and relegation.

## What they hold

- The amounts come from the game's database. Three saves in three seasons (2026/27 on the Mac, 2027/28 on Game
  Pass, 2028/29 on Steam) hold the same Champions League amounts: 10,222,480 down to 236,234 by position, 1,803,967
  per win and 601,323 per draw. Whether a league has a list depends on the database too: the Premier League, the
  Bundesliga, Serie A and the Eredivisie have one; LaLiga, Ligue 1 and the Championship have none.
- Money per match is mostly the continental competitions' (the Champions League, the Libertadores with 244,877 per
  win, the AFC and CAF ones, the EFL Trophy). The Süper Lig pays 114,699 per win, 57,964 per draw and 1,229 per
  loss, and has no list by position.
- Small competitions have lists too: the Turkish under-19 groups pay 6,146, 5,378 and 4,609 to their first three.
- The game makes a stage's settings when it sets the stage up: the CAF group stages' appeared during the season,
  and the Champions League's league phase was already held by a `FUTURE_STAGE` in August. In the session a career
  was created in, many more settings are in memory, most held by no stage (2,660, against 297 once the save was
  loaded again), so read after loading a save.
- What the knockout rounds pay is not in these settings: see [Cups and play-offs](#cups-and-play-offs).

## Changing them

`fmlibre-probe prizes TEXT` lists what the competitions whose names hold TEXT (or whose UID it is) pay; with
`--place N AMOUNT`, `--win`, `--draw` or `--loss AMOUNT` it changes the amounts of every settings the stages of that
one competition hold (both words of a win), up to £200M an amount, and reads them back. `--restore` puts back what it
found, provided each stage still holds its settings and they still hold what was written. Settings no stage holds are
never changed. Checked on the Game Pass save with `--restore`: the Süper Lig's money per win and per draw, and the
Champions League's first and last places. Checked on the Mac save too: the Premier League's first and last places,
the Libertadores' money per win in all nine settings its stages hold (one of them paid nothing per win, and took the
new amount too), the African Champions League's per draw and per loss, and the Champions League's first place before
its league phase started; each read back, put back, and every competition then read as before. The refusals held: a
21st place of a 20-team league, more than £200M, and "League", which 18 competitions match.

Not known yet:
- whether the game pays from these amounts: a per-match amount is the quick test (change it, win a match, and look
  at the prize money in the club's income); a list by position needs the end of a season;
- whether a change lasts through a save and a reload, and into the next season.

## Cups and play-offs

Read with the probe on the Mac Steam build 26620374 (Apple silicon), on a save loaded from disk, against the Coppa
Italia's Info › Rules screen with the amounts shown in euros. Nothing was written. The league settings above still
read there as on 26385295: 324 settings, all held by a stage; the Premier League's 20 places from £53,100,000 to
£2,600,000, and the Champions League's amounts as before.

A cup does not keep its prize money the way a league does.

| Class | Offset | What it holds |
| --- | --- | --- |
| `sicomps::CUP_STAGE`, 0xC0 bytes apart | `+0x70` | the competition (`db::COMP`), as in a league stage |
| | `+0x90` | its settings, a `sicomps::CUP_SETTINGS` |
| `sicomps::FUTURE_STAGE` | `+0x90` | a cup stage's settings too, before it starts |
| `sicomps::CUP_SETTINGS`, 0xF0 bytes apart | `+0x28` | a `db::STAGE_NAME`, the round's name (in about a third) |
| | `+0x58` | `(begin, end, capacity)` of pointers, to records of 0x140 bytes with a `db::STAGE_NAME` and dates |
| | `+0x70` | `(begin, end, capacity)` of pointers, in about half |

98 cup stages and 100 cup settings were in memory. No settings hold an amount: from `+0x88` to `+0xE0` every one of
the 100 is zero, and neither the records `+0x58` leads to nor the objects the stage points at further on hold the
amounts the Rules screen shows.

What the screen shows is per round, in different terms from a league's: an appearance fee for playing the round
("10m €", €10,000, for the Coppa Italia's preliminary round), and for the final a prize for the winner and one for
the loser (€4.6M and €2M). The binary's names for rules point the same way: `winner_prize_money`,
`loser_prize_money`, `appearance_money`, `leg_winner_prize_money` and `leg_draw_prize_money` sit among names of a
stage's rules (draw dates, seeding), and `knockout_win_prize_money`, `final_winner_prize_money` and
`final_runner_up_prize_money` among those of a league's (points for a win, `win_prize_money`, `draw_prize_money`).

The final's two amounts are in memory in the currency the screen shows them in, not in pounds: 4,600,000 with
2,000,000 0x40 bytes further on, in three places, and no `u32` of £3,951,653 or £1,718,110 at an aligned address
(what the euro amounts come to in pounds at 1.16407, the rate measured on a 26385295 save). In each of the three,
the bytes are a stream of 16-byte entries, a value and a pointer to its type (one of the game's
`sicore::RAW_TYPED_TRAITS<int>`, `<unsigned>`, `sicore::SYMBOL_TYPED_TRAITS` and others): four-letter symbols
(`0x776E707A` before the winner's amount, `0x6C73707A` before the loser's) with the amounts as `unsigned`, and the
symbols `cash` and `curr` next to them in what points into the stream. This reads as the competition's rules as the
game loads them, an amount with its currency, rather than as settings made for the stage.

The play-offs pay nothing through league settings either: the Serie BKT's other `LEAGUE_SETTINGS` has no list and
nothing per match, and the ten `sicomps::LEAGUE_POSITION_PLAYOFF` hold no amount in their first 0x60 bytes. Whether
the rules give play-offs prize money of their own, the way they give a cup's rounds, was not looked at.

Not known yet:
- which of the three copies the game pays from, if any, and when it reads it (when the round is played, or when the
  stage is set up), and so whether a change there would be paid;
- how the stream is laid out beyond these entries: which symbol is which amount, how rounds are told apart, and
  where the appearance fee of each round is;
- whether the game converts the amount to pounds at the day's rate when it pays, or once when it loads the rules.

Changing a cup's prize money is left until these are known.
