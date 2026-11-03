import React, { useState, act } from "react";
import { createRoot } from "react-dom/client";
import { ProfileTabs, EntityLink } from "../src/ProfileTabs";
import { call } from "../src/api";
import { EditorContext } from "../src/useProfileEditing";
export { act, createRoot, React };
export async function fixtures() {
  return {
    players: await call<any>("search_players", { limit: 12 }),
    staff: await call<any>("search_staff", { limit: 1 }),
    clubs: await call<any>("search_clubs", { limit: 1 }),
  };
}
export function Harness({ players, staff, clubs }: any) {
  const [active, onActive] = useState<string | null>(null);
  return (
    <EditorContext.Provider
      value={{ editable: true, readOnlyNote: "", onEdited: () => {} }}
    >
      <ProfileTabs active={active} onActive={onActive} version={1}>
        <div data-testid="test-browser">
          {players.rows.map((p: any) => (
            <EntityLink key={p.uid} entity="player" uid={p.uid}>
              {p.name}
            </EntityLink>
          ))}
          <EntityLink entity="staff" uid={staff.rows[0].uid}>
            Test staff
          </EntityLink>
          <EntityLink entity="club" uid={clubs.rows[0].uid}>
            Test club
          </EntityLink>
        </div>
      </ProfileTabs>
    </EditorContext.Provider>
  );
}
