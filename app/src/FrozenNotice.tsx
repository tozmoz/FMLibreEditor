// The notice under the masthead after connecting to a save in which players' attributes, energy and match sharpness or
// positions, the attributes of staff or clubs' money were frozen before, stadiums renamed or a team boosted for a match:
// what is frozen, renamed or boosted again, whose attributes went back as they were, and what waits until FMLibreEditor
// can write to this version of the game. It also says whose boost the app put back while connected, as the game moved
// on from its day.

import { useEffect, useRef } from "react";
import { call } from "./api";
import { appText } from "./labels";
import type { Refrozen } from "./types";

const text = appText.refrozen;

/** Most names the notice lists of each kind; it counts the rest. */
const NAMES_SHOWN = 5;

/** How often the app is asked whether it put back a boost. */
const POLL_MS = 3000;

/** A notice with nothing in it yet, for the boosts put back while connected. */
export const NOTHING_REFROZEN: Refrozen = {
  players: [],
  staff: [],
  clubs: [],
  fitness: [],
  positions: [],
  stadiums: [],
  boosted: [],
  putBack: [],
  waiting: 0,
};

const names = (list: string[]) =>
  list.length > NAMES_SHOWN
    ? `${list.slice(0, NAMES_SHOWN).join(", ")} ${text.more(list.length - NAMES_SHOWN)}`
    : list.join(", ");

/**
 * Calls `onOver` with the names of the players whose boost the app put back since it was last asked, as the game moved
 * on from the boost's day: asked every few seconds while `connected`. A question left unanswered changes nothing, and
 * the next one is asked all the same.
 */
export function useBoostsOver(connected: boolean, onOver: (names: string[]) => void) {
  const latest = useRef(onOver);

  useEffect(() => {
    latest.current = onOver;
  }, [onOver]);

  useEffect(() => {
    if (!connected) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      try {
        const over = await call<string[]>("boosts_over");
        if (!cancelled && over.length > 0) {
          latest.current(over);
        }
      } catch {
        // No answer: the next question may get one.
      }
      if (!cancelled) {
        timer = setTimeout(ask, POLL_MS);
      }
    };
    timer = setTimeout(ask, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [connected]);
}

/** What connecting froze again, by name, and how many wait; it stays until it is dismissed. */
export function FrozenNotice({ refrozen, onDismiss }: { refrozen: Refrozen; onDismiss: () => void }) {
  const again =
    refrozen.players.length +
      refrozen.staff.length +
      refrozen.fitness.length +
      refrozen.positions.length +
      refrozen.clubs.length +
      refrozen.stadiums.length +
      refrozen.boosted.length >
    0;
  const title = again ? text.title : refrozen.putBack.length > 0 ? text.putBackTitle : text.waitingTitle;
  return (
    <div className="frozen-notice" role="status">
      <div className="compatibility-text">
        <strong>{title}</strong>
        {refrozen.players.length > 0 && <p>{text.players(names(refrozen.players))}</p>}
        {refrozen.staff.length > 0 && <p>{text.staff(names(refrozen.staff))}</p>}
        {refrozen.fitness.length > 0 && <p>{text.fitness(names(refrozen.fitness))}</p>}
        {refrozen.positions.length > 0 && <p>{text.positions(names(refrozen.positions))}</p>}
        {refrozen.clubs.length > 0 && <p>{text.clubs(names(refrozen.clubs))}</p>}
        {refrozen.stadiums.length > 0 && <p>{text.stadiums(names(refrozen.stadiums))}</p>}
        {refrozen.boosted.length > 0 && <p>{text.boosted(names(refrozen.boosted))}</p>}
        {refrozen.putBack.length > 0 && <p>{text.putBack(names(refrozen.putBack))}</p>}
        {refrozen.waiting > 0 && <p>{text.waiting(refrozen.waiting)}</p>}
      </div>
      <button type="button" className="icon-button" aria-label={text.dismiss} title={text.dismiss} onClick={onDismiss}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 5 10 10M15 5 5 15" />
        </svg>
      </button>
    </div>
  );
}
