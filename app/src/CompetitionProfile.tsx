import { EditableValue } from "./EditControls";
import { colourHex, formatDate, formatNumber } from "./format";
import { choiceLabel, competitionListText, competitionProfileText, profileText } from "./labels";
import { CompetitionLogo, PICTURE_SIZE } from "./Picture";
import { Fact, ProfileFrame, ReputationMeter, useProfileDetails } from "./ProfileParts";
import type { CompetitionSummary } from "./types";
import { useProfileEditing } from "./useProfileEditing";

const text = competitionProfileText;

/** The most stages a league is played in; a cup has more (see `CompetitionSummary.isLeague` in the Rust side). */
const MOST_LEAGUE_STAGES = 1;

/**
 * Whether the competition is played as a league rather than as a cup: its stages say so. Null where the layout does
 * not place them (a system the editor has not read the competition's fields on), where it is neither to the app.
 */
export function isLeague(competition: CompetitionSummary): boolean | null {
  return competition.stages === null ? null : competition.stages <= MOST_LEAGUE_STAGES;
}

interface CompetitionProfileProps {
  /** The row that was picked; its fields fill the header while the profile is read again. */
  competition: CompetitionSummary;
  /** Changes when the game data is read again, so the profile is too. */
  version: number;
  onClose: () => void;
}

/**
 * The profile of one competition: where it is played, how big the game rates it and the season it runs in, two of
 * which can be changed. Mount it with `key={uid}` so a new competition starts at the top.
 */
export function CompetitionProfile({ competition, version, onClose }: CompetitionProfileProps) {
  const loaded = useProfileDetails<CompetitionSummary>("competition_details", competition.uid, version);
  const editing = useProfileEditing("competition", competition.uid);
  const details = loaded?.details;
  const info: CompetitionSummary = details ?? competition;
  const league = isLeague(info);

  return (
    <ProfileFrame
      picture={<CompetitionLogo uid={info.uid} name={info.name} size={PICTURE_SIZE.competitionLogo} />}
      name={info.name}
      fullName={info.shortName}
      badge={
        league !== null && (
          <>
            <span className="tag">{league ? competitionListText.league : competitionListText.cup}</span>
            {info.nation === null && <span className="tag">{competitionListText.international}</span>}
          </>
        )
      }
      vitals={[`${profileText.uid} ${info.uid}`]}
      side={
        // Laid out like the abilities of a person: a label and a bar with the number on it. The game rates a
        // competition out of 200, so the bar fills at that. While it is edited the number is an input.
        <div className="profile-abilities">
          <abbr title={text.reputationTitle}>{text.reputationShort}</abbr>
          <EditableValue field="reputation">
            <ReputationMeter value={info.reputation} max={200} />
          </EditableValue>
        </div>
      }
      loaded={loaded}
      onClose={onClose}
      editing={editing}
    >
      {details && (
        // One column: a select as wide as the game's longest substitution rule (or a date with its calendar button)
        // would leave the labels of a two-column layout no room while the profile is edited.
        <div className="profile-stack">
          <WhereGroup details={details} known={league !== null} />
          <RulesGroup details={details} />
          <SeasonGroup details={details} />
          <ColoursGroup details={details} />
        </div>
      )}
    </ProfileFrame>
  );
}

/** Where the competition is played, and how the game runs it: nation, continent, stages and matches. */
function WhereGroup({ details, known }: { details: CompetitionSummary; known: boolean }) {
  return (
    <section className="profile-group">
      <h3>{text.where}</h3>
      <dl className="stats">
        {/* A competition with no nation is one nations play between themselves, where the layout reads them at all. */}
        <Fact label={text.nation}>
          {details.nation ?? (known ? competitionListText.international : text.none)}
        </Fact>
        <Fact label={text.continent}>{details.continent ?? text.none}</Fact>
        <Fact label={text.stages} title={text.stagesTitle}>
          {details.stages === null ? text.none : formatNumber(details.stages)}
        </Fact>
        {/* A cup's matches depend on how far a team goes, so the game keeps none. */}
        <Fact label={text.matches}>{details.matches === null ? text.none : formatNumber(details.matches)}</Fact>
      </dl>
    </section>
  );
}

/**
 * The substitution rule the competition's matches are played under: one of the game's substitution rules, or none
 * (0xFF) to leave the rule the competition is stored with alone. The game applies a new rule to fixtures made after
 * the change; matches already scheduled keep the one they were made with.
 */
function RulesGroup({ details }: { details: CompetitionSummary }) {
  return (
    <section className="profile-group">
      <h3>{text.rules}</h3>
      <dl className="stats">
        <Fact label={text.substitutionRules} title={text.substitutionRulesTitle}>
          <EditableValue field="substitution_rules">
            {details.substitutionRules === null
              ? text.none
              : choiceLabel("substitution_rules", details.substitutionRules)}
          </EditableValue>
        </Fact>
      </dl>
      <p className="note">{text.substitutionRulesNote}</p>
    </section>
  );
}

/**
 * The colours the game keeps for the competition: the ground and the text on it, the kit its teams wear, and the
 * colour of the champion's name. Shown as swatches while the profile is read, as colour pickers while it is edited.
 */
function ColoursGroup({ details }: { details: CompetitionSummary }) {
  const colours = details.colours;
  return (
    <section className="profile-group">
      <h3>{text.colours}</h3>
      <dl className="stats">
        <ColourFact field="colour.background" label={text.background} colour={colours?.background} />
        <ColourFact field="colour.foreground" label={text.foreground} colour={colours?.foreground} />
        <ColourFact field="colour.kit" label={text.kit} colour={colours?.kit} />
        <ColourFact field="colour.text" label={text.championText} colour={colours?.text} />
      </dl>
      <p className="note">{text.coloursNote}</p>
    </section>
  );
}

/** One colour: its swatch and its page name, ""F8F8F8"" under the game's alpha, or a dash where it cannot be read. */
function ColourFact({ field, label, colour }: { field: string; label: string; colour: number | undefined }) {
  return (
    <Fact label={label}>
      <EditableValue field={field}>
        {colour === undefined ? (
          <span className="muted">{text.none}</span>
        ) : (
          <span className="colour">
            <span className="colour-chip" style={{ background: colourHex(colour) }} aria-hidden="true" />
            {colourHex(colour).toUpperCase()}
          </span>
        )}
      </EditableValue>
    </Fact>
  );
}

/**
 * The season the competition runs in: its first and last day, which the game changes as the save moves on and which
 * can be set here, while the competition is edited.
 */
function SeasonGroup({ details }: { details: CompetitionSummary }) {
  return (
    <section className="profile-group">
      <h3>{text.season}</h3>
      <dl className="stats">
        <Fact label={text.seasonStart}>
          <EditableValue field="season_start">
            {formatDate(details.seasonStart) || text.none}
          </EditableValue>
        </Fact>
        <Fact label={text.seasonEnd}>
          <EditableValue field="season_end">
            {formatDate(details.seasonEnd) || text.none}
          </EditableValue>
        </Fact>
      </dl>
      <p className="note">{text.seasonNote}</p>
    </section>
  );
}
