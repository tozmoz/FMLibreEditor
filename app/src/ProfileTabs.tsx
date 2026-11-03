import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { call } from "./api";
import { PlayerProfile } from "./PlayerProfile";
import { StaffProfile } from "./StaffProfile";
import { ClubProfile, type ClubTab } from "./ClubProfile";
import { useComparison } from "./useComparison";
import { askToLeave } from "./useProfileEditing";
import { describeError } from "./format";
import type { Entity, PlayerDetails, StaffDetails, ClubDetails } from "./types";

const Links = createContext<(entity: Entity, uid: number) => void>(() => {});
export function EntityLink({
  entity,
  uid,
  children,
}: {
  entity: Entity;
  uid: number | null | undefined;
  children: ReactNode;
}) {
  const open = useContext(Links);
  return uid && uid > 0 ? (
    <button
      type="button"
      className="entity-link"
      title="Open in profile tab"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        open(entity, uid);
      }}
    >
      {children}
    </button>
  ) : (
    <>{children}</>
  );
}
type Tab =
  | { key: string; entity: "player"; data: PlayerDetails }
  | { key: string; entity: "staff"; data: StaffDetails }
  | { key: string; entity: "club"; data: ClubDetails };
function ClubPage({
  data,
  version,
  onClose,
}: {
  data: ClubDetails;
  version: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ClubTab>("overview");
  return (
    <ClubProfile
      club={data}
      version={version}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
    />
  );
}
export function ProfileTabs({
  children,
  version,
  active,
  onActive,
}: {
  children: ReactNode;
  version: number;
  active: string | null;
  onActive: (key: string | null) => void;
}) {
  const request = useRef(0);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    bar.current
      ?.querySelector(".active")
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(0);
  const comparison = useComparison();
  const open = (entity: Entity, uid: number) =>
    askToLeave(() => {
      const key = `${entity}:${uid}`;
      const ticket = ++request.current;
      if (tabs.some((t) => t.key === key)) {
        onActive(key);
        return;
      }
      setLoading((n) => n + 1);
      setError(null);
      void call<PlayerDetails | StaffDetails | ClubDetails>(
        `${entity}_details`,
        { uid },
      )
        .then((data) => {
          const tab = { key, entity, data } as Tab;
          setTabs((old) =>
            old.some((t) => t.key === key) ? old : [...old, tab],
          );
          if (ticket === request.current) onActive(key);
        })
        .catch((e) => setError(describeError(e)))
        .finally(() => setLoading((n) => n - 1));
    });
  const select = (key: string | null) => {
    if (key !== active)
      askToLeave(() => {
        ++request.current;
        onActive(key);
      });
  };
  const close = (key: string, alreadyGuarded = false) => {
    const remove = () => {
      ++request.current;
      setTabs((old) => old.filter((t) => t.key !== key));
      if (active === key) {
        const index = tabs.findIndex((t) => t.key === key);
        onActive(tabs[index - 1]?.key ?? tabs[index + 1]?.key ?? null);
      }
    };
    if (active === key && !alreadyGuarded) askToLeave(remove);
    else remove();
  };
  return (
    <Links.Provider value={open}>
      {tabs.length > 0 && (
        <nav ref={bar} className="entity-tabs" aria-label="Open profiles">
          <button
            type="button"
            className={active === null ? "active" : ""}
            onClick={() => select(null)}
          >
            Browser
          </button>
          {tabs.map((tab) => (
            <div
              className={
                active === tab.key ? "entity-tab active" : "entity-tab"
              }
              key={tab.key}
            >
              <button
                type="button"
                aria-current={active === tab.key ? "page" : undefined}
                onClick={() => select(tab.key)}
              >
                {tab.data.name}
              </button>
              <button
                type="button"
                aria-label={`Close ${tab.data.name}`}
                onClick={() => close(tab.key)}
              >
                ×
              </button>
            </div>
          ))}
        </nav>
      )}
      {loading > 0 && <p role="status">Opening profile…</p>}
      {error && (
        <div className="banner" role="alert">
          {error}
        </div>
      )}
      <div className="browser-workspace" hidden={active !== null}>
        {children}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          className="entity-tab-panel"
          hidden={active !== tab.key}
        >
          {tab.entity === "player" ? (
            <PlayerProfile
              player={tab.data}
              version={version}
              onClose={() => close(tab.key, true)}
              comparison={comparison}
            />
          ) : tab.entity === "staff" ? (
            <StaffProfile
              member={tab.data}
              version={version}
              onClose={() => close(tab.key, true)}
            />
          ) : (
            <ClubPage
              data={tab.data}
              version={version}
              onClose={() => close(tab.key, true)}
            />
          )}
        </div>
      ))}
    </Links.Provider>
  );
}
