import { useState } from "react";
import { CompetitionProfile, isLeague } from "./CompetitionProfile";
import { competitionListText, profileText } from "./labels";
import { ListBrowser } from "./ListBrowser";
import { CompetitionLogo, PICTURE_SIZE, WithPicture } from "./Picture";
import { ReputationMeter } from "./ProfileParts";
import { restored, useSnapshot } from "./restore";
import type { CompetitionFilter, CompetitionSummary } from "./types";

const columns = competitionListText.columns;
const filters = competitionListText.filters;

/** The game rates a competition out of 200 (see `competitionProfile.reputationTitle`). */
const REPUTATION_MAX = 200;

/** Which competitions the list shows. */
type CompetitionKind = "all" | "domestic" | "international";

/** The kind of competitions saved before the language was switched; all of them when there is none. */
const readKind = (value: unknown): CompetitionKind =>
  value === "domestic" || value === "international" ? value : "all";

/** The competitions table with the profile of the selected one beside it. */
export function CompetitionBrowser({ version, active }: { version: number; active: boolean }) {
  // It starts as it was before the language was switched, if it was (see `restore.ts`).
  const [kind, setKind] = useState<CompetitionKind>(() => restored("competitionKind", readKind));
  useSnapshot("competitionKind", () => kind);
  const filter: CompetitionFilter | undefined = kind === "all" ? undefined : { international: kind === "international" };

  return (
    <ListBrowser<CompetitionSummary>
      name="competitions"
      command="search_competitions"
      requestArgs={{ filter }}
      version={version}
      active={active}
      placeholder={competitionListText.search}
      summary={competitionListText.summary}
      empty={(query) => competitionListText.empty(query, filter !== undefined)}
      filterBar={
        <div className="filter-bar">
          <div className="filter-fields">
            <select
              aria-label={filters.kind}
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as CompetitionKind)}
            >
              <option value="all">{filters.all}</option>
              <option value="domestic">{filters.domestic}</option>
              <option value="international">{filters.international}</option>
            </select>
          </div>
        </div>
      }
      tableClass="competition-grid"
      header={
        <>
          <th className="col-name">{columns.name}</th>
          <th className="col-nation">{columns.nation}</th>
          <th className="num col-rep">{columns.reputation}</th>
          <th className="num col-matches">{columns.matches}</th>
          <th className="num col-uid">{columns.uid}</th>
        </>
      }
      cells={(c) => <CompetitionCells competition={c} />}
      profile={(c, panel) => (
        <CompetitionProfile competition={c} version={panel.version} onClose={panel.onClose} />
      )}
    />
  );
}

function CompetitionCells({ competition: c }: { competition: CompetitionSummary }) {
  // Null where the layout of this system does not place the competition's fields: then neither its kind nor whether
  // nations play it is known.
  const league = isLeague(c);
  return (
    <>
      <td className="col-name" title={c.name}>
        <WithPicture picture={<CompetitionLogo uid={c.uid} name={c.name} size={PICTURE_SIZE.competitionRowLogo} />}>
          <div className="name">
            <span className="name-text">{c.name}</span>
            {league !== null && (
              <span className="tag">{league ? competitionListText.league : competitionListText.cup}</span>
            )}
          </div>
          {c.shortName && c.shortName !== c.name && <div className="sub">{c.shortName}</div>}
        </WithPicture>
      </td>
      {/* A competition no nation's teams play in: the international cups and leagues. */}
      <td className="col-nation">
        {c.nation ??
          (league === null ? profileText.none : <span className="muted">{competitionListText.international}</span>)}
      </td>
      <td className="num col-rep">
        <ReputationMeter value={c.reputation} max={REPUTATION_MAX} />
      </td>
      <td className="num col-matches">{c.matches === null ? profileText.none : c.matches}</td>
      <td className="num uid col-uid">{c.uid}</td>
    </>
  );
}
