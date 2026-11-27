//! The nations' national teams, as the National teams tab shows them (#169; see docs/recon/fm27-national-teams.md).
//!
//! A national team is not a club's: no array of clubs holds it. Each nation has two containers
//! (`db::NATIONAL_TEAM_CONTAINER`), one for its men's teams and one for its women's, and each holds a list of teams that
//! are laid out as a club's ([`TeamLayout`](crate::profile::TeamLayout)), the senior team first. Two arrays in the game
//! plugin's writable data hold the 251 containers of each kind; where they are is a matter of the build, so only the
//! builds whose profile names them (`national_teams`) can show the tab, and the others say why they cannot.
//!
//! What the editor does with them: lists the containers, reads the senior team's squad and reputation, and edits the
//! reputation (through the same guarded write as a club's: see `Entity::NationalTeam`). Calling players up, the
//! captains and the manager's contract are left alone: it is not known yet what the game makes of them.

use std::collections::HashMap;

use fmlibre_mem::is_user_pointer;
use serde::Serialize;

use crate::index::{Listed, SearchIndex};
use crate::players::PlayerIndex;
use crate::profile::{NationDetailsLayout, NationalLayout};
use crate::session::Session;
use crate::squad::ClubTeam;
use crate::staff::{StaffIndex, StaffSummary};
use crate::text::read_fm_string;
use crate::transfer::{MoveError, PointerList};

/// The most national teams a container lists; the game keeps up to a dozen of the youth teams besides the senior one.
pub(crate) const MOST_TEAMS: u64 = 64;

/// The kinds of team a container holds besides its senior team (kind 0), in the order the game lists them: each can be
/// read and its reputation edited (see `docs/recon/fm27-national-teams.md`). A team of another kind is listed but left
/// alone.
pub const OTHER_KINDS: [u8; 7] = [3, 9, 33, 10, 18, 11, 12];

/// The most players a national team lists.
const MOST_PLAYERS: u64 = 256;

/// How many of the containers read must check out for the arrays to count as the game's: the share of them that
/// point at a nation that points back, with the right kind, a name and a list of teams.
const MOST_CONTAINERS_FIT: f64 = 0.95;

/// What the list shows of a nation's men's or women's team.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NationalTeamSummary {
    /// The UID of its container: the nation's for a men's team, a number of its own for a women's.
    pub uid: u32,
    /// The nation's name, in the game's language, and its three-letter code.
    pub name: String,
    pub code: Option<String>,
    pub nation_uid: u32,
    /// A women's team.
    pub women: bool,
    /// 0–10000, from the senior team; none for the one container without a senior team.
    pub reputation: Option<u16>,
    /// How many players the senior team lists.
    pub players: usize,
    #[serde(skip)]
    pub address: u64,
}

impl Listed for NationalTeamSummary {
    fn uid(&self) -> u32 {
        self.uid
    }

    fn names(&self) -> String {
        match &self.code {
            Some(code) => format!("{} {code}", self.name),
            None => self.name.clone(),
        }
    }

    fn display_name(&self) -> &str {
        &self.name
    }

    fn rank(&self) -> i32 {
        self.reputation.map_or(-1, i32::from)
    }
}

pub type NationalIndex = SearchIndex<NationalTeamSummary>;

impl NationalTeamSummary {
    /// Brings the fields a list row shows up to date after `field` was set to `value`.
    pub fn note_change(&mut self, field: &str, value: i64) {
        if field == "reputation" {
            self.reputation = Some(value as u16);
        }
    }

    pub fn target(&self) -> crate::edit::Target {
        crate::edit::Target {
            entity: crate::edit::Entity::NationalTeam,
            uid: self.uid,
            address: self.address,
            shift: 0,
        }
    }
}

/// A nation as a container leads to it: its UID, its name and its three-letter code.
type NationRead = (u32, String, Option<String>);

/// Why the editor shows no national teams.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NationalUnavailable {
    /// Nobody has found where this build of the game keeps them: its profile does not place the two arrays, or the
    /// editor has no profile for the build or was told to ignore them.
    Build,
    /// The profile places them, but what is there does not read as the game's national teams.
    Unreadable,
}

impl Session {
    /// The places of the two arrays of containers, for the builds whose profile has them and whose layout knows how a
    /// container reads.
    fn national_places(&self) -> Option<(&NationalLayout, u64, u64)> {
        let layout = self.layout.national.as_ref()?;
        let arrays = self.profile.as_ref()?.national_teams?;
        Some((layout, arrays.men, arrays.women))
    }

    /// Whether this build of the game has a place for the national teams.
    pub fn national_teams_placed(&self) -> bool {
        self.national_places().is_some()
    }

    /// Reads every nation's men's and women's team: the men's first, then the women's. Containers that do not read
    /// right are left out; when too many of them do not, the arrays are not the game's and it is an error. Only reads
    /// memory.
    pub fn national_teams(&self) -> Result<Vec<NationalTeamSummary>, NationalUnavailable> {
        let (national, men, women) = self.national_places().ok_or(NationalUnavailable::Build)?;
        let mut teams = Vec::new();
        let (mut sampled, mut fit) = (0u64, 0u64);
        let mut nations = HashMap::new();
        for (rva, woman) in [(men, false), (women, true)] {
            let pointers = self.container_pointers(rva).ok_or(NationalUnavailable::Unreadable)?;
            for container in pointers {
                sampled += 1;
                if let Some(team) = self.read_container(national, container, woman, &mut nations) {
                    fit += 1;
                    teams.push(team);
                }
            }
        }
        let holds = sampled >= 2 && fit as f64 >= MOST_CONTAINERS_FIT * sampled as f64;
        holds.then_some(teams).ok_or(NationalUnavailable::Unreadable)
    }

    /// The containers of the array whose `(begin, end)` pair is at `rva` in the game plugin; none when the pair does not
    /// hold a plausible array of pointers.
    fn container_pointers(&self, rva: u64) -> Option<Vec<u64>> {
        let begin = self.process.read_u64(self.plugin.base + rva).ok()?;
        let end = self.process.read_u64(self.plugin.base + rva + 8).ok()?;
        let count = end.checked_sub(begin)? / 8;
        if !is_user_pointer(begin) || !(1..=1_000).contains(&count) {
            return None;
        }
        let bytes = self.process.read_bytes(begin, (count * 8) as usize).ok()?;
        Some(bytes.as_chunks::<8>().0.iter().map(|chunk| u64::from_le_bytes(*chunk)).collect())
    }

    /// The team of the container at `address`, if it is a container of the kind asked for that points at a nation that
    /// points back at it.
    fn read_container(
        &self,
        national: &NationalLayout,
        address: u64,
        woman: bool,
        nations: &mut HashMap<u64, Option<NationRead>>,
    ) -> Option<NationalTeamSummary> {
        let process = &self.process;
        if !is_user_pointer(address) {
            return None;
        }
        let bytes = process.read_bytes(address, (national.container_nation + 8) as usize).ok()?;
        let u64_at = |at: u64| u64::from_le_bytes(bytes[at as usize..at as usize + 8].try_into().expect("8 bytes"));
        if (bytes[national.container_women as usize] == 1) != woman || bytes[national.container_women as usize] > 1 {
            return None;
        }
        let uid = u32::from_le_bytes(bytes[national.container_uid as usize..][..4].try_into().expect("4 bytes"));
        let nation = u64_at(national.container_nation);
        let (nation_uid, name, code) =
            nations.entry(nation).or_insert_with(|| self.read_nation(national, nation)).clone()?;
        // The nation points back at the container.
        let back = if woman { national.nation_women } else { national.nation_men };
        if process.read_u64(nation + back).ok()? != address {
            return None;
        }
        let (reputation, players) = match self.senior_team_of(national, address, &bytes) {
            Some((team, players)) => (Some(team), players),
            None => (None, 0),
        };
        // A container with no teams at all is not one the game plays with.
        PointerList::read(process, address + national.container_teams).ok().flatten()?;
        Some(NationalTeamSummary { uid, name, code, nation_uid, women: woman, reputation, players, address })
    }

    /// The UID, name and code of the nation at `nation`.
    fn read_nation(&self, national: &NationalLayout, nation: u64) -> Option<NationRead> {
        if !is_user_pointer(nation) {
            return None;
        }
        let n = &self.layout.nation;
        let uid = self.process.read_u32(nation + n.uid).ok()?;
        let name = read_fm_string(&self.process, self.process.read_u64(nation + n.name).ok()?)?;
        let code =
            self.process.read_u64(nation + national.nation_code).ok().and_then(|at| read_fm_string(&self.process, at));
        Some((uid, name, code))
    }

    /// The senior team of the container at `container`, whose bytes are `bytes`: its reputation and how many players it
    /// lists. It is the first of the container's teams, of kind 0, and points back at the container.
    fn senior_team_of(&self, national: &NationalLayout, container: u64, bytes: &[u8]) -> Option<(u16, usize)> {
        let team = self.national_senior_team(national, container, bytes)?;
        let t = &self.layout.team;
        let head = self.process.read_bytes(team, t.end() as usize).ok()?;
        let reputation = u16::from_le_bytes([head[t.reputation as usize], head[t.reputation as usize + 1]]);
        // A team that lists no players has a list of three zeros, with no buffer yet.
        let players = if self.process.read_bytes(team + t.players, 24).ok()?.iter().all(|&byte| byte == 0) {
            0
        } else {
            PointerList::read_up_to(&self.process, team + t.players, MOST_PLAYERS).ok().flatten()?.len()
        };
        (reputation <= 10_000).then_some((reputation, players as usize))
    }

    /// The address of the senior team of the container at `container`, if it has one: the first of its teams, of kind 0,
    /// which points back at the container.
    fn national_senior_team(&self, national: &NationalLayout, container: u64, bytes: &[u8]) -> Option<u64> {
        let at = national.container_teams as usize;
        let begin = u64::from_le_bytes(bytes[at..at + 8].try_into().expect("8 bytes"));
        let end = u64::from_le_bytes(bytes[at + 8..at + 16].try_into().expect("8 bytes"));
        if !is_user_pointer(begin) || end <= begin || (end - begin) / 8 > MOST_TEAMS {
            return None;
        }
        let team = self.process.read_u64(begin).ok()?;
        let t = &self.layout.team;
        let belongs = is_user_pointer(team)
            && self.process.read_u64(team + t.club).ok()? == container
            && self.process.read_bytes(team + t.kind, 1).ok()? == [0];
        belongs.then_some(team)
    }

    /// The teams of the nation's team `team`, read now: the senior team and its youth teams, in the order the container
    /// lists them. Teams that do not point back at the container, or whose kind another of its teams has too, are left
    /// out: a team is told apart by its kind (see `team_of_kind`).
    pub fn national_sides(&self, team: &NationalTeamSummary) -> Result<Vec<NationalSide>, MoveError> {
        let national = self.layout.national.as_ref().ok_or(MoveError::NotAClub { uid: team.uid })?;
        self.check_container(national, team)?;
        let Some(list) = PointerList::read_up_to(&self.process, team.address + national.container_teams, MOST_TEAMS)?
        else {
            return Ok(Vec::new());
        };
        let t = &self.layout.team;
        let mut sides = Vec::new();
        for (index, object) in list.elements(&self.process)?.into_iter().enumerate() {
            if !is_user_pointer(object) {
                continue;
            }
            let Ok(head) = self.process.read_bytes(object, t.end() as usize) else {
                continue;
            };
            let club = u64::from_le_bytes(head[t.club as usize..][..8].try_into().expect("8 bytes"));
            let reputation = u16::from_le_bytes([head[t.reputation as usize], head[t.reputation as usize + 1]]);
            if club != team.address || reputation > 10_000 {
                continue;
            }
            let age_limit = head[t.age_limit as usize];
            let players = if head[t.players as usize..][..24].iter().all(|&byte| byte == 0) {
                0
            } else {
                PointerList::read_up_to(&self.process, object + t.players, MOST_PLAYERS)?
                    .map_or(0, |list| list.len() as usize)
            };
            sides.push(NationalSide {
                index,
                kind: head[t.kind as usize],
                age_limit: (age_limit < NO_AGE_LIMIT).then_some(age_limit),
                reputation,
                players,
                address: object,
            });
        }
        // A senior team is the first one (a container may have none); a kind two teams share names neither.
        sides.retain(|side| side.kind != SENIOR_KIND || side.index == 0);
        let kinds: Vec<u8> = sides.iter().map(|side| side.kind).collect();
        sides.retain(|side| kinds.iter().filter(|&&kind| kind == side.kind).count() == 1);
        Ok(sides)
    }

    /// The team of kind `kind` of the nation's team `team` with its players, read now: the players the game lists for it
    /// (see `docs/recon/fm27-national-teams.md`), told apart by `players`, as the squad of a club's team is. Kind 0 is
    /// the senior team. Captains are not read: where the game shows them is not known.
    pub fn national_squad(
        &self,
        team: &NationalTeamSummary,
        kind: u8,
        players: &PlayerIndex,
    ) -> Result<ClubTeam, MoveError> {
        let not_a_team = || MoveError::NotAClub { uid: team.uid };
        let side = self.national_sides(team)?.into_iter().find(|side| side.kind == kind).ok_or_else(not_a_team)?;
        let t = &self.layout.team;
        let elements = match PointerList::read_up_to(&self.process, side.address + t.players, MOST_PLAYERS)? {
            Some(list) => list.elements(&self.process)?,
            None => Vec::new(),
        };
        Ok(ClubTeam {
            index: side.index,
            kind: side.kind,
            age_limit: side.age_limit,
            captain: None,
            vice_captain: None,
            players: elements
                .into_iter()
                .filter_map(|element| self.squad_member(None, side.address, element, players))
                .collect(),
        })
    }

    /// What the profile of the nation's team `team` shows of its nation and federation, read now: the year the
    /// federation was founded, the nation's continent, and the federation's staff, as the game's staff list of the
    /// nation's team shows them: each team's manager and the staff of the container's departments, each a member of
    /// staff the index has at that address, with his job in the team his contract with the federation is with. `None`
    /// where the layout has not placed them. Only reads memory.
    pub fn nation_details(
        &self,
        team: &NationalTeamSummary,
        staff: &StaffIndex,
    ) -> Result<Option<NationDetails>, MoveError> {
        let Some(national) = self.layout.national.as_ref() else {
            return Ok(None);
        };
        let Some(d) = national.details.as_ref() else {
            return Ok(None);
        };
        self.check_container(national, team)?;
        let process = &self.process;
        let container = team.address;
        let founded = process.read_bytes(container + d.founded, 2)?;
        let founded = u16::from_le_bytes([founded[0], founded[1]]);
        let nation = process.read_u64(container + national.container_nation)?;
        let continent = is_user_pointer(nation)
            .then(|| process.read_u64(nation + d.continent).ok())
            .flatten()
            .filter(|&continent| is_user_pointer(continent))
            .and_then(|continent| process.read_u64(continent + d.continent_name).ok())
            .and_then(|name| read_fm_string(process, name));

        // The teams' managers first, in the order the container lists the teams, then the departments.
        let sides = self.national_sides(team)?;
        let mut objects = Vec::new();
        if let Some(manager) = self.layout.team.manager {
            for side in &sides {
                objects.push(process.read_u64(side.address + manager)?);
            }
        }
        for at in [d.coaching_staff, d.medical_staff, d.scouting_staff] {
            if let Some(list) = PointerList::read_up_to(process, container + at, MOST_STAFF)? {
                objects.extend(list.elements(process)?);
            }
        }
        let mut members: Vec<FederationMember> = Vec::new();
        for object in objects {
            let Some(member) = self.staff_at(object, staff) else { continue };
            if members.iter().any(|known| known.member.uid == member.uid) {
                continue;
            }
            let (job, team_kind) = match self.national_contract(d, object, member.shift) {
                Some((team, job)) => match sides.iter().find(|side| side.address == team) {
                    Some(side) => (Some(job), Some(side.kind)),
                    None => (None, None),
                },
                None => (None, None),
            };
            members.push(FederationMember { member, job, team_kind });
        }
        // Grouped by team, in the container's order; within one, as read. Those whose team was not found come last.
        members.sort_by_key(|known| {
            known.team_kind.and_then(|kind| sides.iter().position(|side| side.kind == kind)).unwrap_or(usize::MAX)
        });
        Ok(Some(NationDetails { founded: (founded > 0).then_some(founded), continent, staff: members }))
    }

    /// The member of staff whose object is at `object`, if the index has him at that address.
    fn staff_at(&self, object: u64, staff: &StaffIndex) -> Option<StaffSummary> {
        if !is_user_pointer(object) {
            return None;
        }
        let s = &self.layout.staff;
        let shift = crate::staff::person_shift(&self.process, s, object);
        let uid = self.process.read_u32(object + s.at(s.uid, shift)).ok()?;
        staff.get(uid).filter(|member| member.address == object).cloned()
    }

    /// The team the contract of the member of staff at `object` with a federation is with, and his job there; none
    /// when he has no such contract or it does not point back at him.
    fn national_contract(&self, d: &NationDetailsLayout, object: u64, shift: u64) -> Option<(u64, u8)> {
        let process = &self.process;
        let s = &self.layout.staff;
        let c = &self.layout.contract;
        let record = process.read_u64(object + s.at(d.staff_contracts, shift)).ok()?;
        let contract = is_user_pointer(record).then(|| process.read_u64(record + d.national_contract).ok())??;
        if !is_user_pointer(contract) {
            return None;
        }
        // Only as far as a db::BASIC_CONTRACT goes, which ends after the job.
        let bytes = process.read_bytes(contract, ((c.owner.max(c.team) + 8).max(c.job + 1)) as usize).ok()?;
        let u64_at = |at: u64| u64::from_le_bytes(bytes[at as usize..][..8].try_into().expect("8 bytes"));
        // A contract's owner is the identity block of its member of staff.
        let owner = u64_at(c.owner);
        (owner == object + s.at(s.identity(), shift)).then(|| (u64_at(c.team), bytes[c.job as usize]))
    }

    /// Checks that the container of `team` still carries its UID.
    fn check_container(&self, national: &NationalLayout, team: &NationalTeamSummary) -> Result<(), MoveError> {
        if self.process.read_u32(team.address + national.container_uid)? != team.uid {
            return Err(MoveError::NotAClub { uid: team.uid });
        }
        Ok(())
    }
}

/// The most members of staff a federation's department lists.
const MOST_STAFF: u64 = 256;

/// What a national team's profile shows of its nation and federation (see `docs/recon/fm27-national-teams.md`), as the
/// game's nation page and staff list show it. The federation's staff are those of the men's or the women's container.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NationDetails {
    /// The year its federation was founded; none where the game has none.
    pub founded: Option<u16>,
    /// The continent's name, in the game's language; none for a nation of the past and some others.
    pub continent: Option<String>,
    /// Grouped by team, in the order the container lists its teams.
    pub staff: Vec<FederationMember>,
}

/// A member of a federation's staff, with what his contract with it says.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FederationMember {
    pub member: StaffSummary,
    /// His job in the national team, as an FM job code (see [`job_name`](crate::staff::job_name)); not the job of his
    /// contract with a club, which `member` has.
    pub job: Option<u8>,
    /// The kind of the team of the container his contract is with (see [`NationalSide::kind`]).
    pub team_kind: Option<u8>,
}

/// The kind of a nation's senior team, the first of its container's teams.
pub const SENIOR_KIND: u8 = 0;

/// The age limit of a team without one; the game also gives some 255.
const NO_AGE_LIMIT: u8 = 100;

/// One of the teams of a nation's men's or women's container: its senior team or one of its youth teams.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NationalSide {
    /// Where it is in the container's list; 0 is the senior team.
    pub index: usize,
    /// The game's code for the kind of team: 0 for the senior team, 10 for the under-21s (see
    /// `docs/recon/fm27-national-teams.md`). No two teams of a container share one.
    pub kind: u8,
    /// The oldest its players may be; `None` for a team without a limit.
    pub age_limit: Option<u8>,
    /// 0–10000.
    pub reputation: u16,
    /// How many players it lists.
    pub players: usize,
    #[serde(skip)]
    pub address: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary(name: &str, code: Option<&str>, reputation: Option<u16>) -> NationalTeamSummary {
        NationalTeamSummary {
            uid: 1,
            name: name.to_owned(),
            code: code.map(str::to_owned),
            nation_uid: 1,
            women: false,
            reputation,
            players: 0,
            address: 0,
        }
    }

    #[test]
    fn a_team_is_found_by_its_nation_s_name_or_code() {
        let index = NationalIndex::new(vec![
            summary("Italia", Some("ITA"), Some(8500)),
            summary("San Marino", Some("SMR"), Some(1200)),
            summary("Svizzera", Some("SUI"), None),
        ]);
        let names = |query: &str| index.search(query).iter().map(|team| team.name.clone()).collect::<Vec<_>>();
        assert_eq!(names("smr"), ["San Marino"]);
        assert_eq!(names("ital"), ["Italia"]);
        // The best known first, one with no senior team last.
        assert_eq!(names(""), ["Italia", "San Marino", "Svizzera"]);
    }

    #[test]
    fn the_reputations_the_youth_rating_and_the_settings_are_the_fields_and_follow_the_layout() {
        // Both layouts place national teams, the Mac's and the Windows one.
        let layout = crate::layout_for(27).expect("FM27 layout");
        let national = layout.national.as_ref().expect("national teams");
        let fields = crate::fields(&layout, crate::Entity::NationalTeam);
        let keys: Vec<&str> = fields.iter().map(|field| field.key.as_str()).collect();
        let reputations = [
            "reputation",
            "team.3.reputation",
            "team.9.reputation",
            "team.33.reputation",
            "team.10.reputation",
            "team.18.reputation",
            "team.11.reputation",
            "team.12.reputation",
        ];
        let settings = [
            ("game_importance", 1, 4),
            ("fa_financial_power", 0, 20),
            ("fa_patience", 0, 20),
            ("attendance", 0, 250_000),
            ("min_attendance", 0, 250_000),
            ("max_attendance", 0, 250_000),
            ("economic_factor", 0, 20),
            ("state_of_development", 1, 3),
        ];
        let mut expected: Vec<&str> = reputations.to_vec();
        if national.youth_rating.is_some() {
            expected.push(crate::YOUTH_RATING);
        }
        if national.game_importance.is_some() {
            expected.extend(settings.iter().map(|(key, _, _)| *key));
        }
        assert_eq!(keys, expected);
        let (reputation_fields, rest) = fields.split_at(reputations.len());
        assert!(reputation_fields.iter().all(|field| field.takes(10_000) && !field.takes(10_001)));
        // The youth rating of a container of either kind, men's or women's: every national team has one.
        let youth = rest.iter().find(|field| field.key == crate::YOUTH_RATING);
        if let Some(youth) = youth {
            assert!(youth.takes(0) && youth.takes(200) && !youth.takes(201) && !youth.mass);
        }
        let (setting_fields, _) = rest.split_at(usize::from(youth.is_some()));
        assert!(setting_fields.iter().all(|field| !field.mass));
        for (key, min, max) in settings {
            let Some(field) = fields.iter().find(|field| field.key == key) else {
                continue;
            };
            assert!(field.takes(min) && field.takes(max) && !field.takes(max + 1), "{key}");
            assert!(field.is_plausible(0) && !field.is_plausible(10_000_001), "{key}");
        }
        if national.game_importance.is_some() {
            let choices = |key: &str| fields.iter().find(|field| field.key == key).unwrap().choices.clone().unwrap();
            assert_eq!(choices("game_importance"), [1, 2, 3, 4]);
            assert_eq!(choices("state_of_development"), [1, 2, 3]);
        }
        // The senior team's kind is not among the others.
        assert!(!OTHER_KINDS.contains(&SENIOR_KIND));
    }

    /// The builds the national teams were read on, and the Epic build of 27.1.0, which keeps them where its Steam twin
    /// does (see `profile.rs`).
    #[test]
    fn only_the_builds_read_place_the_national_teams() {
        let placed: Vec<String> = crate::profile::built_in_profiles()
            .filter(|profile| profile.national_teams.is_some())
            .map(|profile| profile.name)
            .collect();
        assert_eq!(
            placed,
            [
                "FM27 0.9.2435.0 (Game Pass)",
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26577676",
                "FM27 Steam build 26620374",
                "FM27 Steam build 26797085",
                "FM27 Steam build 26385295 (27.0.1, macOS, Apple silicon)",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085 (macOS, Apple silicon)",
                "FM27 (Epic Games Store)"
            ]
        );
    }
}
