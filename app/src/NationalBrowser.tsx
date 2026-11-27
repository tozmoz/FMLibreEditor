// The national teams, which the Clubs tab lists behind its switch (see `TeamsSwitch`): each nation's men's and women's
// team with the reputation of its senior team, and, beside the list, the profile of the one picked: its teams (the
// senior team and its youth teams, "Under 21" and so on), the reputation of each, which can be edited, and the squad the
// game lists for the team picked, with Heal all, Inspire all and Refresh all for the senior team's players. Calling
// players up, the captains and the manager's contract are not here (see docs/recon/fm27-national-teams.md). Where this
// version of the game has no national teams to read, it says why instead of the list.

import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Ability } from "./Ability";
import { EditableValue } from "./EditControls";
import { changeLog, nationalProfile, nationalStatus, nationalTeamAction, undoBatch } from "./editing";
import { FilterBar } from "./FilterBar";
import { describeError, formatNumber } from "./format";
import {
  choiceLabel,
  fieldLabel,
  jobLabel,
  massEditText,
  nationalTeamLabel,
  nationalText as text,
  playerListText,
  positionLabel,
  profileText,
  squadText,
  staffListText,
} from "./labels";
import { ListBrowser, type ListRequest } from "./ListBrowser";
import { undoFailureLines } from "./massDraft";
import { percentText } from "./MedicalGroup";
import { NationFlag, PICTURE_SIZE, WithPicture } from "./Picture";
import { PlayerDialog } from "./PlayerProfile";
import { Fact, ProfileFrame, ReputationMeter, type Loaded } from "./ProfileParts";
import { restored, useSnapshot } from "./restore";
import { ActionButton, refusalLines, ResultLine, type Result, type Undo } from "./SquadTab";
import type {
  NationDetails,
  NationSettings,
  NationalProfile,
  NationalSide,
  NationalStatus,
  NationalTeamAction,
  NationalTeamSummary,
  SquadPlayer,
} from "./types";
import { EditorContext, useProfileEditing } from "./useProfileEditing";

/** Which teams the list shows. */
type Kind = "all" | "men" | "women";

const readKind = (value: unknown): Kind => (value === "men" || value === "women" ? value : "all");

interface NationalBrowserProps {
  /** Changes when the game data is read again, so the list and the open profile are too. */
  version: number;
  active: boolean;
  /** What the command palette asks of the list (see `ListRequest`). */
  request?: ListRequest<NationalTeamSummary> | null;
  /** Over the list, and over the note when there is none: the switch back to the clubs (see `TeamsSwitch`). */
  scope?: ReactNode;
}

/** The nations' teams with the profile of the selected one beside them; or the reason there are none to show. */
export function NationalBrowser({ version, active, request = null, scope }: NationalBrowserProps) {
  const [status, setStatus] = useState<NationalStatus | null>(null);
  const [kind, setKind] = useState<Kind>(() => restored("nationalKind", readKind));
  useSnapshot("nationalKind", () => kind);

  // Asked again whenever the game is read again: another save, or another build, may have them.
  useEffect(() => {
    let current = true;
    nationalStatus().then(
      (found) => current && setStatus(found),
      () => current && setStatus(null),
    );
    return () => {
      current = false;
    };
  }, [version]);

  if (status?.available === false) {
    return (
      <section className="national-unavailable" hidden={!active} aria-live="polite">
        {scope}
        <h2>{text.unavailableTitle}</h2>
        <p>{status.reason === "unreadable" ? text.unavailableUnreadable : text.unavailableBuild}</p>
      </section>
    );
  }

  const women = kind === "all" ? undefined : kind === "women";
  return (
    <ListBrowser<NationalTeamSummary>
      name="nationals"
      command="search_national_teams"
      requestArgs={{ women }}
      request={request}
      version={version}
      active={active}
      placeholder={text.search}
      summary={text.summary}
      empty={(query) => text.empty(query, kind !== "all")}
      scope={scope}
      filterBar={
        <FilterBar active={kind === "all" ? 0 : 1} onClear={() => setKind("all")}>
          <label className="filter-field">
            <span>{text.filters.kind}</span>
            <select value={kind} onChange={(e) => setKind(readKind(e.currentTarget.value))}>
              <option value="all">{text.filters.all}</option>
              <option value="men">{text.filters.men}</option>
              <option value="women">{text.filters.women}</option>
            </select>
          </label>
        </FilterBar>
      }
      tableClass="club-grid national-grid"
      header={
        <>
          <th className="col-name">{text.columns.name}</th>
          <th className="col-league">{text.columns.code}</th>
          <th className="num col-rep">{text.columns.reputation}</th>
          <th className="num col-founded">{text.columns.players}</th>
          <th className="num col-uid">{text.columns.uid}</th>
        </>
      }
      cells={(team) => <NationalCells team={team} />}
      profile={(team, panel) => <NationalProfileView team={team} version={panel.version} onClose={panel.onClose} />}
    />
  );
}

function NationalCells({ team }: { team: NationalTeamSummary }) {
  return (
    <>
      <td className="col-name" title={team.name}>
        <WithPicture picture={<NationFlag uid={team.nationUid} />}>
          <div className="name">
            <span className="name-text">{team.name}</span>
            {team.women && <span className="tag women">{text.women}</span>}
          </div>
        </WithPicture>
      </td>
      <td className="col-league">{team.code ?? <span className="muted">{profileText.none}</span>}</td>
      <td className="num col-rep">
        <ReputationMeter value={team.reputation} />
      </td>
      <td className="num col-founded">{team.players}</td>
      <td className="num uid col-uid">{team.uid}</td>
    </>
  );
}

interface NationalProfileViewProps {
  /** The row that was picked; its fields fill the header while the profile loads. */
  team: NationalTeamSummary;
  version: number;
  onClose: () => void;
}

/**
 * The profile of one national team: its nation and the reputation of its senior team in the header, and under it its
 * teams, the reputation of the one picked when it is not the senior team, the actions on the senior team's players when
 * it is, and that team's squad.
 */
function NationalProfileView({ team, version, onClose }: NationalProfileViewProps) {
  // The kind of team picked, for this nation only: another nation opens on its senior team.
  const [picked, setPicked] = useState<{ uid: number; kind: number } | null>(null);
  const kind = picked?.uid === team.uid ? picked.kind : null;
  const loaded = useNationalProfile(team.uid, kind, version);
  const editing = useProfileEditing("nationalTeam", team.uid);
  const info = loaded?.details?.team ?? team;
  const teams = loaded?.details?.teams;
  const squad = loaded?.details?.squad;
  const shown = teams?.find((side) => side.kind === squad?.kind);
  const youthRating = loaded?.details?.youthRating ?? null;
  const settings = loaded?.details?.settings ?? null;

  return (
    <ProfileFrame
      picture={<NationFlag uid={info.nationUid} size={PICTURE_SIZE.clubLogo} label={info.name} />}
      name={info.name}
      fullName={null}
      badge={info.women ? <span className="tag women">{text.womensTeam}</span> : undefined}
      vitals={[info.code, `${profileText.uid} ${info.uid}`]}
      side={
        // Laid out like a club's reputation: a label and a bar with the number on it, an input while it is edited.
        <div className="profile-abilities">
          <abbr title={text.reputationTitle}>{text.reputationShort}</abbr>
          <EditableValue field="reputation">
            <ReputationMeter value={info.reputation} />
          </EditableValue>
          {youthRating !== null && (
            <>
              <abbr title={text.youthRatingTitle}>{text.youthRatingShort}</abbr>
              <EditableValue field="youth_rating">
                <Ability value={youthRating} />
              </EditableValue>
            </>
          )}
        </div>
      }
      wide
      loaded={loaded}
      onClose={onClose}
      editing={editing}
    >
      {loaded?.details && teams && (
        <div className="squad-tab">
          {loaded.details.nation && <NationDetailsBlock nation={loaded.details.nation} />}
          {settings && <NationSettingsBlock settings={settings} />}
          {teams.length === 0 || !shown ? (
            <p className="empty">{text.noTeams}</p>
          ) : (
            <>
              <NationalTeams
                teams={teams}
                shown={shown}
                onPick={(picked) => setPicked({ uid: team.uid, kind: picked })}
              />
              <NationalSquad
                team={shown}
                players={squad?.players ?? []}
                version={version}
                actions={
                  shown.kind === 0 && squad ? (
                    <NationalActions key={team.uid} uid={team.uid} players={squad.players} />
                  ) : null
                }
              />
            </>
          )}
        </div>
      )}
    </ProfileFrame>
  );
}

/**
 * What the game shows of the nation and its federation, read only: the year the federation was founded, the continent,
 * and the federation's staff as the game's staff list of the nation's team shows them, team by team, each with his job
 * in the national team (not the one at his club, if he has one).
 */
function NationDetailsBlock({ nation }: { nation: NationDetails }) {
  const none = <span className="muted">{profileText.none}</span>;
  return (
    <div className="nation-details">
      <section className="profile-group">
        <h3>{text.details.nation}</h3>
        <dl className="stats">
          <Fact label={text.details.founded}>{nation.founded ?? none}</Fact>
          <Fact label={text.details.continent}>{nation.continent ?? none}</Fact>
        </dl>
      </section>
      <section className="profile-group">
        <h3>{text.details.staff(nation.staff.length)}</h3>
        {nation.staff.length === 0 ? (
          <p className="empty">{text.details.noStaff}</p>
        ) : (
          <div className="squad-table-wrap">
            <table className="grid squad-grid" aria-label={text.details.staff(nation.staff.length)}>
              <thead>
                <tr>
                  <th className="col-name">{staffListText.columns.name}</th>
                  <th>{text.details.job}</th>
                  <th>{text.details.team}</th>
                </tr>
              </thead>
              <tbody>
                {nation.staff.map(({ member, job, teamKind }) => (
                  <tr key={member.uid}>
                    <td className="col-name">{member.name}</td>
                    <td>{jobLabel(job)}</td>
                    <td>{teamKind === null ? none : nationalTeamLabel(teamKind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">{text.details.staffNote}</p>
      </section>
    </div>
  );
}

/**
 * A nation's settings as the pre-game editor shows them, read from the game: the game importance and the federation's
 * financial power and patience, the attendance of its matches, and the economic factor and state of development of the
 * nation. Each value is an input while the profile is edited; the two codes are shown by their names. The rows stand in
 * two columns, as a club's facts do, so that the squad under them keeps room on a window of ordinary height.
 */
function NationSettingsBlock({ settings }: { settings: NationSettings }) {
  const none = <span className="muted">{profileText.none}</span>;
  const rows: { field: string; value: number | null }[] = [
    { field: "game_importance", value: settings.gameImportance },
    { field: "fa_financial_power", value: settings.faFinancialPower },
    { field: "fa_patience", value: settings.faPatience },
    { field: "attendance", value: settings.attendance },
    { field: "min_attendance", value: settings.minAttendance },
    { field: "max_attendance", value: settings.maxAttendance },
    { field: "economic_factor", value: settings.economicFactor },
    { field: "state_of_development", value: settings.stateOfDevelopment },
  ];
  const shown = (field: string, value: number) =>
    field === "game_importance" || field === "state_of_development" ? choiceLabel(field, value) : formatNumber(value);
  const fact = ({ field, value }: { field: string; value: number | null }) => (
    <Fact key={field} label={fieldLabel("nationalTeam", field)}>
      {value === null ? none : (
        <EditableValue field={field} inFact>
          {shown(field, value)}
        </EditableValue>
      )}
    </Fact>
  );
  return (
    <section className="profile-group">
      <h3>{text.settings.heading}</h3>
      <div className="profile-split">
        <dl className="stats">{rows.slice(0, rows.length / 2).map(fact)}</dl>
        <dl className="stats">{rows.slice(rows.length / 2).map(fact)}</dl>
      </div>
      <p className="note">{text.settings.note}</p>
    </section>
  );
}

/** The national team `uid` as its profile shows it, with its team of kind `kind`, read again whenever `version` changes. */
function useNationalProfile(uid: number, kind: number | null, version: number): Loaded<NationalProfile> | null {
  const [loaded, setLoaded] = useState<Loaded<NationalProfile> | null>(null);
  useEffect(() => {
    let cancelled = false;
    nationalProfile(uid, kind).then(
      (details) => !cancelled && setLoaded({ details }),
      (e) => !cancelled && setLoaded({ error: describeError(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [uid, kind, version]);
  return loaded;
}

interface NationalTeamsProps {
  teams: readonly NationalSide[];
  shown: NationalSide;
  onPick: (kind: number) => void;
}

/**
 * The switch between the nation's teams, as a club's squad has it, and beside it the reputation of the team shown when
 * it is not the senior team, whose reputation the header has: an input while the profile is edited.
 */
function NationalTeams({ teams, shown, onPick }: NationalTeamsProps) {
  return (
    <div className="squad-summary national-teams">
      <div className="squad-teams" role="group" aria-label={text.teamsLabel}>
        {teams.map((side) => (
          <button key={side.kind} type="button" aria-pressed={side.kind === shown.kind} onClick={() => onPick(side.kind)}>
            {nationalTeamLabel(side.kind)}
          </button>
        ))}
      </div>
      {shown.kind !== 0 && (
        <div className="profile-abilities national-team-reputation">
          <abbr title={text.teamReputationTitle}>{text.reputationShort}</abbr>
          <EditableValue field={`team.${shown.kind}.reputation`}>
            <ReputationMeter value={shown.reputation} />
          </EditableValue>
        </div>
      )}
    </div>
  );
}

interface NationalActionsProps {
  /** The national team, whose senior team they act on. */
  uid: number;
  /** The players its senior team lists, as read last: a new list means the game has been read again. */
  players: readonly SquadPlayer[];
}

/**
 * Heal all, Inspire all and Refresh all for the players the senior team lists, as a club's Squad tab has them, and under
 * them the line that says what was written and takes it back. They wait while the game cannot be written to, and say why.
 */
function NationalActions({ uid, players }: NationalActionsProps) {
  const { editable, readOnlyNote, onEdited } = useContext(EditorContext);
  // Whether a write is under way, or done and waiting for the squad to be read again.
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const alive = useRef(true);
  const resultBox = useRef<HTMLDivElement>(null);
  // Set while a write may take the button that has focus out of play.
  const refocus = useRef(false);
  const injured = players.filter((player) => player.injuries > 0).length;
  const empty = players.length === 0;
  // What a button's hover text says: why it waits, or else what it does.
  const hover = (does: string, waiting: string | null) => (!editable ? readOnlyNote : (waiting ?? does));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // A write stays busy until the squad has been read again: pressed in between, the buttons would work from numbers
  // that are out of date.
  useEffect(() => {
    setBusy(false);
  }, [players]);

  // A write can take the button that had focus out of play (Heal all once nobody is injured, Undo once it is done):
  // focus then goes to the line under the buttons.
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

  const write = async (task: () => Promise<Result>) => {
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
      // The game has changed: the lists, the profile and the change log read it again.
      onEdited();
    } catch (e) {
      if (alive.current) {
        setResult({ team: 0, message: describeError(e), failed: true, problems: [], undo: null });
        setBusy(false);
      }
    }
  };

  const act = (action: NationalTeamAction) =>
    write(async () => {
      const report = await nationalTeamAction(uid, action);
      return {
        team: 0,
        message: squadText.written(report.applied),
        failed: false,
        problems: refusalLines(report.failed),
        // An action that wrote nothing has nothing to take back.
        undo: report.applied > 0 ? () => undoBatch(report.batch) : null,
      };
    });

  const undo = (take: Undo) =>
    write(async () => {
      const done = await take();
      // The log names the players behind the changes that could not be taken back.
      const log = done.failed.length > 0 ? await changeLog().catch(() => []) : [];
      return {
        team: 0,
        message: massEditText.undone(done.undone),
        failed: false,
        problems: undoFailureLines(done.failed, log),
        undo: null,
      };
    });

  return (
    <>
      <div className="squad-actions">
        <div className="squad-buttons" role="group" aria-label={squadText.actionsLabel}>
          <ActionButton
            label={squadText.healAll(injured)}
            title={hover(squadText.healAllTitle, injured === 0 ? squadText.healNone : null)}
            waiting={!editable || injured === 0}
            busy={busy}
            onPress={() => void act("heal")}
          />
          <ActionButton
            label={squadText.inspireAll}
            title={hover(squadText.inspireAllTitle, empty ? squadText.empty : null)}
            waiting={!editable || empty}
            busy={busy}
            onPress={() => void act("inspire")}
          />
          <ActionButton
            label={squadText.refreshAll}
            title={hover(squadText.refreshAllTitle, empty ? squadText.empty : null)}
            waiting={!editable || empty}
            busy={busy}
            onPress={() => void act("refresh")}
          />
        </div>
        <p className="note squad-hint">{text.actionsHint}</p>
      </div>
      <ResultLine ref={resultBox} result={result} busy={busy} onUndo={(take) => void undo(take)} />
    </>
  );
}

interface NationalSquadProps {
  /** The team whose players these are. */
  team: NationalSide;
  players: readonly SquadPlayer[];
  version: number;
  /** Between the count of players and the table: the actions on them, for the senior team. */
  actions?: ReactNode;
}

/**
 * The players the game lists for one of the nation's teams, in the order it lists them. A name opens the player's
 * profile over the squad, as in a club's.
 */
function NationalSquad({ team, players, version, actions }: NationalSquadProps) {
  const [shown, setShown] = useState<SquadPlayer | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const columns = playerListText.columns;
  const squadColumns = squadText.columns;

  // Once his profile is closed, focus goes back to the name that opened it.
  useEffect(() => {
    if (shown === null && opener.current?.isConnected) {
      opener.current.focus();
    }
  }, [shown]);

  return (
    <>
      <div className="squad-summary">
        <p className="squad-count">{text.squadHeading(nationalTeamLabel(team.kind), players.length)}</p>
        <p className="note squad-hint">{text.squadNote}</p>
      </div>
      {actions}
      <div className="squad-table-wrap">
        <table className="grid squad-grid" aria-label={text.squadLabel(nationalTeamLabel(team.kind))}>
          <thead>
            <tr>
              <th className="col-name">{columns.name}</th>
              <th>{columns.positions}</th>
              <th className="num">{columns.age}</th>
              <th>{columns.club}</th>
              <th className="num">{columns.currentAbility}</th>
              <th className="num">{columns.potentialAbility}</th>
              <th className="num">{squadColumns.condition}</th>
              <th className="num">{squadColumns.matchSharpness}</th>
              <th className="num">{squadColumns.morale}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const positions = player.positions.map(positionLabel);
              return (
                <tr key={player.uid}>
                  <td className="col-name" title={player.fullName ?? player.name}>
                    <div className="squad-name">
                      <button
                        type="button"
                        className="name name-link"
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          opener.current = event.currentTarget;
                          setShown(player);
                        }}
                      >
                        {player.name}
                      </button>
                      {player.injuries > 0 && (
                        <span className="tag injured" title={squadText.injuredTitle(player.injuries)}>
                          {squadText.injured}
                        </span>
                      )}
                    </div>
                  </td>
                  <td title={positions.join(" ") || undefined}>
                    {positions[0] ?? <span className="muted">{profileText.none}</span>}
                  </td>
                  <td className="num">{player.age ?? profileText.none}</td>
                  <td>{player.club ?? <span className="muted">{profileText.none}</span>}</td>
                  <td className="num">
                    <Ability value={player.currentAbility} />
                  </td>
                  <td className="num">
                    <Ability value={player.potentialAbility} />
                  </td>
                  <td className="num">{percentText(player.condition)}</td>
                  <td className="num">{percentText(player.matchSharpness)}</td>
                  <td className="num">{profileText.morale(player.morale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {players.length === 0 && <p className="empty">{text.noPlayers}</p>}
      </div>
      {shown && <PlayerDialog player={shown} version={version} onClose={() => setShown(null)} />}
    </>
  );
}
