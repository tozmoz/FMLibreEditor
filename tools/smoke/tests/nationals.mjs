// The national teams (#169), which the Clubs tab lists behind its switch: every nation's men's and women's team, read
// from the two arrays of containers the build profile places, with the reputation of each senior team and the players
// the game lists for it, as the probe reads them; no tab of their own; the switch, the list, its search and its filter,
// a team's profile with its squad, its teams (the senior team and its youth teams, #210) and the squad of one of its
// youth teams as the probe reads them, a player opened from it, the senior team's Heal all, Inspire all and Refresh all
// (#217) and none for a youth team, Edit offering the reputations of the senior and the youth team and, where the build
// places them, the nation's youth rating and settings (nothing is applied: the edits and the actions themselves are in
// the `edit` test), and the switch back to the clubs. Writes nothing. On a build whose profile places no national teams,
// the note saying why, with the switch back.
import { SHOWN, VIS } from "../lib/app.mjs";

export const name = "nationals";
export const writes = false;

/** More than the game's 502 containers. */
const ALL = 1000;

export const ROWS = `[...document.querySelectorAll("table.national-grid tbody tr")].filter(${SHOWN})`;
export const PROFILE = `${VIS}(".profile:not(.popup)")`;
const POPUP = `document.querySelector(".modal-backdrop .profile.popup")`;
/** The button of the Clubs tab's switch for "clubs" or "nationals", in the list on show. */
const SWITCH = (teams) => `${VIS}('.teams-switch [data-teams="${teams}"]')`;
const TAB_NAMES = `[...document.querySelectorAll("nav.tabs button")].map((b) => b.firstChild?.textContent.trim())`;
/** The labels of the buttons that act on the senior team's players, in the profile on show (#217). */
const ACTIONS = `[...(${PROFILE}?.querySelectorAll(".squad-buttons button") ?? [])].map((b) => b.textContent)`;

/** Opens the Clubs tab on one of its two lists, by its switch. */
export async function showTeams(app, teams) {
  await app.openTab("Clubs");
  await app.waitFor(SWITCH(teams), "the Clubs tab's switch");
  await app.click(SWITCH(teams), teams === "clubs" ? "Clubs" : "National teams");
  await app.waitFor(`${SWITCH(teams)}?.getAttribute("aria-pressed") === "true"`, `the ${teams} on show`);
}

/**
 * What `fmlibre-probe national-teams UID --squad --kind KIND` reads of one team: its row, and the UIDs of the squad of
 * its team of that kind (0, the senior team, by default) in their order. A row ends with the reputation (5 wide, blank
 * for none) and the players (7 wide), two spaces apart.
 */
function probeTeam(probe, uid, kind = 0) {
  const lines = probe.run(["national-teams", uid, "--squad", "--kind", kind, "--limit", "1"]).split(/\r?\n/);
  const read = lines.find((line) => line.startsWith("Read "))?.match(/^Read (\d+) national teams/);
  const row = lines.find((line) => Number(line.trim().split(/\s+/)[0]) === uid && !line.startsWith("Read"));
  const start = lines.findIndex((line) => line.startsWith(`Team of kind ${kind} of `));
  const squad = start < 0 ? [] : lines.slice(start + 1).map((line) => line.match(/^\s+(\d+)\s{2}/)).filter(Boolean);
  const reputation = row?.slice(-14, -9).trim();
  return {
    teams: read ? Number(read[1]) : null,
    reputation: reputation ? Number(reputation) : null,
    players: row ? Number(row.slice(-7).trim()) : null,
    squad: squad.map((m) => Number(m[1])),
  };
}

/**
 * The teams `fmlibre-probe national-teams UID --teams` reads of one national team, in the container's order, as
 * "index:kind:age limit:reputation:players" keys, as `teamKey` makes them of the app's.
 */
function probeTeams(probe, uid) {
  const lines = probe.run(["national-teams", uid, "--teams", "--limit", "1"]).split(/\r?\n/);
  const at = lines.findIndex((line) => Number(line.trim().split(/\s+/)[0]) === uid && !line.startsWith("Read"));
  const teams = [];
  for (const line of at < 0 ? [] : lines.slice(at + 1)) {
    const m = line.match(/^\s+#(\d+)\s+kind\s+(\d+)\s+age limit\s+(\S+)\s+rep\s+(\d+)\s+players\s+(\d+)/);
    if (!m) break;
    teams.push(`${m[1]}:${m[2]}:${m[3] === "none" ? "none" : m[3]}:${m[4]}:${m[5]}`);
  }
  return teams;
}

const teamKey = (side) => `${side.index}:${side.kind}:${side.ageLimit ?? "none"}:${side.reputation}:${side.players}`;

export async function run({ app, report, probe }) {
  const tabs = await app.js(TAB_NAMES);
  report.check("the national teams have no tab of their own", tabs.includes("Clubs") && !tabs.includes("National teams"),
    tabs.join(", "));
  const status = await app.must("national_status");
  if (!status.available) {
    // The note says why, and the switch takes the tab back to the clubs.
    await showTeams(app, "nationals");
    const note = await app.waitFor(`${VIS}(".national-unavailable h2")?.textContent`, "the note");
    report.check("the Clubs tab says why it shows no national teams", /not available/.test(note), `${status.reason}: ${note}`);
    await showTeams(app, "clubs");
    report.check("the switch takes it back to the clubs", await app.js(`!!${VIS}("table.club-grid:not(.national-grid)")`));
    report.skip("the national teams", `this build has none to read (${status.reason})`);
    return;
  }

  // Every container, men's and women's, through the command the list asks.
  const all = await app.must("search_national_teams", { query: "", limit: ALL });
  const men = all.rows.filter((team) => !team.women);
  const women = all.rows.filter((team) => team.women);
  report.check("the list holds the men's and the women's teams of the nations", all.total === status.teams &&
    all.rows.length === all.total && men.length >= 200 && women.length >= 200,
    `${all.total} teams: ${men.length} men's, ${women.length} women's`);
  const withReputation = all.rows.filter((team) => team.reputation !== null).length;
  report.check("nearly every team has a senior team with a reputation", withReputation >= all.total * 0.95,
    `${withReputation} of ${all.total}`);
  const coded = men.filter((team) => /^[A-Z]{3}$/.test(team.code ?? "")).length;
  report.check("the nations have their three-letter codes", coded >= men.length * 0.95, `${coded} of ${men.length}`);
  const onlyWomen = await app.must("search_national_teams", { query: "", limit: ALL, women: true });
  const onlyMen = await app.must("search_national_teams", { query: "", limit: ALL, women: false });
  report.check("the filter keeps to the men's or the women's teams",
    onlyWomen.total === women.length && onlyWomen.rows.every((team) => team.women) &&
      onlyMen.total === men.length && onlyMen.rows.every((team) => !team.women),
    `${onlyMen.total} men's, ${onlyWomen.total} women's`);

  // The best known men's team that lists players, against the probe.
  const team = men.find((t) => t.players > 0 && t.code);
  if (!team) {
    report.skip("a national team's squad", "no men's team lists players");
    return;
  }
  report.note(`witness: ${team.name} (${team.code}, ${team.uid}), reputation ${team.reputation}, ${team.players} players`);
  const seen = probeTeam(probe, team.uid);
  report.check("the probe reads as many teams", seen.teams === all.total, `${seen.teams}`);
  report.check("the probe reads the same reputation and number of players",
    seen.reputation === team.reputation && seen.players === team.players, JSON.stringify(seen));
  const byCode = await app.must("search_national_teams", { query: team.code, limit: 10 });
  report.check(`${team.code} finds ${team.name}`, byCode.rows.some((t) => t.uid === team.uid),
    byCode.rows.map((t) => t.name).join(", "));
  const profile = await app.must("national_squad", { uid: team.uid });
  const squad = profile.squad.players.map((player) => player.uid);
  report.check("its squad is the players the probe reads, in the game's order",
    profile.squad.kind === 0 && squad.length === team.players && JSON.stringify(squad) === JSON.stringify(seen.squad),
    `${squad.length} players: ${profile.squad.players.slice(0, 4).map((p) => p.name).join(", ")}`);

  // Its teams: the senior team first, then its youth teams, as the probe reads them; one youth team's squad.
  const sides = profile.teams;
  const seenSides = probeTeams(probe, team.uid);
  report.check("its teams are the ones the probe reads, the senior team first",
    sides.length > 1 && sides[0].kind === 0 && sides[0].reputation === team.reputation &&
      JSON.stringify(sides.map(teamKey)) === JSON.stringify(seenSides),
    sides.map((s) => `kind ${s.kind}${s.ageLimit === null ? "" : ` U${s.ageLimit}`} (${s.players})`).join(", "));
  const youth = sides.find((s) => s.kind === 10 && s.players > 0) ?? sides.find((s) => s.kind !== 0 && s.players > 0);
  let youthSquad = null;
  if (youth) {
    youthSquad = (await app.must("national_squad", { uid: team.uid, kind: youth.kind })).squad;
    const uids = youthSquad.players.map((player) => player.uid);
    const seenYouth = probeTeam(probe, team.uid, youth.kind);
    report.check(`its team of kind ${youth.kind} lists the players the probe reads, in the game's order`,
      youthSquad.kind === youth.kind && uids.length === youth.players &&
        JSON.stringify(uids) === JSON.stringify(seenYouth.squad),
      `${uids.length} players: ${youthSquad.players.slice(0, 4).map((p) => p.name).join(", ")}`);
  } else {
    report.skip("a youth team's squad", `no youth team of ${team.name} lists players`);
  }
  // The youth rating and the settings follow the reputations, where the build's profile places them: a build that does
  // not place them has none of them.
  const settings = [
    "youth_rating",
    "game_importance",
    "fa_financial_power",
    "fa_patience",
    "attendance",
    "min_attendance",
    "max_attendance",
    "economic_factor",
    "state_of_development",
  ];
  const fields = (await app.must("edit_fields", { entity: "nationalTeam" })).map((field) => field.key);
  const settingsAt = fields.indexOf(settings[0]);
  const reputations = settingsAt < 0 ? fields : fields.slice(0, settingsAt);
  const extras = settingsAt < 0 ? [] : fields.slice(settingsAt);
  report.check("its reputations are the fields to edit, the senior team's first, then its youth rating and settings",
    reputations[0] === "reputation" && reputations.slice(1).every((key) => /^team\.\d+\.reputation$/.test(key)) &&
      sides.slice(1).every((side) => reputations.includes(`team.${side.kind}.reputation`)) &&
      (extras.length === 0 || JSON.stringify(extras) === JSON.stringify(settings)),
    fields.join(", "));

  // The same in the Clubs tab, by its switch: found by its code, its profile and its squad, a player opened over it.
  await showTeams(app, "nationals");
  report.check("the switch shows the national teams in place of the clubs",
    await app.js(`!!${VIS}("table.national-grid") && !${VIS}("table.club-grid:not(.national-grid)")`));
  await app.waitFor(`${ROWS}.length > 0`, "the national teams' rows");
  await app.shot("nationals-list");
  await app.waitFor(`${VIS}(".search input")`, "the search");
  await app.setInput(`${VIS}(".search input")`, team.code);
  const row = `${ROWS}.find((tr) => tr.querySelector(".col-uid")?.textContent.trim() === ${JSON.stringify(String(team.uid))})`;
  await app.waitFor(row, `the row of ${team.name}`);
  await app.click(row, `the row of ${team.name}`);
  await app.waitFor(`${PROFILE} && ${PROFILE}.getAttribute("aria-busy") === "false"`, "the team's profile", 30000);
  const names = `[...${PROFILE}.querySelectorAll("table.squad-grid tbody button.name-link")]`;
  await app.waitFor(`${names}.length === ${squad.length}`, `the ${squad.length} names of the squad`);
  const shownNames = await app.js(`${names}.map((b) => b.textContent)`);
  report.check("the profile lists the squad in the game's order",
    JSON.stringify(shownNames) === JSON.stringify(profile.squad.players.map((p) => p.name)), shownNames.slice(0, 4).join(", "));
  const heading = await app.js(`${PROFILE}.querySelector(".squad-count")?.textContent`);
  report.check("the heading counts them", heading?.includes(String(squad.length)), heading);
  const buttons = `[...${PROFILE}.querySelectorAll(".squad-teams button")]`;
  const labels = await app.js(`${buttons}.map((b) => b.textContent)`);
  report.check("the switch has a button for each of its teams, the senior team's pressed",
    labels.length === sides.length && (await app.js(`${buttons}[0]?.getAttribute("aria-pressed") === "true"`)),
    labels.join(", "));
  // Heal all, Inspire all and Refresh all act on the senior team's players (#217): the `edit` test presses them.
  const actions = await app.js(ACTIONS);
  report.check("the senior team has Heal all, Inspire all and Refresh all",
    actions.length === 3 && actions[0].startsWith("Heal all") && actions[1] === "Inspire all" && actions[2] === "Refresh all",
    actions.join(", "));
  await app.shot("nationals-profile");

  await app.click(`${names}[0]`, `${shownNames[0]}'s name`);
  await app.waitFor(`${POPUP}?.getAttribute("aria-busy") === "false"`, "his profile over the squad", 30000);
  const popupName = await app.js(`${POPUP}.querySelector("h2")?.textContent`);
  report.check("a name opens the player's profile", popupName?.includes(shownNames[0]), popupName);
  await app.press("Escape");
  await app.waitFor(`!${POPUP}`, "his profile closed");

  // The youth team picked on the switch: its squad, and its reputation beside the switch.
  if (youth && youthSquad) {
    const at = sides.indexOf(youth);
    await app.click(`${buttons}[${at}]`, labels[at]);
    await app.waitFor(`${buttons}[${at}]?.getAttribute("aria-pressed") === "true" && ` +
      `${PROFILE}.getAttribute("aria-busy") === "false" && ${names}.length === ${youthSquad.players.length}`,
      `the ${youthSquad.players.length} names of the ${labels[at]} squad`, 30000);
    const youthNames = await app.js(`${names}.map((b) => b.textContent)`);
    const youthHeading = await app.js(`${PROFILE}.querySelector(".squad-count")?.textContent`);
    report.check(`${labels[at]} on the switch shows its squad, its heading naming it`,
      JSON.stringify(youthNames) === JSON.stringify(youthSquad.players.map((p) => p.name)) &&
        youthHeading?.includes(labels[at]) && youthHeading?.includes(String(youthNames.length)),
      `${youthHeading}: ${youthNames.slice(0, 3).join(", ")}`);
    const shownReputation = await app.js(`${PROFILE}.querySelector(".national-team-reputation .rep")?.textContent`);
    report.check("its reputation is shown beside the switch",
      shownReputation?.replace(/\D/g, "") === String(youth.reputation), `${shownReputation} (${youth.reputation})`);
    const youthActions = await app.js(ACTIONS);
    report.check("a youth team has none of the senior team's actions", youthActions.length === 0, youthActions.join(", "));
    await app.shot("nationals-youth-team");
  }

  // Edit offers the reputation of the senior team and, picked on the switch, the youth team's; Cancel leaves both.
  const edit = `${PROFILE}.querySelector("button.edit-toggle")`;
  if (await app.js(`!!${edit}`)) {
    await app.click(edit, "Edit");
    const input = `${PROFILE}.querySelector('.edit-input[data-field="reputation"]')`;
    await app.waitFor(input, "the reputation input");
    report.check("Edit offers the reputation as it is", Number(await app.js(`${input}.value`)) === team.reputation,
      await app.js(`${input}.value`));
    if (youth) {
      const field = `team.${youth.kind}.reputation`;
      const youthInput = `${PROFILE}.querySelector('.edit-input[data-field="${field}"]')`;
      await app.waitFor(youthInput, `the ${field} input`);
      report.check("and the youth team's beside the switch", Number(await app.js(`${youthInput}.value`)) === youth.reputation,
        `${field} ${await app.js(`${youthInput}.value`)}`);
    }
    await app.click(edit, "Cancel");
    await app.waitFor(`!${PROFILE}.classList.contains("editing")`, "the profile out of Edit");
  } else {
    report.skip("Edit", "the profile has no Edit button: the game cannot be written to");
  }
  await app.setInput(`${VIS}(".search input")`, "");
  await app.press("Escape");

  // Back to the clubs, as the tests after this one expect the Clubs tab.
  await showTeams(app, "clubs");
  report.check("the switch takes the tab back to the clubs",
    await app.js(`!!${VIS}("table.club-grid:not(.national-grid)") && !${VIS}("table.national-grid")`));
  await app.shot("nationals-back-to-clubs");
}
