// The Squad tab of a club's profile: the players of each of its teams with the values a squad screen shows, the actions
// on a whole team (Team at its best, Destroy after a question, and the single actions in a menu: heal everyone, lift
// every ban, give everyone the best morale, rest everyone and more), the boxes that freeze the whole team, and the
// captains. What it writes is logged like any change, and undone from the Changes view, or at once from the line under
// the buttons. A player's name opens his profile over the squad, which stays as it was behind it.

import { useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { Ability } from "./Ability";
import { BatchTraitsDialog } from "./BatchTraitsDialog";
import { CaptainMenu } from "./CaptainMenu";
import { DestroyDialog } from "./DestroyDialog";
import {
  batchTraitsTeam,
  boostTeam,
  changeLog,
  clubSquads,
  freezeTeam,
  setCaptain,
  teamAction,
  undoBatch,
  undoChange,
} from "./editing";
import { describeError, formatNumber } from "./format";
import { intlLocale } from "./i18n";
import { InfoTip } from "./InfoTip";
import {
  appText,
  fieldLabel,
  massEditText,
  positionLabel,
  profileText,
  squadText as text,
  swapNote,
  teamLabel,
} from "./labels";
import { undoFailureLines } from "./massDraft";
import { percentText } from "./MedicalGroup";
import { PlayerDialog } from "./PlayerProfile";
import { AbilityChange, useEarlierAbilities } from "./PlayerProgress";
import type { Loaded, PanelIds } from "./ProfileParts";
import { SortHeader } from "./SortHeader";
import { TeamActionMenu, type MenuAction, type MenuItemAction } from "./TeamActionMenu";
import type {
  BatchUndo,
  CaptainRole,
  ClubTeam,
  EarlierAbility,
  FreezeKind,
  LoggedChange,
  MassReport,
  SquadPlayer,
  SquadSort,
  TeamAction,
} from "./types";
import { EditorContext } from "./useProfileEditing";

/**
 * The club's teams with their players, read again whenever `version` changes: the game data was read or written. Like
 * `useProfileDetails`, but through the squad command, with a failure worded in the language of the window.
 */
function useSquads(club: number, version: number): Loaded<ClubTeam[]> | null {
  const [loaded, setLoaded] = useState<Loaded<ClubTeam[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    clubSquads(club).then(
      (details) => {
        if (!cancelled) {
          setLoaded({ details });
        }
      },
      (e) => {
        if (!cancelled) {
          setLoaded({ error: describeError(e) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [club, version]);

  return loaded;
}

/** How the table is sorted. */
interface SquadOrder {
  by: SquadSort;
  ascending: boolean;
}

/** What the table is in until a column header is clicked: the best players first. */
const DEFAULT_ORDER: SquadOrder = { by: "currentAbility", ascending: false };

/** The columns whose first click sorts from A to Z or from the goalkeepers; the numbers start with the highest. */
const FIRST_ASCENDING: ReadonlySet<SquadSort> = new Set<SquadSort>(["name", "position"]);

/** Goalkeepers first, then the defence, the midfield and the attack: the order a squad list reads in. */
const POSITION_ORDER: readonly string[] = [
  "gk", "sw", "dl", "dc", "dr", "wbl", "wbr", "dm", "ml", "mc", "mr", "aml", "amc", "amr", "st",
];

const collator = new Intl.Collator(intlLocale);

/** What the player is sorted by in the column `by`; null for what the game does not give: no age, no position. */
function sortValue(player: SquadPlayer, by: SquadSort): string | number | null {
  switch (by) {
    case "name":
      return player.name;
    case "position": {
      const at = POSITION_ORDER.indexOf(player.positions[0]);
      return at < 0 ? null : at;
    }
    case "age":
      return player.age;
    case "currentAbility":
      return player.currentAbility;
    case "potentialAbility":
      return player.potentialAbility;
    case "condition":
      return player.condition;
    case "matchSharpness":
      return player.matchSharpness;
    case "jadedness":
      return player.jadedness;
    case "morale":
      return player.morale;
    case "cohesion":
      return player.cohesion;
    case "tactics":
      return player.tactics;
  }
}

/** The players in the order `order` asks for; equals keep the best players first, then the names in order. */
function sorted(players: readonly SquadPlayer[], { by, ascending }: SquadOrder): SquadPlayer[] {
  return [...players].sort((a, b) => {
    const x = sortValue(a, by);
    const y = sortValue(b, by);
    if (x === null || y === null) {
      // What is not known goes last, whichever way the table is sorted.
      if (x !== y) {
        return x === null ? 1 : -1;
      }
    } else if (x !== y) {
      const order = typeof x === "string" ? collator.compare(x, String(y)) : x - Number(y);
      return ascending ? order : -order;
    }
    return b.currentAbility - a.currentAbility || collator.compare(a.name, b.name);
  });
}

/** What Team at its best and Destroy do, in order, as the app's `AT_ITS_BEST` and `DESTROY`. */
const STEPS: Partial<Record<TeamAction, readonly TeamAction[]>> = {
  atItsBest: ["heal", "inspire", "refresh", "maxCohesion", "maxTactics"],
  destroy: ["demoralize", "exhaust", "minCohesion", "minTactics"],
};

/** Whether the two are the same team: `index` alone is its place among its own club's teams (see `ClubTeam`). */
const sameTeam = (a: ClubTeam, b: ClubTeam) => a.clubUid === b.clubUid && a.index === b.index;

/** The role the player holds in the team, if any. */
function roleOf(team: ClubTeam, uid: number): CaptainRole | null {
  return team.captain === uid ? "captain" : team.viceCaptain === uid ? "viceCaptain" : null;
}

/** The field of the club that names each role (see `fieldLabel`). */
const ROLE_FIELD: Record<CaptainRole, string> = { captain: "captain", viceCaptain: "vice_captain" };

/** Takes back what a result says was written. */
export type Undo = () => Promise<BatchUndo>;

/**
 * What an action, a captaincy or an undo came to, for the line under the buttons. It is shown under the team it was
 * made to only.
 */
export interface Result {
  /** The team's place among the teams the squad shows. */
  team: number;
  message: string;
  /** Whether the message is why it did not happen. */
  failed: boolean;
  /** Under the message: what the game refused, as lines of text. */
  problems: string[];
  /** Null for what there is nothing to take back, or what was taken back already. */
  undo: Undo | null;
  /** Whether it says that the team is boosted: it goes once nobody in the team is, as the game's day is over. */
  boost?: boolean;
}

/** Most refusals the line under the buttons lists. */
const PROBLEMS_SHOWN = 5;

/** The changes of a team action the game refused: whose and why; the first few, then how many more. */
export function refusalLines(failed: MassReport["failed"]): string[] {
  const lines = failed.slice(0, PROBLEMS_SHOWN).map(({ name, error }) => text.refused(name, describeError(error)));
  return failed.length > PROBLEMS_SHOWN ? [...lines, massEditText.more(failed.length - PROBLEMS_SHOWN)] : lines;
}

/** What a captaincy came to: who took the role and, when the two captains swapped, what became of the other. */
function captainMessage(role: CaptainRole, player: string, captaincy: LoggedChange["captaincy"]): string {
  const taken = (role === "captain" ? text.nowCaptain : text.nowViceCaptain)(captaincy?.to ?? player);
  return captaincy?.swapped ? `${taken} · ${swapNote(role, captaincy.from)}` : taken;
}

interface SquadTabProps {
  clubUid: number;
  /** The club's name, which Destroy's question names. */
  clubName: string;
  /** Changes when the game data is read again, so the squad is too. */
  version: number;
  /** The tab it is the panel of, in a club's profile. Without one it is a part of a page, named by `label`. */
  panel?: PanelIds;
  label?: string;
  /**
   * Shown between the team's summary and its actions: what stands out in the shown team (see `MyClub`). `open` opens a
   * player's profile over the squad, as his name in the table does; `from` takes focus back once it is closed.
   */
  overview?: (team: ClubTeam, open: (player: SquadPlayer, from: HTMLElement) => void) => ReactNode;
}

/** The squad of the club `clubUid`: a switch between its teams, the team's summary and actions, and its table. */
export function SquadTab({ clubUid, clubName, version, panel, label, overview }: SquadTabProps) {
  const { editable, onEdited } = useContext(EditorContext);
  const loaded = useSquads(clubUid, version);
  // The team Destroy's question is up for, and the button that asked it, which takes focus back.
  const [destroying, setDestroying] = useState<ClubTeam | null>(null);
  const destroyButton = useRef<HTMLButtonElement>(null);
  const wasDestroying = useRef(false);
  // Whether the Batch traits dialog is up, and the More actions button whose menu opens it, which takes focus back.
  const [batchTraitsOpen, setBatchTraitsOpen] = useState(false);
  const batchTraitsButton = useRef<HTMLButtonElement>(null);
  const wasBatchTraitsOpen = useRef(false);
  // The team that is shown, by its place among those the squad shows: the club's own, then its linked teams.
  const [teamSlot, setTeamSlot] = useState(0);
  const [order, setOrder] = useState(DEFAULT_ORDER);
  // Whether a write is under way, or done and waiting for the squad to be read again.
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const alive = useRef(true);
  const resultBox = useRef<HTMLDivElement>(null);
  // Set while a write may take the button that has focus out of play.
  const refocus = useRef(false);
  // The player whose profile is up over the squad, and the name that opened it.
  const [shown, setShown] = useState<SquadPlayer | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasShown = useRef(false);

  const teams = loaded?.details;
  // A team that is no longer there (the game changed) gives way to the first one.
  const team = teams?.[teamSlot] ?? teams?.[0];
  const slot = teams && team ? teams.indexOf(team) : 0;
  const players = useMemo(() => (team ? sorted(team.players, order) : []), [team, order]);
  // What each of them was at the record the app compares with, where it keeps records of the career.
  const earlier = useEarlierAbilities(team?.players.map((player) => player.uid) ?? [], version);
  const shownResult =
    result !== null && team && result.team === slot && !(result.boost && !team.players.some((p) => p.boosted))
      ? result
      : null;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // A write stays busy until the squad has been read again, which gives new rows: pressed in between, the buttons would
  // work from numbers that are out of date.
  useEffect(() => {
    setBusy(false);
  }, [loaded]);

  // Once his profile is closed, focus goes back to the name that opened it, if the squad still has him. Doing it
  // earlier, with the dialog still up, would only make the dialog take focus back.
  useEffect(() => {
    if (wasShown.current && shown === null && opener.current?.isConnected) {
      opener.current.focus();
    }
    wasShown.current = shown !== null;
  }, [shown]);

  // So does Destroy's question, to its button, whichever the answer.
  useEffect(() => {
    if (wasDestroying.current && destroying === null) {
      destroyButton.current?.focus();
    }
    wasDestroying.current = destroying !== null;
  }, [destroying]);

  // And so does the Batch traits dialog, to More actions, whether it applied or was closed.
  useEffect(() => {
    if (wasBatchTraitsOpen.current && !batchTraitsOpen) {
      batchTraitsButton.current?.focus();
    }
    wasBatchTraitsOpen.current = batchTraitsOpen;
  }, [batchTraitsOpen]);

  // A write can take the button that had focus out of play: Heal all once nobody is injured, Undo once it is done.
  // Focus then goes to the line under the buttons, so that someone using the keyboard stays in the tab.
  useEffect(() => {
    if (busy || !refocus.current) {
      return;
    }
    refocus.current = false;
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || focused === document.body || focused.matches(":disabled")) {
      resultBox.current?.focus();
    }
  });

  /** Writes for the team `forTeam`: busy until the squad is read again, with the result shown under its buttons. */
  const write = async (forTeam: number, task: () => Promise<Result>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    refocus.current = true;
    try {
      const done = await task();
      if (alive.current) {
        setResult(done);
      }
      // The game has changed: the lists, the profile and the change log read it again, and so does the squad.
      onEdited();
    } catch (e) {
      if (alive.current) {
        setResult({ team: forTeam, message: describeError(e), failed: true, problems: [], undo: null });
        setBusy(false);
      }
    }
  };

  // Each writes to the shown team, as a team of the club it belongs to: a linked team's is not the club of the squad.
  const act = (target: ClubTeam, action: TeamAction) =>
    write(slot, async () => {
      const report = await teamAction(target.clubUid, target.index, action);
      // Whether the step `step` ran: the action itself, or a step of Team at its best or Destroy that was not skipped.
      const ran = (step: TeamAction) =>
        action === step ||
        (STEPS[action]?.includes(step) === true && !report.skipped.some((skipped) => skipped.action === step));
      // Cohesion leaves out the players who have no entry for the club yet, and tactics the history of those who do
      // not train; each says how many.
      const without =
        ran("maxCohesion") || ran("minCohesion")
          ? target.players.filter((player) => player.cohesion === null).length
          : 0;
      const untrained =
        ran("maxTactics") || ran("minTactics")
          ? target.players.filter((player) => player.tactics !== null && !player.trains).length
          : 0;
      const skipped = report.skipped.map((step) => text.atItsBestSkipped(stepName(step.action), describeError(step.reason)));
      const notes = [
        text.written(report.applied),
        without > 0 ? text.cohesionWithout(without) : null,
        untrained > 0 ? text.tacticsUntrained(untrained) : null,
      ];
      return {
        team: slot,
        message: notes.filter((note) => note !== null).join(" · "),
        failed: false,
        problems: [...skipped, ...refusalLines(report.failed)],
        // An action that wrote nothing has nothing to take back.
        undo: report.applied > 0 ? () => undoBatch(report.batch) : null,
      };
    });

  const batchTraits = (target: ClubTeam, addTraits: number[], removeTraits: number[]) =>
    write(slot, async () => {
      const report = await batchTraitsTeam(target.clubUid, target.index, addTraits, removeTraits);
      return {
        team: slot,
        message: text.written(report.applied),
        failed: false,
        problems: refusalLines(report.failed),
        undo: report.applied > 0 ? () => undoBatch(report.batch) : null,
      };
    });

  // Freezing writes nothing to the game itself, but the squad is read again all the same, for its rows to say so.
  const freeze = (target: ClubTeam, kind: FreezeKind, on: boolean) =>
    write(slot, async () => {
      const done = await freezeTeam(target.clubUid, target.index, kind, on);
      const said =
        kind === "attributes"
          ? on
            ? text.frozeAttributes
            : text.unfrozeAttributes
          : kind === "fitness"
            ? on
              ? text.frozeFitness
              : text.unfrozeFitness
            : on
              ? text.frozePositions
              : text.unfrozePositions;
      return {
        team: slot,
        message: said(done.changed),
        failed: false,
        problems: refusalLines(done.failed),
        undo: null,
      };
    });

  // A boost writes the best values at once; the app puts back what was there once the game's day is over, or now.
  const boost = (target: ClubTeam, on: boolean) =>
    write(slot, async () => {
      const done = await boostTeam(target.clubUid, target.index, on);
      return {
        team: slot,
        message: (on ? text.boostDone : text.boostPutBack)(done.changed),
        failed: false,
        problems: refusalLines(done.failed),
        undo: null,
        boost: on,
      };
    });

  const undo = (forTeam: number, take: Undo) =>
    write(forTeam, async () => {
      const done = await take();
      // The log names the players behind the changes that could not be taken back.
      const log = done.failed.length > 0 ? await changeLog().catch(() => []) : [];
      return {
        team: forTeam,
        message: massEditText.undone(done.undone),
        failed: false,
        problems: undoFailureLines(done.failed, log),
        undo: null,
      };
    });

  const makeCaptain = (target: ClubTeam, role: CaptainRole, player: SquadPlayer) =>
    write(slot, async () => {
      const change = await setCaptain(target.clubUid, target.index, role, player.uid);
      return {
        team: slot,
        message: captainMessage(role, player.name, change.captaincy),
        failed: false,
        problems: [],
        undo: async () => {
          await undoChange(change.id);
          return { undone: 1, failed: [] };
        },
      };
    });

  const sortBy = (by: SquadSort) =>
    setOrder({ by, ascending: order.by === by ? !order.ascending : FIRST_ASCENDING.has(by) });
  const sortHeader = (by: SquadSort, className?: string) => (
    <SortHeader
      by={by}
      order={order}
      onSort={sortBy}
      label={text.columns[by]}
      title={text.sortBy(text.sortNames[by])}
      className={className}
    />
  );

  return (
    <div
      className="squad-tab"
      role={panel ? "tabpanel" : "region"}
      id={panel?.id}
      aria-labelledby={panel?.labelledBy}
      aria-label={panel ? undefined : label}
      aria-busy={loaded === null || undefined}
    >
      {loaded === null && (
        <p className="profile-status" role="status">
          {text.loading}
        </p>
      )}
      {loaded?.error !== undefined && (
        <div className="banner" role="alert">
          {loaded.error}
        </div>
      )}
      {teams?.length === 0 && <p className="empty">{text.noTeams}</p>}

      {teams && team && (
        <>
          <TeamSummary teams={teams} team={team} onTeam={setTeamSlot} />

          {overview?.(team, (player, from) => {
            opener.current = from;
            setShown(player);
          })}

          <div className="squad-actions">
            <TeamActions
              team={team}
              editable={editable}
              busy={busy}
              onAction={(action) => void act(team, action)}
              onDestroy={() => setDestroying(team)}
              destroyRef={destroyButton}
              onBatchTraits={() => setBatchTraitsOpen(true)}
              batchTraitsRef={batchTraitsButton}
            />
            <p className="note squad-hint">{text.hint}</p>
          </div>

          <div className="squad-actions">
            <TeamFreezes
              team={team}
              editable={editable}
              busy={busy}
              onFreeze={(kind, on) => void freeze(team, kind, on)}
              onBoost={(on) => void boost(team, on)}
            />
            <p className="note squad-hint">{text.freezeHint}</p>
          </div>

          <ResultLine
            ref={resultBox}
            result={shownResult}
            busy={busy}
            onUndo={(take) => void undo(slot, take)}
          />

          <div className="squad-table-wrap">
            <table className="grid squad-grid" aria-label={text.tableLabel(teamLabel(team))}>
              <thead>
                <tr>
                  {sortHeader("name", "col-name")}
                  {sortHeader("position")}
                  {sortHeader("age", "num")}
                  {sortHeader("currentAbility", "num")}
                  {sortHeader("potentialAbility", "num")}
                  {sortHeader("condition", "num")}
                  {sortHeader("matchSharpness", "num")}
                  {sortHeader("jadedness", "num")}
                  {sortHeader("morale", "num")}
                  {sortHeader("cohesion", "num")}
                  {sortHeader("tactics", "num")}
                  <th className="col-actions">
                    <span className="sr-only">{text.columns.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <SquadRow
                    key={player.uid}
                    player={player}
                    role={roleOf(team, player.uid)}
                    editable={editable}
                    busy={busy}
                    onCaptain={(role) => void makeCaptain(team, role, player)}
                    onOpen={(from) => {
                      opener.current = from;
                      setShown(player);
                    }}
                    earlier={earlier.get(player.uid)}
                  />
                ))}
              </tbody>
            </table>
            {players.length === 0 && <p className="empty">{text.empty}</p>}
          </div>
        </>
      )}

      {shown && <PlayerDialog player={shown} version={version} onClose={() => setShown(null)} />}
      {destroying && (
        <DestroyDialog
          club={clubName}
          team={destroying}
          onConfirm={() => {
            setDestroying(null);
            void act(destroying, "destroy");
          }}
          onClose={() => setDestroying(null)}
        />
      )}

      {batchTraitsOpen && team && (
        <BatchTraitsDialog
          team={team}
          busy={busy}
          onApply={async (addTraits, removeTraits) => {
            await batchTraits(team, addTraits, removeTraits);
            setBatchTraitsOpen(false);
          }}
          onClose={() => setBatchTraitsOpen(false)}
        />
      )}
    </div>
  );
}

interface TeamSummaryProps {
  teams: readonly ClubTeam[];
  team: ClubTeam;
  /** Shows another team, by its place in `teams`. */
  onTeam: (slot: number) => void;
}

/** The switch between the teams, and under it how many players the shown team lists and who its captains are. */
function TeamSummary({ teams, team, onTeam }: TeamSummaryProps) {
  const ages = team.players.flatMap((player) => (player.age === null ? [] : [player.age]));
  const average = ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null;
  const summary = [
    text.players(team.players.length),
    average !== null && text.averageAge(formatNumber(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
  ]
    .filter(Boolean)
    .join(" · ");
  // A captain the team's list does not have (the game may name one who has left) is told by his UID.
  const nameOf = (uid: number | null) =>
    uid === null
      ? profileText.none
      : (team.players.find((player) => player.uid === uid)?.name ?? `${profileText.uid} ${uid}`);

  return (
    <div className="squad-summary">
      <div className="squad-teams" role="group" aria-label={text.teamsLabel}>
        {teams.map((candidate, slot) => (
          <button
            key={`${candidate.clubUid}:${candidate.index}`}
            type="button"
            aria-pressed={sameTeam(candidate, team)}
            onClick={() => onTeam(slot)}
          >
            {teamLabel(candidate)}
          </button>
        ))}
      </div>
      <p className="squad-count">{summary}</p>
      <p className="squad-captains">{text.captains(nameOf(team.captain), nameOf(team.viceCaptain))}</p>
    </div>
  );
}

/** The name of a step of Team at its best or Destroy, for one it left out: its button's, or Destroy's for it. */
function stepName(action: TeamAction): string {
  switch (action) {
    case "heal":
      return text.healAll(0);
    case "inspire":
      return text.inspireAll;
    case "refresh":
      return text.refreshAll;
    case "maxCohesion":
      return text.maxCohesion;
    case "maxTactics":
      return text.maxTactics;
    case "demoralize":
    case "exhaust":
    case "minCohesion":
    case "minTactics":
      return text.destroySteps[action];
    default:
      return action;
  }
}

interface TeamActionsProps {
  team: ClubTeam;
  /** Whether the game can be written to. */
  editable: boolean;
  /** Whether a write is under way. */
  busy: boolean;
  onAction: (action: TeamAction) => void;
  /** Destroy asks first: this opens its question. */
  onDestroy: () => void;
  /** The Destroy button, which takes focus back once the question is answered. */
  destroyRef: Ref<HTMLButtonElement>;
  /** Opens the batch traits dialog for the shown team. */
  onBatchTraits: () => void;
  /** The More actions button, whose menu opens Batch traits, which takes focus back once its dialog is closed. */
  batchTraitsRef: Ref<HTMLButtonElement>;
}

/**
 * Team at its best (Heal all, Inspire all, Refresh all, Max cohesion and Max tactics in one go), the More actions menu
 * with each action on its own (those five, Lift bans and Max attributes) and Batch traits, which opens its dialog, and
 * Destroy in red, for the shown team: three buttons, which fit one line in every language. Heal all and Lift bans say
 * how many players are injured or banned and wait until somebody is, Max cohesion until somebody's cohesion can be read
 * and Max tactics until somebody's familiarity with the tactic can; every one waits while the game cannot be written
 * to, and says why.
 */
function TeamActions({
  team,
  editable,
  busy,
  onAction,
  onDestroy,
  destroyRef,
  onBatchTraits,
  batchTraitsRef,
}: TeamActionsProps) {
  const { readOnlyNote } = useContext(EditorContext);
  const injured = team.players.filter((player) => player.injuries > 0).length;
  const banned = team.players.filter((player) => player.bans > 0).length;
  // Those whose cohesion with the club the editor can read, and so set.
  const cohesive = team.players.filter((player) => player.cohesion !== null).length;
  // Those whose familiarity with the team's tactic the editor can read, and so set.
  const tactical = team.players.filter((player) => player.tactics !== null).length;
  const empty = team.players.length === 0;
  // What a button's hover text says: why it waits, or else what it does.
  const hover = (does: string, waiting: string | null) => (!editable ? readOnlyNote : (waiting ?? does));
  const single = (action: MenuItemAction, label: string, does: string, waiting: string | null): MenuAction => ({
    action,
    label,
    title: hover(does, waiting),
    waiting: !editable || waiting !== null,
  });
  const singles = [
    single("heal", text.healAll(injured), text.healAllTitle, injured === 0 ? text.healNone : null),
    single("liftBans", text.liftAll(banned), text.liftAllTitle, banned === 0 ? text.liftNone : null),
    single("inspire", text.inspireAll, text.inspireAllTitle, empty ? text.empty : null),
    single("refresh", text.refreshAll, text.refreshAllTitle, empty ? text.empty : null),
    single("maxAttributes", text.maxAll, text.maxAllTitle, empty ? text.empty : null),
    single("maxCohesion", text.maxCohesion, text.maxCohesionTitle, cohesive === 0 ? text.cohesionNone : null),
    single("maxTactics", text.maxTactics, text.maxTacticsTitle, tactical === 0 ? text.tacticsNone : null),
    { ...single("batchTraits", text.batchTraits, text.batchTraitsTitle, empty ? text.empty : null), dialog: true },
  ];

  return (
    <div className="squad-buttons" role="group" aria-label={text.actionsLabel}>
      <ActionButton
        label={text.atItsBest}
        title={hover(text.atItsBestTitle, empty ? text.empty : null)}
        waiting={!editable || empty}
        busy={busy}
        onPress={() => onAction("atItsBest")}
      />
      <TeamActionMenu
        actions={singles}
        editable={editable}
        busy={busy}
        onPick={(action) => (action === "batchTraits" ? onBatchTraits() : onAction(action))}
        buttonRef={batchTraitsRef}
      />
      <ActionButton
        ref={destroyRef}
        className="destroy"
        dialog
        label={text.destroy}
        title={hover(text.destroyTitle, empty ? text.empty : null)}
        waiting={!editable || empty}
        busy={busy}
        onPress={onDestroy}
      />
    </div>
  );
}

interface TeamFreezesProps {
  team: ClubTeam;
  /** Whether the game can be written to. */
  editable: boolean;
  /** Whether a write is under way. */
  busy: boolean;
  onFreeze: (kind: FreezeKind, on: boolean) => void;
  /** Boosts the team for the match of the day, or puts its boosted players back now. */
  onBoost: (on: boolean) => void;
}

/**
 * The boxes that freeze the attributes, the energy and match sharpness, and the positions of every player in the shown
 * team, and after them the one that boosts it for the match of the day. A box is ticked when all of them are frozen,
 * or boosted, and half ticked, with how many are, when some are; ticking it then covers the others too. They wait while
 * the game cannot be written to, and say why.
 */
function TeamFreezes({ team, editable, busy, onFreeze, onBoost }: TeamFreezesProps) {
  const { readOnlyNote } = useContext(EditorContext);
  const total = team.players.length;
  const boxes: { kind: FreezeKind; label: string; title: string; frozen: number }[] = [
    {
      kind: "attributes",
      label: text.freezeAttributes,
      title: text.freezeAttributesTitle,
      frozen: team.players.filter((player) => player.attributesFrozen).length,
    },
    {
      kind: "fitness",
      label: text.freezeFitness,
      title: text.freezeFitnessTitle,
      frozen: team.players.filter((player) => player.fitnessFrozen).length,
    },
    {
      kind: "positions",
      label: text.freezePositions,
      title: text.freezePositionsTitle,
      frozen: team.players.filter((player) => player.positionsFrozen).length,
    },
  ];

  return (
    <div className="squad-freezes" role="group" aria-label={text.freezeLabel}>
      {boxes.map(({ kind, label, title, frozen }) => (
        <FreezeBox
          key={kind}
          label={label}
          title={!editable ? readOnlyNote : total === 0 ? text.empty : title}
          frozen={frozen}
          total={total}
          waiting={!editable || total === 0}
          busy={busy}
          onChange={(on) => onFreeze(kind, on)}
        />
      ))}
      <InfoTip label={appText.freezeInfo.label} note={appText.freezeInfo.note} />
      <FreezeBox
        label={text.boost}
        title={!editable ? readOnlyNote : total === 0 ? text.empty : text.boostTitle}
        frozen={team.players.filter((player) => player.boosted).length}
        total={total}
        waiting={!editable || total === 0}
        busy={busy}
        onChange={onBoost}
      />
    </div>
  );
}

interface FreezeBoxProps {
  label: string;
  /** Hover text. */
  title: string;
  /** How many of the team's `total` players are frozen this way. */
  frozen: number;
  total: number;
  /** Whether it can do nothing now: the box is disabled. */
  waiting: boolean;
  /** Whether a write is under way: the box is only dimmed (aria-disabled), so that it keeps focus. */
  busy: boolean;
  onChange: (on: boolean) => void;
}

/** One of the boxes that freeze the whole team: ticked, half ticked with a count, or empty. */
function FreezeBox({ label, title, frozen, total, waiting, busy, onChange }: FreezeBoxProps) {
  const box = useRef<HTMLInputElement>(null);
  const some = frozen > 0 && frozen < total;

  // A box is half ticked only through the DOM.
  useEffect(() => {
    if (box.current) {
      box.current.indeterminate = some;
    }
  }, [some]);

  return (
    <label className="freeze-toggle" data-tip={title}>
      <input
        ref={box}
        type="checkbox"
        checked={total > 0 && frozen === total}
        disabled={waiting}
        aria-disabled={busy || undefined}
        onChange={(e) => !busy && onChange(e.currentTarget.checked)}
      />
      <span>{label}</span>
      {some && <span className="freeze-count">{text.frozenCount(frozen, total)}</span>}
    </label>
  );
}

interface ActionButtonProps {
  label: string;
  /** Hover text. */
  title: string;
  /** Whether there is nothing it can do now: the button is disabled. */
  waiting: boolean;
  /** Whether a write is under way. */
  busy: boolean;
  onPress: () => void;
  /** Another class for the button besides `squad-action`, such as Destroy's `destroy`. */
  className?: string;
  /** Whether it opens a dialog that asks first. */
  dialog?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One of the actions on the team. While a write is under way it is only dimmed (aria-disabled): a disabled button loses
 * focus.
 */
export function ActionButton({ label, title, waiting, busy, onPress, className, dialog, ref }: ActionButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={className ? `squad-action ${className}` : "squad-action"}
      aria-haspopup={dialog ? "dialog" : undefined}
      disabled={waiting}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-tip={title}
      onClick={() => !busy && onPress()}
    >
      {label}
    </button>
  );
}

interface ResultLineProps {
  /** What the last write came to, for the team that is shown; none when there is nothing to say. */
  result: Result | null;
  busy: boolean;
  onUndo: (take: Undo) => void;
  /** The line takes focus when the button that had it is gone (see `SquadTab`). */
  ref: Ref<HTMLDivElement>;
}

/**
 * What the last write came to, with the button that takes it back and what the game refused. A live region that is
 * always there, so that it is read out when it fills; it takes no room while it is empty.
 */
export function ResultLine({ result, busy, onUndo, ref }: ResultLineProps) {
  return (
    <div ref={ref} className="squad-result" role="status" tabIndex={-1}>
      {result && (
        <>
          <div className="squad-result-line">
            <p className={result.failed ? "error" : undefined}>{result.message}</p>
            {result.undo && (
              <button
                type="button"
                className="squad-action"
                aria-disabled={busy || undefined}
                data-tip={text.undoTitle}
                onClick={() => result.undo && onUndo(result.undo)}
              >
                {text.undo}
              </button>
            )}
          </div>
          {result.problems.length > 0 && (
            <ul className="edit-problems">
              {result.problems.map((problem, index) => (
                <li key={index}>{problem}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface SquadRowProps {
  player: SquadPlayer;
  /** The role he holds in the shown team. */
  role: CaptainRole | null;
  editable: boolean;
  busy: boolean;
  onCaptain: (role: CaptainRole) => void;
  /** Opens his profile over the squad; `from` is the name, which takes focus back once it is closed. */
  onOpen: (from: HTMLButtonElement) => void;
  /** What his current ability was at the record he is compared with, where the app has one (see `AbilityChange`). */
  earlier: EarlierAbility | undefined;
}

/**
 * One player: his name, which opens his profile over the squad, with his tags and badge by it, his values, and the menu
 * that makes him captain.
 */
function SquadRow({ player, role, editable, busy, onCaptain, onOpen, earlier }: SquadRowProps) {
  const positions = player.positions.map(positionLabel);
  const fullName = player.fullName !== null && player.fullName !== player.name ? player.fullName : null;
  return (
    // A player who does not play for the team is told apart by his tag, and dimmed.
    <tr className={player.playsHere ? undefined : "away"}>
      <td className="col-name" title={fullName === null ? player.name : `${player.name}\n${fullName}`}>
        <div className="squad-name">
          <button
            type="button"
            className="name name-link"
            aria-haspopup="dialog"
            title={text.openProfile}
            onClick={(event) => onOpen(event.currentTarget)}
          >
            {player.name}
          </button>
          {role !== null && (
            <abbr className={`role-badge ${role}`} title={fieldLabel("club", ROLE_FIELD[role])}>
              {role === "captain" ? text.captainShort : text.viceCaptainShort}
            </abbr>
          )}
          <Tags player={player} />
        </div>
      </td>
      {/* The main position; the hover text has the others he can play. */}
      <td title={positions.join(" ") || undefined}>
        {positions[0] ?? <span className="muted">{profileText.none}</span>}
      </td>
      <td className="num">{player.age ?? profileText.none}</td>
      <td className="num">
        <AbilityChange now={player.currentAbility} earlier={earlier} />
        <Ability value={player.currentAbility} />
      </td>
      <td className="num">
        <Ability value={player.potentialAbility} />
      </td>
      <td className="num">{percentText(player.condition)}</td>
      <td className="num">{percentText(player.matchSharpness)}</td>
      <td className="num">{formatNumber(player.jadedness)}</td>
      <td className="num">{profileText.morale(player.morale)}</td>
      <td className="num">{player.cohesion ?? <span className="muted">{profileText.none}</span>}</td>
      <td className="num">{player.tactics ?? <span className="muted">{profileText.none}</span>}</td>
      <td className="col-actions">
        {player.playsHere && (
          <CaptainMenu name={player.name} holds={role} editable={editable} busy={busy} onPick={onCaptain} />
        )}
      </td>
    </tr>
  );
}

/**
 * What is out of the ordinary about a player: his injuries, bans, teammates unhappy about him, a loan, playing for
 * another team of the club, or being frozen.
 */
function Tags({ player }: { player: SquadPlayer }) {
  return (
    <>
      {player.injuries > 0 && (
        <span className="tag injured" title={text.injuredTitle(player.injuries)}>
          {text.injured}
        </span>
      )}
      {player.bans > 0 && (
        <span className="tag injured" title={text.bannedTitle(player.bans)}>
          {text.banned}
        </span>
      )}
      {player.concernedTeammates > 0 && (
        <span className="tag injured" data-tip={text.unrestTitle(player.concernedTeammates)}>
          {text.unrest}
        </span>
      )}
      {player.loan === "out" ? (
        <span className="tag loan" title={text.onLoanTitle}>
          {text.onLoan}
        </span>
      ) : player.loan === "in" ? (
        <span className="tag loan" title={text.loaneeTitle}>
          {text.loanee}
        </span>
      ) : (
        !player.playsHere && (
          <span className="tag" title={text.elsewhereTitle}>
            {text.elsewhere}
          </span>
        )
      )}
      {(player.attributesFrozen || player.fitnessFrozen || player.positionsFrozen) && (
        <span
          className="tag frozen"
          title={text.frozenTitle(player.attributesFrozen, player.fitnessFrozen, player.positionsFrozen)}
        >
          {text.frozen}
        </span>
      )}
      {player.boosted && (
        <span className="tag boosted" title={text.boostedTagTitle}>
          {text.boostedTag}
        </span>
      )}
    </>
  );
}
