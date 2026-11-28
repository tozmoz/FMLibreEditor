// Boosting a team for the match of the day (#270): every attribute of every player of a team that plays a match on the
// game's day, of the best known club no human manages that has one (the probe lists the day's matches), at its best
// until the game's day is over, then put back as it was (see `boost_team`). A team that plays no match that day is
// refused, and nothing written. With the game on one day throughout: the boost read back by the probe and remembered in
// frozen.json with the day and what each attribute was; an attribute the probe lowers as the game would put back at its
// best by the hold; one the user writes himself left as his, until the undo of his change writes the best back;
// unticked, every attribute as it was. The day being over is played by the file, with copies of the app on a data
// folder of their own: one boosts the team and is closed with the boost in the game; one started on the boost's day
// holds it again and says so; one started with the boost's day set to the day before puts every attribute back as it
// connects, and says so. Then the Squad tab: the box after the freezing ones, its note and its (i), the rows' tags and
// the line under the buttons, ticked and unticked, and the box of a team of the club with no match that day waiting.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { App, SHOWN, VIS, sleep } from "../lib/app.mjs";
import { topClubs } from "../lib/witness.mjs";

export const name = "boost";
export const writes = true;

/** Long enough for the app's hold, every 2 s, to have put back what the probe changed. */
const HOLD = 4500;

/** The attributes that are at their best at 1, not at 20. */
const LOWER_IS_BETTER = new Set(["attribute.injury_proneness", "attribute.dirtiness"]);

/** An attribute's best as stored: 20 (100), or 1 (5) where lower is better. */
const best = (key) => (LOWER_IS_BETTER.has(key) ? 5 : 100);

/** The game's day as the app's file keeps a boost's, such as 20261019. */
const dayOf = (date) => date.year * 10000 + date.month * 100 + date.day;

/** The boosts the file `file` remembers, over every save, by player. */
function boostsIn(file) {
  if (!existsSync(file)) return {};
  const saves = Object.values(JSON.parse(readFileSync(file, "utf8")).saves);
  return Object.assign({}, ...saves.map((save) => save.boosts ?? {}));
}

/** Gives every boost the file `file` remembers the day `day`, as if it had been given on that day. */
function setBoostDay(file, day) {
  const remembered = JSON.parse(readFileSync(file, "utf8"));
  for (const save of Object.values(remembered.saves)) {
    for (const boost of Object.values(save.boosts ?? {})) boost.day = day;
  }
  writeFileSync(file, JSON.stringify(remembered, null, 2));
}

/** The team `index` of the club `uid` as the copy of the app `from` lists its squads, with its players. */
const squadOf = async (from, uid, index) =>
  (await from.must("club_squads", { uid })).find((team) => team.clubUid === uid && team.index === index);

export async function run({ app, report, probe }) {
  // The best known club with a team that plays on the game's day, and one whose first team does not.
  const playing = probe.matchesToday();
  const plays = (uid, index) => playing.some((t) => t.club === uid && t.team === index);
  const clubs = await topClubs(app, 200);
  let club = null;
  let team = null;
  for (const candidate of clubs.filter((c) => playing.some((t) => t.club === c.uid))) {
    for (const { team: index } of playing.filter((t) => t.club === candidate.uid)) {
      const found = await squadOf(app, candidate.uid, index);
      if ((found?.players.length ?? 0) >= 2) {
        [club, team] = [candidate, found];
        break;
      }
    }
    if (team) break;
  }
  if (!team) {
    report.skip("boosts a team for the match", `none of the ${clubs.length} best known clubs plays a match on the game's day`);
    return;
  }
  const players = team.players;
  await refusedWithoutAMatch({ app, report, probe, idle: clubs.find((c) => !plays(c.uid, 0)) });
  const day = await app.must("match_day", { club: club.uid, team: team.index });
  report.check("the app says the team plays today", day.today, JSON.stringify(day));
  const keys = (await app.must("edit_fields", { entity: "player" })).map((f) => f.key).filter((k) => k.startsWith("attribute."));
  /** A player's attributes as stored, as the copy of the app `from` reads them. */
  const read = async (from, uid) =>
    Object.fromEntries(Object.entries(await from.must("read_values", { entity: "player", uid })).filter(([key]) => key.startsWith("attribute.")));
  const before = new Map();
  for (const player of players) before.set(player.uid, await read(app, player.uid));
  /** What `from` reads that is not what `expected` gives for each player, as "name: key was -> now". */
  const differing = async (from, expected) => {
    const lines = [];
    for (const player of players) {
      const now = await read(from, player.uid);
      for (const [key, value] of Object.entries(expected(player.uid))) {
        if (now[key] !== value) lines.push(`${player.name}: ${key} ${value} -> ${now[key]}`);
      }
    }
    return lines;
  };
  const atBest = (uid) => Object.fromEntries(Object.keys(before.get(uid)).map((key) => [key, best(key)]));
  const asBefore = (uid) => before.get(uid);
  const [first, second] = players;
  const today = dayOf((await app.must("current_connection")).gameDate);
  const file = join(app.folder, "data", "frozen.json");
  const boost = (on, from = app) => from.must("boost_team", { club: team.clubUid, team: team.index, on });
  report.note(`witness: ${club.name} (${club.uid}) team ${team.index}, ${players.length} players, day ${today}`);

  try {
    const done = await boost(true);
    report.check(
      "boosts every player of the team",
      done.changed === players.length && done.failed.length === 0,
      `${done.changed} of ${players.length}, ${done.failed.length} refused`,
    );
    report.check("their squad rows say so", (await squadOf(app, club.uid, team.index)).players.every((p) => p.boosted));
    const short = await differing(app, atBest);
    report.check("every attribute at its best", short.length === 0, short.slice(0, 3).join("; "));
    const probed = probe.get("player", first.uid, keys);
    report.check("as the probe reads them", keys.every((key) => probed[key] === best(key)), `${first.name}: ${JSON.stringify(probed)}`);
    const kept = boostsIn(file);
    const noted = players.every(
      (p) => kept[p.uid]?.active && kept[p.uid].day === today && keys.every((key) => kept[p.uid].originals[key] === before.get(p.uid)[key]),
    );
    report.check("frozen.json remembers each with the day and what his attributes were", noted, JSON.stringify(kept[first.uid]));
    report.check("a second press boosts nobody more", (await boost(true)).changed === 0);
    report.check("and keeps what the first noted", boostsIn(file)[first.uid]?.originals["attribute.finishing"] === before.get(first.uid)["attribute.finishing"]);

    // The game takes some of it: the hold puts it back.
    probe.set("player", first.uid, "attribute.finishing", 60);
    await sleep(HOLD);
    const held = probe.get("player", first.uid, ["attribute.finishing"])["attribute.finishing"];
    report.check("puts back at its best what the game took", held === 100, `changed to 60, reads ${held}`);

    // A value the user writes himself is his, until the undo of his change writes the best back.
    const key = "attribute.passing";
    // 14, as stored.
    const applied = await app.must("apply_edits", { entity: "player", uid: second.uid, edits: [{ field: key, value: 70 }] });
    await sleep(HOLD);
    const his = probe.get("player", second.uid, [key])[key];
    report.check("keeps a value the user writes himself", applied.failed.length === 0 && his === 70, `${second.name}: reads ${his}`);
    report.check("which the boost lets go of", boostsIn(file)[second.uid]?.released?.[key] === before.get(second.uid)[key]);
    await app.must("undo_change", { id: applied.applied[0].id });
    // The hold has the file remember it.
    await sleep(HOLD);
    report.check("and takes back once the undo writes its best again", boostsIn(file)[second.uid]?.originals[key] === before.get(second.uid)[key]);

    const off = await boost(false);
    report.check("unticked, puts every player back", off.changed === players.length && off.failed.length === 0, `${off.changed} of ${players.length}`);
    const left = await differing(app, asBefore);
    report.check("every attribute as it was, his passing too", left.length === 0, left.slice(0, 3).join("; "));
    const back = probe.get("player", first.uid, keys);
    report.check("as the probe reads them", keys.every((k) => back[k] === before.get(first.uid)[k]));
    report.check("the rows no longer boosted", (await squadOf(app, club.uid, team.index)).players.every((p) => !p.boosted));
    report.check("frozen.json keeps them as over", players.every((p) => boostsIn(file)[p.uid]?.active === false));
    report.check("a second press puts nobody back", (await boost(false)).changed === 0);

    await dayOver({ app, report, club, team, players, boost, differing, atBest, asBefore, today });
    await throughTheSquad({ app, report, club, team, plays, players, differing, atBest, asBefore });
  } finally {
    await app.invoke("boost_team", { club: team.clubUid, team: team.index, on: false });
    // Whatever a step left, written back as it was.
    let written = 0;
    for (const player of players) {
      const now = await read(app, player.uid);
      for (const [k, value] of Object.entries(before.get(player.uid))) {
        if (now[k] !== value) {
          probe.set("player", player.uid, k, value);
          written += 1;
        }
      }
    }
    const still = await differing(app, asBefore);
    report.check("the team's attributes as they were at the end", still.length === 0, `${written} written back; ${still.slice(0, 3).join("; ")}`);
  }
}

/**
 * A team that plays no match on the game's day, the first team of `idle`: the app says so, with its next match day,
 * and refuses to boost it, writing nothing.
 */
async function refusedWithoutAMatch({ app, report, probe, idle }) {
  if (!idle) {
    report.skip("refuses a team with no match today", "every one of the best known clubs' first teams plays today");
    return;
  }
  const team = await squadOf(app, idle.uid, 0);
  const [first] = team?.players ?? [];
  if (!first) {
    report.skip("refuses a team with no match today", `${idle.name}'s first team lists nobody`);
    return;
  }
  const day = await app.must("match_day", { club: idle.uid, team: 0 });
  report.check("the app says a team with no match today plays none", day.today === false, `${idle.name}: ${JSON.stringify(day)}`);
  const finishing = () => probe.get("player", first.uid, ["attribute.finishing"])["attribute.finishing"];
  const before = finishing();
  const refused = await app.invoke("boost_team", { club: idle.uid, team: 0, on: true });
  report.check(
    "refuses to boost it",
    !refused.ok && refused.error?.code === "boost.noMatch" && (day.next === null || refused.error.params?.next !== undefined),
    JSON.stringify(refused.error ?? refused.value),
  );
  report.check("and writes nothing", finishing() === before && !(await squadOf(app, idle.uid, 0)).players.some((p) => p.boosted));
}

/**
 * The game's day over while the app was closed, played by the file of copies of the app on a data folder of their own:
 * the first boosts the team and is closed; the second, on the boost's day, holds it again and says so; the third, with
 * the boost's day set to the day before, puts every attribute back as it connects, and says so.
 */
async function dayOver({ app, report, club, team, players, boost, differing, atBest, asBefore, today }) {
  const data = join(app.folder, "boost-day", "data");
  const file = join(data, "frozen.json");
  const copy = (port, label) =>
    App.start({ exe: app.exe, port, folder: join(app.folder, "boost-day", label), env: { FMLIBRE_DATA: data } });
  const noticeOf = (from) => from.waitFor(`document.querySelector(".frozen-notice")?.textContent`, "the notice", 10000).catch(() => "");

  const first = await copy(app.port + 2, "first");
  try {
    await first.connect();
    const done = await boost(true, first);
    report.check("a copy of the app boosts the team", done.changed === players.length, `${done.changed} of ${players.length}`);
  } finally {
    first.close();
  }
  await sleep(1000);
  const short = await differing(app, atBest);
  report.check("closed, it leaves the boost in the game", short.length === 0, short.slice(0, 3).join("; "));

  const second = await copy(app.port + 4, "second");
  try {
    await second.connect();
    const notice = await noticeOf(second);
    report.check("started again on the boost's day, it holds it again and says so", notice.includes(`Match boost: ${players[0].name}`), notice);
    const rows = (await squadOf(second, club.uid, team.index))?.players ?? [];
    report.check("its rows say they are boosted", rows.length > 0 && rows.every((p) => p.boosted));
    report.check("no errors in its console", second.consoleProblems.length === 0, second.consoleProblems.slice(0, 3).join(" || "));
  } finally {
    second.close();
  }

  // As if the game had moved on a day while the app was closed: the boost's day is the day before.
  setBoostDay(file, today - 1);
  const third = await copy(app.port + 2, "third");
  try {
    await third.connect();
    const notice = await noticeOf(third);
    report.check(
      "started on a later day, it puts every attribute back and says so",
      notice.startsWith("Attributes back as they were") && notice.includes(`Match boost over: ${players[0].name}`),
      notice,
    );
    const left = await differing(third, asBefore);
    report.check("every attribute as it was", left.length === 0, left.slice(0, 3).join("; "));
    report.check("its file keeps them as over", players.every((p) => boostsIn(file)[p.uid]?.active === false));
    await third.shot("boost-day-over");
  } finally {
    third.close();
  }
}

/**
 * The Squad tab of the club, on the boosted team: Boost for the match after the boxes that freeze, its note and its
 * (i), ticked (every row tagged, the line under the buttons counting the players) and unticked (every attribute as it
 * was); on a team of the club with no match today, the box waits and its note says when the team plays next.
 */
async function throughTheSquad({ app, report, club, team, plays, players, differing, atBest, asBefore }) {
  await app.openClub(club.name, club.uid);
  await app.click(
    `[...document.querySelectorAll(".profile-tabs [role=tab]")].filter(${SHOWN}).find((t) => t.textContent.trim() === "Squad")`,
    "the Squad tab",
  );
  const tab = `${VIS}(".squad-tab")`;
  const squads = await app.must("club_squads", { uid: club.uid });
  const slotOf = (found) => squads.findIndex((t) => t.clubUid === found.clubUid && t.index === found.index);
  const showTeam = async (slot, what) => {
    const button = `${tab}?.querySelectorAll(".squad-teams button")[${slot}]`;
    await app.waitFor(button, what, 30000);
    if (!(await app.js(`${button}.getAttribute("aria-pressed") === "true"`))) await app.click(button, what);
    await app.waitFor(`${button}.getAttribute("aria-pressed") === "true"`, what, 10000);
  };
  await showTeam(slotOf(team), "the boosted team");
  const labels = `[...(${tab}?.querySelectorAll(".squad-freezes label.freeze-toggle") ?? [])]`;
  const label = `${labels}.find((l) => l.textContent === "Boost for the match")`;
  const box = `${label}?.querySelector("input")`;
  await app.waitFor(`${box} && !${box}.disabled`, "Boost for the match", 30000);
  report.check("the Squad tab has Boost for the match after the boxes that freeze", await app.js(`${labels}.at(-1) === ${label}`));
  const note = await app.note(label, "Boost for the match");
  report.check("its note says it goes back once the day changes", note.includes("until the game's day changes"), note);
  const info = await app.js(`(() => {
    const tip = ${label}?.nextElementSibling;
    return tip?.matches(".info-tip") ? [tip.querySelector("button").getAttribute("aria-label"), tip.querySelector(".info-tip-note").textContent] : null;
  })()`);
  report.check(
    "an (i) after it says it lasts one match day",
    info?.[0] === "How does the match boost work?" && info[1].startsWith("For one match day"),
    JSON.stringify(info),
  );

  const result = `${tab}.querySelector(".squad-result p")`;
  await app.click(box, "Boost for the match");
  await app.waitFor(`${box}.checked && ${result}?.textContent.startsWith("Boosted")`, "the boost", 30000);
  const line = await app.js(`${result}.textContent`);
  report.check("ticked, the line counts the players", line === `Boosted the attributes of ${players.length} players until the day changes`, line);
  await app.waitFor(`${tab}.querySelectorAll(".tag.boosted").length === ${players.length}`, "the rows' tags", 10000).catch(() => {});
  const tags = await app.js(`[...${tab}.querySelectorAll(".tag.boosted")].map((t) => t.textContent)`);
  report.check("every row tagged Boosted", tags.length === players.length && tags.every((t) => t === "Boosted"), `${tags.length} of ${players.length}`);
  const short = await differing(app, atBest);
  report.check("and every attribute at its best", short.length === 0, short.slice(0, 3).join("; "));
  await app.shot("boost-squad");

  await sleep(300);
  await app.click(box, "Boost for the match");
  await app.waitFor(`!${box}.checked && ${result}?.textContent.startsWith("Put back")`, "the put back", 30000);
  const after = await app.js(`${result}.textContent`);
  report.check("unticked, the line says they are put back", after === `Put back the attributes of ${players.length} players`, after);
  const left = await differing(app, asBefore);
  report.check("and every attribute as it was", left.length === 0, left.slice(0, 3).join("; "));

  // A team of the club with no match today: the box waits, and says when the team plays next.
  const idle = squads.findIndex((t) => t.clubUid === club.uid && !plays(t.clubUid, t.index) && t.players.length > 0);
  if (idle < 0) {
    report.skip("the box of a team with no match today waits", `every team of ${club.name} plays today`);
    return;
  }
  await showTeam(idle, "a team with no match today");
  await app.waitFor(`${box} && ${box}.disabled`, "the box waiting", 30000).catch(() => {});
  report.check("the box of a team with no match today waits", await app.js(`Boolean(${box}?.disabled)`));
  const waiting = await app.note(label, "Boost for the match");
  report.check("its note says the boost is for a match day only", waiting.startsWith("Only on a match day"), waiting);
}
