// The command-line probe, as a second pair of eyes: it reads the game on its own, so what the app wrote and undid can
// be checked apart from the app. Writes only stand in for the game changing a value (see freeze.mjs).
import { execFileSync } from "node:child_process";

export class Probe {
  constructor(path) {
    this.path = path;
  }

  /** Runs the probe with `args`, and the environment variables `env` besides the runner's, and returns what it printed. */
  run(args, env = {}) {
    return execFileSync(this.path, args.map(String), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
  }

  /**
   * The values `fmlibre-probe get` reads for fields of a player, member of staff or club, as stored; a date, which it
   * prints as 2027-06-30, as the editor writes it: 20270630.
   */
  get(entity, uid, fields) {
    const values = {};
    for (const line of this.run(["get", entity, uid, ...fields]).split(/\r?\n/)) {
      const match = line.match(/^\s+(\S+)\s+(-?\d+)(?:-(\d{2})-(\d{2}))?(?:\s|$)/);
      if (match) {
        const [, field, number, month, day] = match;
        values[field] = month ? Number(number) * 10000 + Number(month) * 100 + Number(day) : Number(number);
      }
    }
    return values;
  }

  /** Writes a value as the game would, behind the app's back. */
  set(entity, uid, field, value) {
    this.run(["set", entity, uid, field, value]);
  }

  /**
   * The teams of clubs that play a match on the game's day, as `fmlibre-probe matches` reads the game's matches: each
   * by its club's UID and its place in the club's list of teams. A national team's is left out.
   */
  matchesToday() {
    const teams = [];
    for (const line of this.run(["matches"]).split(/\r?\n/)) {
      for (const [, club, team] of line.matchAll(/\((\d+)\) team (\d+)/g)) teams.push({ club: Number(club), team: Number(team) });
    }
    return teams;
  }

  /** The build line, profile, date and arrays, as `calibrate` prints them. */
  calibrate() {
    return this.run(["calibrate"]).trim();
  }
}
