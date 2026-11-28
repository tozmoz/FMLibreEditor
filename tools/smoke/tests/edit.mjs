// Editing a player: fields written through the app's commands, read back by the probe, and undone from the change
// log; his city of birth set to another city of his nation and back, and refused a nation in its place; the squad
// numbers of two players of one team, where the undo that would give both one number is refused; a national team's
// reputation and one of its youth teams', the youth rating and settings of its men's and women's teams, and Heal all,
// Inspire all and Refresh all on its senior team's players, where the build has national teams; one amount of a league's
// prize money, where the build shows it; then one attribute through his profile's Edit mode, undone from the Changes tab.
import { SHOWN, VIS } from "../lib/app.mjs";
import { clubPlayers, topClubs } from "../lib/witness.mjs";
import { PROFILE as NATIONAL_PROFILE, ROWS as NATIONAL_ROWS, showTeams } from "./nationals.mjs";
import { leagueWitnesses, openGroup, probeStages, stageKey } from "./prizes.mjs";

export const name = "edit";
export const writes = true;

const FIELDS = ["attribute.finishing", "attribute.passing", "contract.wage"];
const NUMBER = "contract.squad_number";

export async function run({ app, report, probe }) {
  const [, club] = await topClubs(app, 2);
  const [player] = await clubPlayers(app, club, 1);
  const uid = player.uid;
  report.note(`witness: ${player.name} (${uid}) of ${club.name}`);
  const before = await app.must("read_values", { entity: "player", uid });
  const seen = probe.get("player", uid, FIELDS);
  report.check("the probe reads what the app reads", FIELDS.every((field) => seen[field] === before[field]), JSON.stringify(seen));

  const nudge = (value, step, top) => (value + step <= top ? value + step : value - step);
  const edits = [
    { field: "attribute.finishing", value: nudge(before["attribute.finishing"], 5, 100) },
    { field: "attribute.passing", value: nudge(before["attribute.passing"], 5, 100) },
    { field: "contract.wage", value: before["contract.wage"] + 1000 },
  ];
  const applied = await app.must("apply_edits", { entity: "player", uid, edits });
  report.check("applies three edits", applied.applied.length === 3 && applied.failed.length === 0, JSON.stringify(applied.failed));
  const written = probe.get("player", uid, FIELDS);
  report.check("the probe reads the new values", edits.every((edit) => written[edit.field] === edit.value), JSON.stringify(written));

  for (const change of [...applied.applied].reverse()) {
    const undone = await app.must("undo_change", { id: change.id });
    report.check(`undoes ${change.field}`, undone.undoneAt != null);
  }
  const twice = await app.invoke("undo_change", { id: applied.applied[0].id });
  report.check("refuses to undo twice", !twice.ok);
  const restored = probe.get("player", uid, FIELDS);
  report.check("the probe reads the old values again", FIELDS.every((field) => restored[field] === seen[field]), JSON.stringify(restored));

  await cityOfBirth({ app, report, probe, club });
  await squadNumbers({ app, report, probe, club });
  await nationalReputation({ app, report, probe });
  await nationalYouthRating({ app, report, probe });
  await nationalSettings({ app, report, probe });
  await nationalActions({ app, report, probe });
  await leaguePrizeMoney({ app, report, probe });

  // The same through his profile.
  await app.openTab("Players");
  await app.setInput(`${VIS}(".search input")`, String(uid));
  const rows = `[...document.querySelectorAll("table.grid tbody tr")].filter(${SHOWN})`;
  await app.waitFor(`${rows}.length === 1 && ${rows}[0].textContent.includes(${JSON.stringify(player.name)})`, "his row");
  await app.click(`${rows}[0]`, "his row");
  const profile = `${VIS}(".profile:not(.popup)")`;
  await app.waitFor(`${profile} && ${profile}.getAttribute("aria-busy") === "false"`, "his profile", 30000);
  await app.click(`${profile}.querySelector("button.edit-toggle")`, "Edit");
  const input = `${profile}.querySelector('.edit-input[data-field="attribute.finishing"]')`;
  await app.waitFor(input, "the Finishing input");
  const shown = Number(await app.js(`${input}.value`));
  await app.setInput(input, shown < 20 ? shown + 1 : shown - 1);
  await app.waitFor(`${profile}.querySelector(".edit-count.pending")`, "one change to apply");
  await app.click(`${profile}.querySelector(".edit-footer button.primary")`, "Apply");
  await app.waitFor(`!${profile}.classList.contains("editing") && ${profile}.querySelector(".edit-report")?.textContent`, "the report");
  const viaProfile = probe.get("player", uid, ["attribute.finishing"])["attribute.finishing"];
  report.check("Edit mode writes the attribute", viaProfile !== seen["attribute.finishing"], `${seen["attribute.finishing"]} → ${viaProfile}`);
  await app.shot("edit-applied");

  await app.openTab("Changes");
  const undo = `document.querySelector("table.changes-grid tbody tr td.col-status button")`;
  await app.waitFor(undo, "the change in the Changes tab");
  await app.click(undo, "Undo");
  await app.waitFor(`/Undone/.test(document.querySelector("table.changes-grid tbody tr td.col-status")?.textContent ?? "")`, "Undone");
  const back = probe.get("player", uid, ["attribute.finishing"])["attribute.finishing"];
  report.check("the Changes tab undoes it", back === seen["attribute.finishing"], `back to ${back}`);
  await app.openTab("Players");
  await app.press("Escape");
}

/** The city of birth of one of `club`'s players: set to another city of his nation, refused a nation, and undone. */
async function cityOfBirth({ app, report, probe, club }) {
  const cities = await app.must("birth_cities");
  let found = null;
  for (const player of await clubPlayers(app, club, 20)) {
    const values = await app.must("read_values", { entity: "player", uid: player.uid });
    const current = cities.find((city) => city.address === values.city_of_birth);
    const other = current && cities.find((city) => city.nationUid === current.nationUid && city.address !== current.address);
    if (other) {
      found = { player, values, current, other };
      break;
    }
  }
  if (found === null) {
    report.skip("the city of birth", `no player of ${club.name} was born in a city another city of his nation is offered beside`);
    return;
  }
  const { player, values, current, other } = found;
  const uid = player.uid;
  report.note(`city of birth: ${player.name} (${uid}), ${current.name} → ${other.name}`);
  const set = await app.must("apply_edits", { entity: "player", uid, edits: [{ field: "city_of_birth", value: other.address }] });
  report.check(
    "sets his city of birth to another city of his nation",
    set.applied.length === 1 && set.failed.length === 0,
    JSON.stringify(set.failed),
  );
  const written = probe.get("player", uid, ["city_of_birth"]).city_of_birth;
  report.check("the probe reads the new city", written === other.address, `${written}`);
  const nation = await app.must("apply_edits", { entity: "player", uid, edits: [{ field: "city_of_birth", value: values.nation }] });
  report.check(
    "refuses a nation as his city of birth",
    nation.applied.length === 0 && nation.failed[0]?.error.code === "edit.unsupported",
    nation.failed[0]?.error.code ?? "written",
  );
  for (const change of set.applied) {
    await app.must("undo_change", { id: change.id });
  }
  const back = probe.get("player", uid, ["city_of_birth"]).city_of_birth;
  report.check("undoing it puts his city back", back === current.address, `${back}`);
}

/**
 * The squad numbers of two players of one team of `club`: the first goes to a number nobody wears, the second takes the
 * number the first left, and the first's undo, which would put that number back beside the second, is refused with
 * nothing written (`edit.taken`, naming the second). The second's undo and then the first's go through, and the probe
 * reads both numbers as they were.
 */
async function squadNumbers({ app, report, probe, club }) {
  const [senior] = await app.must("club_squads", { uid: club.uid });
  const team = senior.players.filter((player) => player.playsHere);
  const numbers = new Map();
  for (const player of team) {
    numbers.set(player.uid, (await app.must("read_values", { entity: "player", uid: player.uid }))[NUMBER]);
  }
  // Numbers of their own: one player of the team wears each, as the game's own data has it for nearly every team.
  const wearing = (number) => [...numbers.values()].filter((worn) => worn === number).length;
  const [first, second] = team.filter((player) => numbers.get(player.uid) <= 99 && wearing(numbers.get(player.uid)) === 1);
  const free = Array.from({ length: 99 }, (_, i) => i + 1).find((number) => wearing(number) === 0);
  if (second === undefined || free === undefined) {
    report.skip("the squad numbers", `${club.name}'s first team has no two players with a number of their own to change`);
    return;
  }
  const [was, took] = [numbers.get(first.uid), numbers.get(second.uid)];
  report.note(`squad numbers: ${first.name} (${first.uid}) ${was} → ${free}, then ${second.name} (${second.uid}) ${took} → ${was}`);
  const edit = (player, value) =>
    app.must("apply_edits", { entity: "player", uid: player.uid, edits: [{ field: NUMBER, value }] });
  const read = (player) => probe.get("player", player.uid, [NUMBER])[NUMBER];
  const numbersNow = () => `${first.name} ${read(first)}, ${second.name} ${read(second)}`;

  const gone = await edit(first, free);
  const given = await edit(second, was);
  const written = [gone, given].every((edited) => edited.applied.length === 1 && edited.failed.length === 0);
  report.check(
    "gives one player a free number and his team-mate the number he left",
    written,
    JSON.stringify([gone.failed, given.failed]),
  );
  if (!written) return;
  report.check("the probe reads the new numbers", read(first) === free && read(second) === was, numbersNow());

  const [goneId, givenId] = [gone.applied[0].id, given.applied[0].id];
  const refused = await app.invoke("undo_change", { id: goneId });
  report.check(
    "refuses to put the first player's number back while his team-mate wears it",
    !refused.ok && refused.error.code === "edit.taken" && refused.error.params?.uid === String(second.uid),
    JSON.stringify(refused),
  );
  report.check("the refusal names him", refused.error?.params?.name === second.name, JSON.stringify(refused.error?.params));
  const log = await app.must("change_log");
  report.check(
    "nothing was written, and his change is still there to undo",
    read(first) === free && read(second) === was && log.find((change) => change.id === goneId)?.undoneAt == null,
    numbersNow(),
  );

  const undoneGiven = await app.invoke("undo_change", { id: givenId });
  const undoneGone = await app.invoke("undo_change", { id: goneId });
  report.check(
    "undoes the team-mate's change, and then the first player's",
    undoneGiven.ok && undoneGone.ok,
    JSON.stringify([undoneGiven.error, undoneGone.error]),
  );
  report.check("the probe reads both numbers as they were", read(first) === was && read(second) === took, numbersNow());
}

/**
 * The reputation of the best known national team's senior team, where the build has national teams (#169): written
 * through the app's command, read back by the probe and in the list's row, and undone; then that of one of its youth
 * teams (#210), the under-21s where it has them, read back by the probe and in its profile, and undone.
 */
async function nationalReputation({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    report.skip("a national team's reputation", `this build has no national teams to read (${status.reason})`);
    return;
  }
  const [team] = (await app.must("search_national_teams", { query: "", limit: 1 })).rows;
  const label = `${team.name}${team.women ? " (women)" : ""}`;
  const read = () => probe.get("national-team", team.uid, ["reputation"]).reputation;
  const row = async () =>
    (await app.must("search_national_teams", { query: String(team.uid), limit: 5 })).rows.find((t) => t.uid === team.uid);
  const before = (await app.must("read_values", { entity: "nationalTeam", uid: team.uid })).reputation;
  report.check(`the probe reads ${label}'s reputation as the app does`, read() === before && team.reputation === before,
    `${before}`);
  const value = before < 10000 ? before + 1 : before - 1;
  const applied = await app.must("apply_edits", {
    entity: "nationalTeam",
    uid: team.uid,
    edits: [{ field: "reputation", value }],
  });
  report.check("writes a national team's reputation", applied.applied.length === 1 && applied.failed.length === 0,
    JSON.stringify(applied.failed));
  if (applied.applied.length !== 1) return;
  report.check("the probe reads the new reputation, and the list's row shows it", read() === value &&
    (await row())?.reputation === value, `${before} → ${value}`);
  const logged = (await app.must("change_log")).find((change) => change.id === applied.applied[0].id);
  report.check("the change log names the national team", logged?.entity === "nationalTeam" && logged?.name === team.name,
    JSON.stringify({ entity: logged?.entity, name: logged?.name }));
  await app.must("undo_change", { id: applied.applied[0].id });
  report.check("the undo puts it back", read() === before && (await row())?.reputation === before, `${read()}`);

  // One of its youth teams, by its kind (#210): the under-21s where it has them.
  const { teams } = await app.must("national_squad", { uid: team.uid });
  const youth = teams.find((side) => side.kind === 10) ?? teams.find((side) => side.kind !== 0);
  if (!youth) {
    report.skip("a national youth team's reputation", `${label} has no youth team`);
    return;
  }
  const field = `team.${youth.kind}.reputation`;
  const readYouth = () => probe.get("national-team", team.uid, [field])[field];
  const shownYouth = async () =>
    (await app.must("national_squad", { uid: team.uid, kind: youth.kind })).teams.find((side) => side.kind === youth.kind)
      ?.reputation;
  const was = (await app.must("read_values", { entity: "nationalTeam", uid: team.uid }))[field];
  report.check(`the probe reads ${label}'s ${field} as the app does`, readYouth() === was && youth.reputation === was,
    `${was}`);
  const to = was < 10000 ? was + 1 : was - 1;
  const done = await app.must("apply_edits", { entity: "nationalTeam", uid: team.uid, edits: [{ field, value: to }] });
  report.check(`writes ${field}`, done.applied.length === 1 && done.failed.length === 0, JSON.stringify(done.failed));
  if (done.applied.length !== 1) return;
  report.check("the probe reads it, the profile shows it, and the senior team's stays",
    readYouth() === to && (await shownYouth()) === to && read() === before, `${was} → ${to}`);
  const youthLogged = (await app.must("change_log")).find((change) => change.id === done.applied[0].id);
  report.check("the change log names the national team and the field",
    youthLogged?.entity === "nationalTeam" && youthLogged?.name === team.name && youthLogged?.field === field,
    JSON.stringify({ entity: youthLogged?.entity, name: youthLogged?.name, field: youthLogged?.field }));
  await app.must("undo_change", { id: done.applied[0].id });
  report.check("the undo puts the youth team's back", readYouth() === was && (await shownYouth()) === was, `${readYouth()}`);
}

/**
 * The youth ratings of the best known men's and women's national teams, where the layout places them: each written
 * through the app's command, read back by the probe and in its profile, and undone.
 */
async function nationalYouthRating({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    report.skip("a nation's youth rating", `this build has no national teams to read (${status.reason})`);
    return;
  }
  const { rows } = await app.must("search_national_teams", { query: "", limit: 1000 });
  const men = rows.find((row) => !row.women);
  const women = rows.find((row) => row.women);
  const field = "youth_rating";
  const before = men && (await app.must("read_values", { entity: "nationalTeam", uid: men.uid }))[field];
  if (before === undefined) {
    report.skip("a nation's youth rating", "this build's layout does not place it");
    return;
  }
  const checkTeam = async (team) => {
    const label = `${team.name}${team.women ? " (women)" : ""}`;
    const read = () => probe.get("national-team", team.uid, [field])[field];
    const shown = async () => (await app.must("national_squad", { uid: team.uid })).youthRating;
    const was = (await app.must("read_values", { entity: "nationalTeam", uid: team.uid }))[field];
    report.check(`the probe reads ${label}'s youth rating as the app does`, read() === was && (await shown()) === was,
      `${was}`);
    const value = was < 200 ? was + 1 : was - 1;
    const applied = await app.must("apply_edits", { entity: "nationalTeam", uid: team.uid, edits: [{ field, value }] });
    report.check(`writes ${label}'s youth rating`, applied.applied.length === 1 && applied.failed.length === 0,
      JSON.stringify(applied.failed));
    if (applied.applied.length !== 1) return;
    report.check(`the probe reads ${label}'s new youth rating, and the profile shows it`,
      read() === value && (await shown()) === value, `${was} → ${value}`);
    await app.must("undo_change", { id: applied.applied[0].id });
    report.check(`the undo puts ${label}'s back`, read() === was && (await shown()) === was, `${read()}`);
  };
  await checkTeam(men);
  if (women) await checkTeam(women);
}

/**
 * The settings of the best known men's and women's national teams, where the layout places them: each of the eight
 * written through the app's command with the next valid value, read back by the probe and in its profile, and undone.
 * The economic factor and the state of development belong to the nation, so a write on one team shows on the other.
 */
async function nationalSettings({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    report.skip("a nation's settings", `this build has no national teams to read (${status.reason})`);
    return;
  }
  const { rows } = await app.must("search_national_teams", { query: "", limit: 1000 });
  const fields = [
    "game_importance",
    "fa_financial_power",
    "fa_patience",
    "attendance",
    "min_attendance",
    "max_attendance",
    "economic_factor",
    "state_of_development",
  ];
  const most = {
    fa_financial_power: 20,
    fa_patience: 20,
    attendance: 250_000,
    min_attendance: 250_000,
    max_attendance: 250_000,
    economic_factor: 20,
  };
  const nationFields = ["economic_factor", "state_of_development"];
  const profileKey = (field) => field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const shown = async (uid, field) => (await app.must("national_squad", { uid })).settings?.[profileKey(field)];
  const read = (uid, field) => probe.get("national-team", uid, [field])[field];
  const test = async (team) => {
    const label = `${team.name}${team.women ? " (women)" : ""}`;
    const before = await app.must("read_values", { entity: "nationalTeam", uid: team.uid });
    const present = fields.filter((field) => before[field] !== undefined);
    if (present.length === 0) {
      report.skip(`${label}'s settings`, "this build's layout does not place them");
      return;
    }
    report.check(`the probe reads ${label}'s settings as the app does`,
      (await Promise.all(present.map(async (field) =>
        read(team.uid, field) === before[field] && (await shown(team.uid, field)) === before[field]))).every(Boolean),
      JSON.stringify(Object.fromEntries(present.map((field) => [field, before[field]]))));
    // The nation's own fields, which its men's and women's teams share: read them on the other team.
    const shared = rows.find((row) => row.women !== team.women && row.nationUid === team.nationUid) ?? null;
    for (const field of present) {
      const was = before[field];
      const value = field === "game_importance" ? (was % 4) + 1
        : field === "state_of_development" ? (was % 3) + 1
          : was < most[field] ? was + 1
            : was - 1;
      const applied = await app.must("apply_edits", { entity: "nationalTeam", uid: team.uid, edits: [{ field, value }] });
      report.check(`writes ${label}'s ${field}`, applied.applied.length === 1 && applied.failed.length === 0,
        JSON.stringify(applied.failed));
      if (applied.applied.length !== 1) continue;
      report.check(`the probe reads the new ${field}, and the profile shows it`,
        read(team.uid, field) === value && (await shown(team.uid, field)) === value, `${was} → ${value}`);
      if (nationFields.includes(field) && shared) {
        const onShared = (await app.must("read_values", { entity: "nationalTeam", uid: shared.uid }))[field];
        report.check(`the nation's ${field} is shared with ${shared.name}`, onShared === value, `${onShared}`);
      }
      await app.must("undo_change", { id: applied.applied[0].id });
      report.check(`the undo puts ${label}'s ${field} back`,
        read(team.uid, field) === was && (await shown(team.uid, field)) === was, `${read(team.uid, field)}`);
      if (nationFields.includes(field) && shared) {
        const onShared = (await app.must("read_values", { entity: "nationalTeam", uid: shared.uid }))[field];
        report.check(`the undo puts the nation's ${field} back on ${shared.name}`, onShared === was, `${onShared}`);
      }
    }
  };
  const men = rows.find((row) => !row.women);
  const women = rows.find((row) => row.women);
  if (men) await test(men);
  if (women) await test(women);
}

/** The values Refresh all and Inspire all set on each player of a squad, by field (see `act_on_players`). */
const NATIONAL_ACTIONS = {
  refresh: { condition: 10000, match_sharpness: 10000, jadedness: -500 },
  inspire: { morale: 20, "contract.unhappiness": 0 },
};

/**
 * Heal all, Inspire all and Refresh all for the players the senior team of the best known men's national team lists
 * (#217), where the build has national teams: Refresh all and Inspire all through the app's command, as many changes
 * written as the squad has values not set yet, every player then holding what they set (the first three read by the
 * probe too), one batch in the change log, and its undo putting every value back; Heal all healing those injured (or
 * writing nothing where none is), and undone; Lift bans refused; then Refresh all in the team's profile, the line under
 * the buttons, and the Undo on it.
 */
async function nationalActions({ app, report, probe }) {
  const status = await app.must("national_status");
  if (!status.available) {
    report.skip("a national team's squad actions", `this build has no national teams to read (${status.reason})`);
    return;
  }
  const men = (await app.must("search_national_teams", { query: "", limit: 1000, women: false })).rows;
  const team = men.find((t) => t.players > 0 && t.code);
  if (!team) {
    report.skip("a national team's squad actions", "no men's team lists players");
    return;
  }
  const squad = (await app.must("national_squad", { uid: team.uid })).squad.players;
  report.note(`witness: ${team.name}'s senior team, ${squad.length} players`);
  const values = () => Promise.all(squad.map((p) => app.must("read_values", { entity: "player", uid: p.uid })));
  const sample = squad.slice(0, 3);
  // The values of `fields` a player holds that the action has to set: those the editor reads, and not set already.
  const due = (read, sets) =>
    read.reduce((n, v) => n + Object.keys(sets).filter((f) => typeof v[f] === "number" && v[f] !== sets[f]).length, 0);
  const holds = (read, before, sets) =>
    read.every((v, i) => Object.keys(sets).every((f) => typeof before[i][f] !== "number" || v[f] === sets[f]));

  for (const [action, sets] of Object.entries(NATIONAL_ACTIONS)) {
    const fields = Object.keys(sets);
    const probed = () => sample.map((p) => probe.get("player", p.uid, fields));
    const before = await values();
    const probedBefore = probed();
    const expected = due(before, sets);
    const done = await app.must("national_team_action", { uid: team.uid, action });
    report.check(`${action} writes a change for each value of the squad not set yet`,
      done.applied === expected && done.failed.length === 0,
      `${done.applied} of ${expected}; ${JSON.stringify(done.failed.slice(0, 3))}`);
    const probedAfter = probed();
    report.check(`every player holds what ${action} sets, as the probe reads the first three`,
      holds(await values(), before, sets) && holds(probedAfter, probedBefore, sets), JSON.stringify(probedAfter[0]));
    const logged = (await app.must("change_log")).filter((change) => change.batch === done.batch);
    report.check("the change log keeps them as one batch", logged.length === done.applied, `${logged.length}`);
    if (done.applied === 0) continue;
    const undone = await app.must("undo_batch", { batch: done.batch });
    report.check(`the undo of ${action}'s batch`, undone.undone === done.applied && undone.failed.length === 0,
      JSON.stringify(undone.failed.slice(0, 3)));
    const back = await values();
    report.check("puts every value back, as the probe reads them",
      back.every((v, i) => fields.every((f) => v[f] === before[i][f])) &&
        JSON.stringify(probed()) === JSON.stringify(probedBefore),
      JSON.stringify(probed()[0]));
  }

  // Heal all: those injured healed, and back again; nothing written where nobody is.
  const injured = squad.filter((p) => p.injuries > 0);
  const injuries = () => Promise.all(injured.map((p) => app.must("player_details", { uid: p.uid })));
  const wereInjured = await injuries();
  const healed = await app.must("national_team_action", { uid: team.uid, action: "heal" });
  if (injured.length === 0) {
    report.check("Heal all writes nothing where nobody is injured", healed.applied === 0 && healed.failed.length === 0,
      JSON.stringify(healed));
  } else {
    report.check(`Heal all heals the ${injured.length} injured`, healed.applied === injured.length &&
      (await injuries()).every((d) => d.injuries.length === 0), injured.map((p) => p.name).join(", "));
    const undone = await app.must("undo_batch", { batch: healed.batch });
    report.check("its undo puts their injuries back", undone.undone === healed.applied &&
      JSON.stringify((await injuries()).map((d) => d.injuries)) === JSON.stringify(wereInjured.map((d) => d.injuries)));
  }
  const refused = await app.invoke("national_team_action", { uid: team.uid, action: "liftBans" });
  report.check("Lift bans is a club's only, and refused", !refused.ok && refused.error?.code === "national.action",
    JSON.stringify(refused.error ?? refused.value));

  // Refresh all in the team's profile, and the Undo on the line under the buttons.
  const before = await values();
  const expected = due(before, NATIONAL_ACTIONS.refresh);
  if (expected === 0) {
    report.skip("Refresh all in the profile", `${team.name}'s players are all refreshed already`);
    return;
  }
  await showTeams(app, "nationals");
  await app.waitFor(`${NATIONAL_ROWS}.length > 0`, "the national teams' rows");
  await app.setInput(`${VIS}(".search input")`, team.code);
  const row = `${NATIONAL_ROWS}.find((tr) => tr.querySelector(".col-uid")?.textContent.trim() === ${JSON.stringify(String(team.uid))})`;
  await app.waitFor(row, `the row of ${team.name}`);
  await app.click(row, `the row of ${team.name}`);
  await app.waitFor(`${NATIONAL_PROFILE} && ${NATIONAL_PROFILE}.getAttribute("aria-busy") === "false"`, "the team's profile", 30000);
  const refresh = `[...${NATIONAL_PROFILE}.querySelectorAll(".squad-buttons button")].find((b) => b.textContent === "Refresh all")`;
  await app.waitFor(`${refresh} && !${refresh}.disabled && !${refresh}.hasAttribute("aria-disabled")`, "Refresh all");
  await app.click(refresh, "Refresh all");
  const result = `${NATIONAL_PROFILE}.querySelector(".squad-result")`;
  const undo = `${result}?.querySelector("button")`;
  await app.waitFor(`${result}?.textContent.includes("written") && ${undo} && !${undo}.hasAttribute("aria-disabled")`,
    "the line under the buttons", 30000);
  const said = await app.js(`${result}.querySelector("p")?.textContent`);
  report.check("Refresh all in the profile refreshes the squad, and the line under the buttons counts the changes",
    holds(await values(), before, NATIONAL_ACTIONS.refresh) &&
      said === `${expected === 1 ? "1 change" : `${expected.toLocaleString("en")} changes`} written`, said);
  await app.shot("national-actions-refreshed");
  await app.click(undo, "Undo");
  await app.waitFor(`${result}?.textContent.includes("Undid")`, "the undo", 30000);
  const back = await values();
  report.check("Undo on that line puts every value back",
    back.every((v, i) => Object.keys(NATIONAL_ACTIONS.refresh).every((f) => v[f] === before[i][f])),
    await app.js(`${result}.querySelector("p")?.textContent`));
  await app.setInput(`${VIS}(".search input")`, "");
  await app.press("Escape");
  await showTeams(app, "clubs");
}

/**
 * What a league pays (#123), where the build shows it: one amount of its first stage (per win, or else for the first
 * place) set through the app's command for every club in it, read back by the probe in each settings of the stage and
 * in what the app keeps, logged as a change of the club with the league, and undone; then the same amount through the
 * group's Change amounts and Save in the club's profile, and undone.
 */
async function leaguePrizeMoney({ app, report, probe }) {
  const found = await leagueWitnesses(app);
  if (found.unavailable || !found.paying) {
    report.skip("a league's prize money", found.unavailable ? `this build shows none (${found.unavailable})`
      : "no league of the best known clubs pays anything this season");
    return;
  }
  const { club, league } = found.paying;
  const stage = league.stages[0];
  const [kind, was] = stage.win > 0 ? ["win", stage.win] : ["place", stage.byPosition[0]];
  const field = kind === "win" ? "prize.win" : "prize.place.1";
  const input = (pounds) => (kind === "win" ? { kind, pounds } : { kind, place: 1, pounds });
  const as = (pounds) => stageKey(kind === "win" ? { ...stage, win: pounds } : { ...stage, byPosition: [pounds, ...stage.byPosition.slice(1)] });
  // Whether the probe reads the stage paying `pounds` in each of its settings: none of them pays another of the amounts.
  const reads = (pounds) => {
    const seen = probeStages(probe, league.uid);
    return [was, was + 1, was + 2].every((amount) => seen.includes(as(amount)) === (amount === pounds));
  };
  const kept = async () => (await app.must("league_prizes", { club: club.uid, again: false })).league?.stages[0];
  report.note(`witness: ${league.name} (${league.uid}) through ${club.name}, ${field} ${was}`);
  report.check(`the probe reads ${league.name}'s ${field} as the app does`, reads(was), `${was}`);

  const to = was + 1;
  const set = await app.must("set_league_prizes", { club: club.uid, stage: 0, amounts: [input(to)] });
  report.check(`sets ${field} of ${league.name}`, set.changes.length === 1 && set.league?.stages[0] != null &&
    stageKey(set.league.stages[0]) === as(to), JSON.stringify(set.changes.map((c) => c.field)));
  if (set.changes.length !== 1) return;
  report.check("the probe reads it in each settings of the stage, and the app keeps it", reads(to) &&
    stageKey(await kept()) === as(to), `${was} → ${to}`);
  const logged = (await app.must("change_log")).find((change) => change.id === set.changes[0].id);
  report.check("the change log keeps it as a change of the club, with the league",
    logged?.entity === "club" && logged?.uid === club.uid && logged?.field === field && logged?.prize?.leagueUid === league.uid &&
      logged?.prize?.settings === stage.count,
    JSON.stringify({ entity: logged?.entity, field: logged?.field, prize: logged?.prize }));
  await app.must("undo_change", { id: set.changes[0].id });
  report.check("the undo puts it back", reads(was) && stageKey(await kept()) === as(was), `${to} → ${was}`);

  // The same through the group in the club's profile: Change amounts, the amount typed, Save.
  const group = `${VIS}(".profile:not(.popup)")?.querySelector("section.league-prizes")`;
  await openGroup(app, club);
  const change = `[...${group}.querySelectorAll(".prize-actions button")].find((b) => b.textContent === "Change amounts")`;
  await app.waitFor(`${change} && !${change}.disabled`, "Change amounts");
  await app.click(change, "Change amounts");
  const label = kind === "win" ? "Per win" : "1.";
  const box = `${group}.querySelectorAll(".league-stage")[0].querySelector('input.prize-input[aria-label="${label}"]')`;
  await app.waitFor(box, `the ${label} input`);
  await app.setInput(box, String(was + 2));
  const save = `[...${group}.querySelectorAll(".prize-edit button")].find((b) => b.textContent === "Save amounts")`;
  await app.waitFor(`${save} && !${save}.disabled`, "Save amounts");
  await app.click(save, "Save amounts");
  await app.waitFor(`!${group}.querySelector("input.prize-input")`, "the amounts saved", 30000);
  const shown = await app.js(`${group}.querySelectorAll(".league-stage")[0].textContent`);
  report.check("Save writes the amount typed, and the group shows it", reads(was + 2) &&
    shown.replace(/\D/g, "").includes(String(was + 2)), `${was} → ${was + 2}`);
  const saved = (await app.must("change_log")).find((change) => change.undoneAt == null && change.entity === "club" &&
    change.uid === club.uid && change.field === field);
  if (saved) await app.must("undo_change", { id: saved.id });
  report.check("its undo puts it back", saved != null && reads(was), `${was + 2} → ${was}`);
  await app.press("Escape");
}
