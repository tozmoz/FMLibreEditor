use std::collections::BTreeMap;
use std::fmt;

use fmlibre_mem::{Module, Process};
use serde::{Deserialize, Deserializer};

use crate::game::Storefront;
use crate::tree::Tree;

/// Field offsets inside FM's objects for one edition. They are shared by every
/// storefront build of the same game version, unlike the RVAs in [`BuildProfile`].
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Layout {
    pub edition: u32,
    pub player: PlayerLayout,
    pub contract: ContractLayout,
    pub cluster: ClusterLayout,
    pub staff: StaffLayout,
    pub team: TeamLayout,
    pub club: ClubLayout,
    pub club_info: ClubInfoLayout,
    pub club_finance: ClubFinanceLayout,
    pub nation: NationLayout,
    /// A city, such as a player's city of birth; only in the layouts it has been checked in.
    #[serde(default)]
    pub city: Option<CityLayout>,
    pub injury: InjuryLayout,
    pub ban: BanLayout,
    pub relation: RelationLayout,
    pub heap: HeapLayout,
    /// A club's stadium; only in the layouts it has been checked in.
    #[serde(default)]
    pub stadium: Option<StadiumLayout>,
    /// The retirements the game has planned; only in the layouts they have been checked in.
    #[serde(default)]
    pub retirement: Option<RetirementLayout>,
    /// What a human manager has picked for his club; only in the layouts it has been checked in.
    #[serde(default)]
    pub selection: Option<SelectionLayout>,
    /// The tactic a selection plays; only in the layouts it has been checked in.
    #[serde(default)]
    pub tactic: Option<TacticLayout>,
    /// The tactics each human manager keeps for each of his teams; only in the layouts they have been checked in.
    #[serde(default)]
    pub tactics: Option<TacticsLayout>,
    /// How well players know a tactic, and the history of training the game keeps for it; only in the layouts it has
    /// been checked in.
    #[serde(default)]
    pub familiarity: Option<FamiliarityLayout>,
    /// Where a player on loan keeps his loan contract; only in the layouts it has been checked in.
    #[serde(default)]
    pub loan: Option<LoanLayout>,
    /// How one of the game's pools of objects keeps its slots (see `object_pool.rs`); only in the layouts it has been
    /// checked in.
    #[serde(default)]
    pub pool: Option<PoolLayout>,
    /// The game's own object, which counts the saves it has loaded; only in the layouts it has been checked in.
    #[serde(default)]
    pub game: Option<GameLayout>,
    /// A player's cohesion with each club (see `cohesion.rs`); only in the layouts it has been checked in.
    #[serde(default)]
    pub cohesion: Option<CohesionLayout>,
    /// Who a reason to be unhappy is about (see `concerns.rs`); only in the layouts it has been checked in.
    #[serde(default)]
    pub concern: Option<ConcernLayout>,
    /// A competition; only in the layouts it has been checked in.
    #[serde(default)]
    pub competition: Option<CompetitionLayout>,
    /// The prize money a competition's stages pay (see `prize_money.rs`); only in the layouts it has been checked in.
    #[serde(default)]
    pub prize_money: Option<PrizeMoneyLayout>,
    /// The sponsorship deals a club holds (see `sponsorship.rs`); only in the layouts they have been checked in.
    #[serde(default)]
    pub sponsorship: Option<SponsorshipLayout>,
    /// The game's tables of first, last and common names (see `names.rs`); only in the layouts they have been checked
    /// in.
    #[serde(default)]
    pub names: Option<NamesLayout>,
    /// The nations' national teams (see `national.rs`); only in the layouts they have been checked in.
    #[serde(default)]
    pub national: Option<NationalLayout>,
    /// The game's transfers and a move agreed for a later day (see `arranged.rs`); only in the layouts they have been
    /// checked in.
    #[serde(default)]
    pub transfers: Option<TransfersLayout>,
    /// The rules a competition's squads are registered under (see `rules.rs`); only in the layouts they have been
    /// checked in.
    #[serde(default)]
    pub rules: Option<RulesLayout>,
}

/// Where the game keeps the rules a competition's squads are registered under (see `rules.rs` and
/// docs/recon/fm27-league-rules.md): the lists it checks a squad against, one for this season and one for the next,
/// and the records of the nation's rule files it makes those lists from.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RulesLayout {
    /// The class of the object the game keeps for a competition as it is played, as written in C++; and in it: the
    /// pointer to its `db::COMP`, its own rules as a record, and the pointer to its rule group.
    pub competition_class: String,
    pub competition_db: u64,
    pub competition_record: u64,
    pub competition_group: u64,
    /// In a `db::COMP`: the pointer back to that object.
    pub db_competition: u64,
    /// In a rule group: the pointer to its nation's rules as the game plays by them; and in those, the `(begin, end,
    /// capacity)` of pointers to its fixture rules, which a competition's record names one of by its place.
    pub group_nation_rules: u64,
    pub nation_fixture_rules: u64,
    /// In fixture rules: the pointer to those of the next season, and the pointer to the list `(begin, end, capacity)`
    /// of pointers to its squad rules.
    pub fixture_next: u64,
    pub fixture_squad_rules: u64,
    /// In a set of fixture rules, the `(begin, end)` of a table of pointers to the days squads are registered by, for
    /// the competitions that have such days (UEFA's), most of its places empty. An entry's size, and in it the UID
    /// of its competition, the key that marks it and the `u8` of the most players a squad may register by that day.
    pub fixture_registration: u64,
    pub registration_size: u64,
    pub registration_competition: u64,
    pub registration_key: u64,
    pub registration_most: u64,
    /// A squad rule: its size, and in it the `u32` key of its condition (0 for none), the `u32` UID of the competition
    /// the condition names, the `i32` value, the `u16` kind and the `i8` that says which way it limits (-1 at most, 1
    /// at least).
    pub rule_size: u64,
    pub rule_condition: u64,
    pub rule_competition: u64,
    pub rule_value: u64,
    pub rule_kind: u64,
    pub rule_compare: u64,
    /// In the container of a nation's men's teams: the record its rule files make together, and after it the list of
    /// the records of the files themselves.
    pub container_rules: u64,
    pub container_files: u64,
    /// The name of one kind of squad rule, by which the game's table of all of them is found in the plugin.
    pub kind_anchor: String,
}

/// How the game keeps its transfers and a move agreed for a later day (see `arranged.rs` and
/// docs/recon/fm27-transfers.md): the transfer manager, found by its class, holds the list of offers and the list of
/// the moves due on a day; an agreed offer names the player and the clubs, the fee and the day of the move; the contract
/// he is to have is held by an entry that the player's record of entries lists, as his record of offers lists the
/// offer's number.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransfersLayout {
    /// The transfer manager's class, as written in C++, and in it: its list of offers, its list of the moves due on a
    /// day, and the flag it raises while one is due.
    pub manager_class: String,
    pub offers: u64,
    pub due: u64,
    pub due_flag: u64,
    /// An offer's class and size, and its fields.
    pub offer_class: String,
    pub offer_size: u64,
    pub offer_one: u64,
    pub offer_flags: u64,
    pub offer_person: u64,
    pub offer_buyer: u64,
    pub offer_buyer_again: u64,
    pub offer_seller: u64,
    pub offer_fee: u64,
    pub offer_number: u64,
    pub offer_count: u64,
    pub offer_unset: Vec<u64>,
    pub offer_accepted: u64,
    pub offer_moved: u64,
    pub offer_made: u64,
    pub offer_lapses: u64,
    pub offer_move_day: u64,
    pub offer_later: u64,
    pub offer_state: u64,
    /// u8: the kind of the transfer: 2 one with a fee (the kind its entry has too), 8 a free move at the end of a
    /// contract (entries of kind 7), 1 most loans.
    pub offer_kind: u64,
    pub offer_payment: u64,
    /// An entry of a contract not yet in force: its size and fields.
    pub entry_size: u64,
    pub entry_one: u64,
    pub entry_contract: u64,
    pub entry_number: u64,
    pub entry_no_amount: u64,
    pub entry_date: u64,
    pub entry_state: u64,
    pub entry_one_again: u64,
    pub entry_agreed: u64,
    pub entry_kind: u64,
    /// A move due on a day: its size, and where it keeps the person block, the day and the offer's number.
    pub due_size: u64,
    pub due_person: u64,
    pub due_day: u64,
    pub due_number: u64,
    /// In a player (shifted like the person block): pointers to his record of offers' numbers and to his record of
    /// entries; and how large a record is.
    pub player_offer_numbers: u64,
    pub player_entries: u64,
    pub record_size: u64,
    /// How the game keeps a loan agreed for a later day; none where it has not been read.
    #[serde(default)]
    pub loan: Option<LoanOfferLayout>,
}

/// A loan agreed for a later day (see `arranged.rs`): an offer of a class of its own, laid out as a transfer offer up to
/// its state and kind ([`TransfersLayout`]; its fee is the monthly fee, and it has no `offer_payment`), with the loan's
/// terms after them; and the contract the player is to have at the club he joins, a loan contract ([`LoanLayout`] and
/// [`LoanTermsLayout`] place its terms).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoanOfferLayout {
    /// The offer's class, as written in C++, and its size.
    pub offer_class: String,
    pub offer_size: u64,
    /// Pointers, and lists of them, that the offer may hold (its add-ons among them), left empty in the one the editor
    /// makes: 8 bytes each.
    pub offer_cleared: Vec<u64>,
    /// `u32` flags, as the loan contract's ([`LoanTermsLayout::flags`]).
    pub offer_flags: u64,
    /// `i32` pounds a week: the part of his wage the club he joins pays, in each place that holds it.
    pub offer_wage: Vec<u64>,
    /// `i32` pounds: the monthly fee when he is not used, and the future fee (-1 for none).
    pub offer_unused_fee: u64,
    pub offer_option_fee: u64,
    /// `u8`, in the offer and in the loan contract, which the game copies it to: the kind of the future fee, 0xFF where
    /// there is none and 0xFE for an option the club he joins may take up; a mandatory fee holds others.
    pub offer_fee_kind: u64,
    pub contract_fee_kind: u64,
    /// `i32` places that hold -1 where there is no such term.
    pub offer_unset: Vec<u64>,
    /// Places not known, and what most of the game's loan offers hold there: `u8` places and their values, and places of
    /// 8 bytes of zero. A model that holds the same is the better one.
    pub offer_usual: Vec<(u64, u8)>,
    pub offer_usual_zero: Vec<u64>,
    /// `u16`: the part of his wage the club he joins pays, in percent, in each place that holds it.
    pub offer_share: Vec<u64>,
    /// `u32`: how long the loan runs, in the offer and in the loan contract: until the end of the season, or until a day
    /// of its own, which the loan contract's end holds.
    pub offer_length: u64,
    pub contract_length: u64,
    /// The loan contract's size.
    pub contract_size: u64,
    /// `u8`: the squad status again.
    pub contract_status_again: u64,
    /// `i32`: the wage again.
    pub contract_wage_again: u64,
    /// Pointers the loan contract may hold (its add-ons, its reasons to be unhappy), left empty in the one the editor
    /// makes: 8 bytes each.
    pub contract_cleared: Vec<u64>,
    /// `i32` places that hold -1, and `u32` places that hold 0, in every loan contract not yet in force.
    pub contract_unset: Vec<u64>,
    pub contract_zero: Vec<u64>,
}

/// How the game keeps a nation's national teams (see `national.rs`): each nation has two containers, one for its men's
/// teams and one for its women's, whose teams are laid out as a club's ([`TeamLayout`]), with the container where a
/// club's team points at its club.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NationalLayout {
    /// In a container: its `u32` UID, the teams as `(begin, end, capacity)` of pointers with the senior team first, a
    /// `u8` that is 1 for a women's container, and the pointer back to its nation.
    pub container_uid: u64,
    pub container_teams: u64,
    pub container_women: u64,
    pub container_nation: u64,
    /// In a nation: its three-letter code as an FM string pointer, and the pointers to its men's and women's container.
    pub nation_code: u64,
    pub nation_men: u64,
    pub nation_women: u64,
    /// In a container: the `u16` youth rating of the nation's men's or women's football, as the pre-game editor shows
    /// it, and the second copy the game keeps of it, equal to it at every container read. Unset where nobody has read
    /// them, and the field is then not offered.
    #[serde(default)]
    pub youth_rating: Option<u64>,
    #[serde(default)]
    pub youth_rating_copy: Option<u64>,
    /// In a container, the men's or the women's: the `u8` game importance and the federation's `u8` financial power,
    /// each with a second copy right after it, equal to it at every container read. Unset where nobody has read them, and
    /// the fields are then not offered.
    #[serde(default)]
    pub game_importance: Option<u64>,
    #[serde(default)]
    pub game_importance_copy: Option<u64>,
    #[serde(default)]
    pub fa_financial_power: Option<u64>,
    #[serde(default)]
    pub fa_financial_power_copy: Option<u64>,
    /// In a container, the men's or the women's: the `u8` patience of the federation, from 0 to 20.
    #[serde(default)]
    pub fa_patience: Option<u64>,
    /// In a container: the pointer to its own record of its nation's attendance, and in the record the `u32` attendance
    /// of its matches with the `u32` least and most it may be.
    #[serde(default)]
    pub container_record: Option<u64>,
    #[serde(default)]
    pub attendance: Option<u64>,
    #[serde(default)]
    pub min_attendance: Option<u64>,
    #[serde(default)]
    pub max_attendance: Option<u64>,
    /// In a nation: its `u8` economic factor and its `u8` state of development, which its men's and women's teams share.
    #[serde(default)]
    pub economic_factor: Option<u64>,
    #[serde(default)]
    pub state_of_development: Option<u64>,
    /// What a national team's profile shows of its nation and federation; unset where nobody has read it, and the
    /// profile then shows none of it.
    #[serde(default)]
    pub details: Option<NationDetailsLayout>,
}

/// Where the game keeps what a national team's profile shows of its nation and federation (see `national.rs`): some of
/// it in the container of its men's or women's teams, the continent in the nation, and each member of the federation's
/// staff's job in his contract with one of its teams.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NationDetailsLayout {
    /// In a container: the `u16` year its federation was founded (0 where the game has none), and the federation's
    /// medical, coaching and scouting staff, each as `(begin, end, capacity)` of pointers to staff objects, as a club
    /// keeps them. The teams' managers are not in them: each team points at its own (`TeamLayout::manager`).
    pub founded: u64,
    pub medical_staff: u64,
    pub coaching_staff: u64,
    pub scouting_staff: u64,
    /// In a nation: the pointer to its continent (`db::CONTINENT`), and there the FM string pointer to its name.
    pub continent: u64,
    pub continent_name: u64,
    /// In a staff object: the pointer to the record of his other contracts, and in that record the pointer to his
    /// contract with one of a federation's teams, laid out as his contract with a club (`ContractLayout`).
    pub staff_contracts: u64,
    pub national_contract: u64,
}

/// The game's tables of first, last and common names (see `names.rs`): where it keeps the list of each table's entries
/// by id, and what an entry holds after its text, an FM string pointer at its start.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NamesLayout {
    /// How far before the players' list (`ArrayRvas::players`) the game plugin keeps a pointer to the `(begin, end,
    /// capacity)` of each table's list of entries by id: first, last and common names.
    pub lists_before_players: [u64; 3],
    /// The size of an entry, and in it the `u32` id (its place in the list by id), the `u16` nation it was made for and
    /// the `u16` weight the game picks it by for a new person.
    pub entry_size: u64,
    pub id: u64,
    pub nation: u64,
    pub weight: u64,
}

/// What an entry of a player's reasons to be unhappy says besides its dates, motive and kind (see `concerns.rs`): the
/// category its motive belongs to and, in the reasons held about a teammate, who he is, by the id the game gives the
/// person. The id is -1 in an entry that holds none; in the other categories the same place holds something else.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ConcernLayout {
    /// In an entry: the `i32` id of the person it is about (`player_person`).
    pub about: u64,
    /// In an entry: the `u8` category of its motive.
    pub category: u64,
    /// In an entry: the `i16` the game picks the sentence of some motives by (see [`crate::details::Concern`]).
    pub wording: u64,
    /// In an entry: a `u8` of flags; with its high bit set, the game words a motive of category 8 as unhappiness with
    /// how the talks on a new contract are going.
    pub flags: u64,
    /// In a player: the `u32` id the game gives the person.
    pub player_person: u64,
}

/// The game's one object of its class (`game_plugin::GAME_UI` in FM27), made when the game starts and kept until it
/// quits, which a static of the game plugin points at: each build profile places it ([`BuildProfile::game_ui`]). It
/// counts the saves the game has loaded since it started, which tells the editor when the game has loaded a save since
/// the editor read its lists: a save leaves the count as it is.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GameLayout {
    /// Its class, as written in C++, which tells it apart.
    pub class: String,
    /// The `u64` count of the saves the game has loaded since it started.
    pub loads: u64,
}

/// A player's cohesion entries: the second list of the record his `relations` pointer leads to, after his ties (see
/// [`RelationLayout`]).
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CohesionLayout {
    /// Where the list `(begin, end, capacity)` starts in the record.
    pub list: u64,
    /// Bytes per entry.
    pub size: u64,
    /// `i32`: the index of the club or nation the entry is for.
    pub index: u64,
    /// `u8`: what the entry is for, 1 a club and 2 a nation.
    pub kind: u64,
    /// `i8`: the cohesion, 1..100.
    pub value: u64,
    /// `i32` in the club object: the index its entries name it by.
    pub club_index: u64,
}

/// A competition (`db::COMP`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CompetitionLayout {
    /// `u32`.
    pub uid: u64,
    /// FM string pointers, to names in the game's language.
    pub name: u64,
    pub short_name: u64,
    /// Pointer to the nation whose competition it is (England for the Premier League); unset where the layout has
    /// not placed it.
    #[serde(default)]
    pub nation: Option<u64>,
}

/// The prize money a competition's stages pay, which their settings hold (see `prize_money.rs`).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PrizeMoneyLayout {
    /// The classes, as written in C++: a stage played as a league, a stage that has not started yet, and a league's
    /// settings.
    pub stage: String,
    pub future_stage: String,
    pub settings: String,
    /// In either kind of stage: the pointer to its competition.
    pub competition: u64,
    /// In a stage played as a league, and in one that has not started yet: the pointer to its settings.
    pub stage_settings: u64,
    pub future_settings: u64,
    /// In the settings: a list `(begin, end, capacity)` of `u32` amounts in pounds by final position, the first
    /// place first.
    pub by_position: u64,
    /// In the settings: `u32` amounts in pounds per win (kept twice), per draw and per loss.
    pub win: u64,
    pub win_again: u64,
    pub draw: u64,
    pub loss: u64,
}

/// The sponsorship deals a club holds (see `sponsorship.rs`): the club points at a `(begin, end, capacity)` record whose
/// list holds one pointer per deal, and each pointer leads to an entry of `entry_size` bytes.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SponsorshipLayout {
    /// In the club: the pointer to the record that holds the list of deals.
    pub club_list: u64,
    /// The size of an entry.
    pub entry_size: u64,
    /// In an entry: the start and the end date, each a `u16` day of the year and a `u16` year.
    pub start: u64,
    pub end: u64,
    /// In an entry: `u32` pounds, the total value of the deal and the amount per season.
    pub total: u64,
    pub per_season: u64,
    /// In an entry: a `u16` percentage, by which the deal falls on relegation (or, for a kit manufacturer, rises on a
    /// promotion to the top division).
    pub percent: u64,
    /// In an entry: a `u16`, the club's reputation when the deal was signed.
    pub reputation: u64,
    /// In an entry: a `u8` kind, which the game names in its Sponsorship screen.
    pub kind: u64,
}

impl SponsorshipLayout {
    /// How many bytes of an entry the editor reads.
    pub fn end_of_entry(&self) -> u64 {
        [
            self.start + 4,
            self.end + 4,
            self.total + 4,
            self.per_season + 4,
            self.percent + 2,
            self.reputation + 2,
            self.kind + 1,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
        .max(self.entry_size)
    }
}

/// One of the game's pools of objects (see `object_pool.rs`), a static of the game plugin, from where it keeps the
/// list `(begin, end, capacity)` of pointers to its chunks. The rest are `u32`s but for the first free slot.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PoolLayout {
    /// The list of chunks.
    pub chunks: u64,
    /// Pointer to the first free slot, null when none is free. Each free slot's first 8 bytes point at the next.
    pub first_free: u64,
    /// How many slots are free, and how many hold an object.
    pub free: u64,
    pub used: u64,
    /// Bytes per slot.
    pub slot_size: u64,
    /// How many slots the first chunk has, and each later one.
    pub first_chunk: u64,
    pub later_chunks: u64,
}

impl PoolLayout {
    /// One past the last byte of every field, from where the pool keeps its list of chunks.
    pub fn end(&self) -> u64 {
        [
            self.chunks + 24,
            self.first_free + 8,
            self.free + 4,
            self.used + 4,
            self.slot_size + 4,
            self.first_chunk + 4,
            self.later_chunks + 4,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

/// The tactic block a selection's list ([`SelectionLayout::list`]) points at: the eleven places of the formation,
/// once for when the team has the ball and once for when it has not, each a record of `slot_size` bytes that starts
/// with the place's position and ends with its role's mask (see `crate::scouting`). The places with the ball are in
/// the order of the selection's.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TacticLayout {
    /// The record of the first place with the ball.
    pub in_possession: u64,
    /// The record of the first place without the ball.
    pub out_of_possession: u64,
    pub slot_size: u64,
    /// In a record: the `u64` role mask.
    pub role: u64,
    /// In a record: the `u32` mask of the place's position (see `crate::scouting::position_of_mask`). Only in the
    /// layouts it has been checked in; without it the editor works a place's position out from its roles.
    #[serde(default)]
    pub position: Option<u64>,
    /// `u32` code of the style the tactic was made from, as text backwards (`CONT`, `TIKI`, `DIRE`).
    pub style: u64,
    /// Eleven bytes, one for each place with the ball: the place without the ball the same player takes. Only in the
    /// layouts it has been checked in; without it the two run in the same order.
    #[serde(default)]
    pub pairing: Option<u64>,
}

/// The tactics each human manager keeps for each of his teams, as the game reads them to tell how well the players
/// know the tactic in use (see `crate::tactical_areas`). The build's static pointer ([`BuildProfile::tactics_manager`])
/// leads to an object with a list `(begin, end)` at `managers`, one object per human manager; each has a map
/// at `teams`, from a team's id to the team's tactics: nodes laid out as the C++ library's (`tree`, see
/// [`crate::Tree`]), the id at `key` and the team's tactics at `value`. There, `tactics` holds the list `(begin, end)` of pointers to the
/// tactics and `current` the index of the one in use: both of a `simatch::PREPARED_TACTICS_CREATOR_ARRAY`, the class
/// of the selections ([`SelectionLayout`]), whose list is at the selection's `list` and its index 0x18 after it. A
/// tactic keeps its team instructions at `instructions`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TacticsLayout {
    pub managers: u64,
    pub teams: u64,
    /// Whose layout the map's nodes have; the Mac's where the layout does not say.
    #[serde(default)]
    pub tree: Tree,
    /// In a node: the `u32` id of the team.
    pub key: u64,
    pub value: u64,
    /// In a team: its `u32` id.
    pub team_id: u64,
    pub tactics: u64,
    /// The `i8` index of the tactic in use.
    pub current: u64,
    /// In a tactic: the two `u64` words of its team instructions, from which the game works out the option it plays
    /// in each tactical area (see `crate::area_options`).
    pub instructions: u64,
}

/// How well a player knows a tactic, area by area (see `crate::familiarity`): his `record` pointer leads to six lists
/// `(begin, end, capacity)` of 4-byte entries, `area_step` apart, each naming its area by the byte at `area_index`, and
/// then a list of 16-byte entries for his shapes at `shapes`. The build's static pointer to the training manager
/// ([`BuildProfile::training_manager`]) leads to an object with a list `(begin, end)` at `managers`, one object per
/// human manager; each names his club at `club` and has a map at `players`, from a person's id (the
/// player's `player_person`) to his history of training: nodes laid out as the C++ library's (`tree`, see
/// [`crate::Tree`]), the id at `person` and the list `(begin, end, capacity)` of 12-byte entries at `history`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FamiliarityLayout {
    pub record: u64,
    pub area_step: u64,
    pub area_index: u64,
    pub shapes: u64,
    pub managers: u64,
    pub club: u64,
    pub players: u64,
    /// Whose layout the map's nodes have; the Mac's where the layout does not say.
    #[serde(default)]
    pub tree: Tree,
    pub person: u64,
    pub history: u64,
    /// In a player: the `u32` id the game gives the person, in his identity block.
    pub player_person: u64,
}

/// Where a player on loan keeps his loan contract: his `record` pointer (shifted like the person block) leads to a
/// record of his other contracts, whose field at `contract` points at the loan contract while he is on loan. The loan
/// contract is an object of `class` (found by its name: see [`crate::rtti`]), laid out as a contract
/// ([`ContractLayout`]) for its owner, its teams, its dates and the squad number: its team is the one he is on loan
/// to, and its end date is the day the loan ends.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoanLayout {
    /// In a player: pointer to the record of his other contracts.
    pub record: u64,
    /// In that record: pointer to the loan contract, null when he is not on loan.
    pub contract: u64,
    /// In that record: the pointers to his other contracts (with a B team, and others), null for none. When a loan
    /// ends and these are all null, the game leaves the player without a record.
    pub others: Vec<u64>,
    /// The class of loan contracts, as written in C++.
    pub class: String,
    /// In the loan contract: its terms, past the fields it shares with a contract; none where they have not been read.
    #[serde(default)]
    pub terms: Option<LoanTermsLayout>,
}

/// Where a loan contract keeps the terms the game's Loan Club tab shows.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoanTermsLayout {
    /// `u16` flags: bit 0, he may play against his own club; bit 1, in cup matches; bit 2, his club may recall him;
    /// bit 12, the loan cannot be terminated.
    pub flags: u64,
    /// `i32`, pounds, -1 for none: the fee for which the club he is on loan to may sign him for good.
    pub option_fee: u64,
    /// `i32`, pounds a month, -1 for none: what that club pays his own each month he plays for it.
    pub monthly_fee: u64,
    /// `i32`, pounds a month, -1 for none: what it pays each month he is not used.
    pub unused_fee: u64,
}

impl LoanTermsLayout {
    /// One past the last byte of the terms.
    pub fn end(&self) -> u64 {
        [self.flags + 2, self.option_fee + 4, self.monthly_fee + 4, self.unused_fee + 4].into_iter().max().unwrap_or(0)
    }
}

/// What a human manager has picked for his club, as the match engine keeps it: for each of his tactics, objects of one
/// class (`class`, found by its name: see [`crate::rtti`]) whose `count` slots of `u32` person ids, from `slots` on,
/// are the starting eleven in the order of the formation's positions and then the substitutes. An empty slot holds
/// `0xFFFF_FFFF`.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SelectionLayout {
    /// The class, as written in C++.
    pub class: String,
    /// In an object: a list `(begin, end, capacity)` every live one holds.
    pub list: u64,
    /// In an object: the first slot.
    pub slots: u64,
    pub count: u64,
    /// In a player: the `u32` id the game gives the person, which the slots hold.
    pub player_person: u64,
}

/// The retirements the game has planned, which its retirement manager keeps (`RETIREMENT_MANAGER`, one object a
/// static points at, which each build profile places: [`BuildProfile::retirement_manager`]). It lists them twice: as
/// pointers to the entries, and as an index of 16-byte entries (the person id, 4 spare bytes, the pointer) sorted by
/// person id.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RetirementLayout {
    /// In the manager: the `(begin, end, capacity)` list of pointers to the entries.
    pub planned: u64,
    /// In the manager: the `(begin, end, capacity)` index of the entries by person id.
    pub by_person: u64,
    /// In an entry: the `u32` id of the person who retires (`player_person`), and the date he retires.
    pub person: u64,
    pub date: u64,
    /// In a player: the `u32` id the game gives the person.
    pub player_person: u64,
}

/// A stadium, which a club's senior team points at.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StadiumLayout {
    /// In the senior team: the pointer to the stadium.
    pub team_pointer: u64,
    /// FM string pointer.
    pub name: u64,
    /// `u32` capacities: the whole, the seats, the part in use when it is limited (0 when not) and the most it can
    /// be expanded to.
    pub capacity: u64,
    pub seating: u64,
    pub used: u64,
    pub expansion: u64,
    /// Pointer to the club that owns it.
    pub owner: u64,
}

impl StadiumLayout {
    /// One past the last byte of every stadium field.
    pub fn end(&self) -> u64 {
        [self.name + 8, self.capacity + 4, self.seating + 4, self.used + 4, self.expansion + 4, self.owner + 8]
            .into_iter()
            .max()
            .unwrap_or(0)
    }
}

/// One of a person's relations: a 16-byte entry of the list that starts the record his `relations` pointer leads to.
/// It points at its target, a nation, club, person or competition, and then says how he is tied to it.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RelationLayout {
    /// Pointer to the target.
    pub target: u64,
    /// `u8`: 1 for a club, 3 for a person, 8 for a nation.
    pub target_kind: u64,
    /// `u8`: 9 for a nationality, 70 for a nation he was trained in, 72 for a club he was trained at, 109 for a nation
    /// he needs no work permit in.
    pub relation: u64,
    /// `u16`: a count some relations use; for one he needs no work permit for, the days it has left.
    pub count: u64,
    /// `u8`: for a training, the homegrown rule it meets.
    pub value: u64,
    /// Bytes per entry.
    pub size: u64,
}

/// One current injury of a player. A player's `injuries` pointer leads to a record whose
/// first field is the list `(begin, end, capacity)` of these.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InjuryLayout {
    /// Pointer to the kind of injury.
    pub kind: u64,
    /// The team he was with when it happened.
    pub team: u64,
    /// Date.
    pub started: u64,
    /// `u16` days from `started` until he is back at the latest, and at the soonest.
    pub longest: u64,
    pub shortest: u64,
    /// In the kind of injury: its name, an FM string.
    pub kind_name: u64,
}

impl InjuryLayout {
    /// One past the last byte of every injury field.
    pub fn end(&self) -> u64 {
        [self.kind + 8, self.team + 8, self.started + 4, self.longest + 2, self.shortest + 2]
            .into_iter()
            .max()
            .unwrap_or(0)
    }
}

/// One current ban of a player. The record a player's `injuries` pointer leads to holds,
/// after his list of current injuries, the list `(begin, end, capacity)` of his current
/// absences: his bans, and others such as a call-up. Each is a 32-byte entry, and a ban
/// carries `0xFFFF` at `marker`, where the others hold 0.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BanLayout {
    /// Where the list of absences is in the record.
    pub list: u64,
    /// The date the ban began.
    pub started: u64,
    /// `u16`, `0xFFFF` for a ban.
    pub marker: u64,
    /// `u8`: how many matches he still has to miss.
    pub matches: u64,
}

impl BanLayout {
    /// One past the last byte of every field of an entry.
    pub fn end(&self) -> u64 {
        [self.started + 4, self.marker + 2, self.matches + 1].into_iter().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PlayerLayout {
    pub uid: u64,
    pub full_name: u64,
    pub first_name: u64,
    pub last_name: u64,
    pub common_name: u64,
    pub date_of_birth: u64,
    pub current_ability: u64,
    pub potential_ability: u64,
    pub nation: u64,
    /// Pointer to the record whose first field is the list of his relations; see [`RelationLayout`].
    pub relations: u64,
    pub team: u64,
    /// Start of the person block; fields from here on move with the person-block shift.
    pub person_block: u64,
    /// The block with the UID that contracts and captaincies point at, when it does not
    /// start the person block (on macOS it ends it).
    #[serde(default)]
    pub identity: Option<u64>,
    /// Shifts of the person block seen across player classes (player-coaches use 0xF8).
    pub person_block_shifts: Vec<u64>,
    /// `u8` of flags in the identity block, one of which is set for a woman (see [`crate::is_woman`]); unset where the
    /// layout has not placed them yet.
    #[serde(default)]
    pub gender: Option<u64>,
    /// `u8` of flags in the identity block, one of which ([`crate::MADE_BY_GAME`]) is set for a player the game made,
    /// as at a youth intake; unset where the layout has not placed them.
    #[serde(default)]
    pub made_by_game: Option<u64>,
    /// Pointer to the city he was born in (see [`CityLayout`]); unset where the layout has not placed it.
    #[serde(default)]
    pub city_of_birth: Option<u64>,
    pub height: u64,
    /// `i32` pounds: his transfer value, which the game shows in the player's currency as a range starting at it
    /// while his club's scouts do not know him well; 300,000,000 when he is not for sale. Unset where the layout has
    /// not placed it.
    #[serde(default)]
    pub transfer_value: Option<u64>,
    pub asking_price: u64,
    pub home_reputation: u64,
    pub current_reputation: u64,
    pub world_reputation: u64,
    pub international_caps: u64,
    pub international_goals: u64,
    pub u21_caps: u64,
    pub u21_goals: u64,
    pub contract: u64,
    /// `u16` 0..10000, live values the game changes every day.
    pub match_sharpness: u64,
    pub condition: u64,
    /// `i16`, -500 when rested and higher the more worn out he is by playing.
    pub jadedness: u64,
    /// `u8` 1..20: his morale, which the game shows in words as his overall happiness.
    pub morale: u64,
    /// `u64` bitmask of his traits (preferred moves), in the order of [`crate::TRAITS`].
    pub traits: u64,
    /// Pointer to the injury record; see [`InjuryLayout`].
    pub injuries: u64,
    /// First of the 15 position ratings, in [`crate::POSITIONS`] order.
    pub positions: u64,
    /// First of the 8 personality ratings, in [`crate::PERSONALITY`] order.
    pub personality: u64,
    /// Attribute offsets by key; see [`crate::ATTRIBUTE_GROUPS`].
    pub attributes: BTreeMap<String, u64>,
}

impl PlayerLayout {
    /// Where `offset` lands in an object whose person block is shifted by `shift`.
    pub fn at(&self, offset: u64, shift: u64) -> u64 {
        if offset >= self.person_block { offset + shift } else { offset }
    }

    /// Where the block that contracts and captaincies point at starts, before any shift.
    pub fn identity(&self) -> u64 {
        self.identity.unwrap_or(self.person_block)
    }

    /// One past the last byte of every direct player field, before any shift.
    pub fn end(&self) -> u64 {
        let fields = [
            self.uid + 4,
            self.full_name + 8,
            self.first_name + 8,
            self.last_name + 8,
            self.common_name + 8,
            self.date_of_birth + 4,
            self.current_ability + 2,
            self.potential_ability + 2,
            self.nation + 8,
            self.team + 8,
            self.relations + 8,
            self.height + 2,
            self.asking_price + 4,
            self.world_reputation + 2,
            self.international_goals + 2,
            self.u21_goals + 1,
            self.contract + 8,
            self.match_sharpness + 2,
            self.condition + 2,
            self.jadedness + 2,
            self.morale + 1,
            self.traits + 8,
            self.injuries + 8,
            self.positions + crate::POSITIONS.len() as u64,
            self.personality + crate::PERSONALITY.len() as u64,
        ];
        let single_bytes =
            self.attributes.values().chain(&self.gender).chain(&self.made_by_game).map(|offset| offset + 1);
        let value = self.transfer_value.map(|offset| offset + 4).into_iter().chain(self.city_of_birth.map(|o| o + 8));
        fields.into_iter().chain(single_bytes).chain(value).max().unwrap_or(0)
    }

    /// The largest person-block shift.
    pub fn max_shift(&self) -> u64 {
        self.person_block_shifts.iter().copied().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ContractLayout {
    /// Points back at the person block of the player or member of staff the contract belongs to.
    pub owner: u64,
    pub wage: u64,
    pub signed: u64,
    pub expires: u64,
    pub joined: u64,
    pub squad_status: u64,
    pub listing: u64,
    pub squad_number: u64,
    pub team: u64,
    /// The employer's senior team: the same as `team` but for player-coaches.
    pub senior_team: u64,
    pub job: u64,
    /// The list `(begin, end, capacity)` of the contract's clauses and bonuses: 8-byte entries, an amount and a kind.
    pub clauses: u64,
    /// The list of its bonuses for winning competitions: 32-byte entries.
    pub competition_bonuses: u64,
    /// `i32`, pounds per week.
    pub loyalty_bonus: u64,
    /// `i8` each: how happy the player is, and how happy with his playing time, as FMRTE shows them.
    pub happiness: u64,
    pub playing_time_happiness: u64,
    /// Pointer to the record of his reasons to be unhappy: a `u64` count, then that many pointers to 28-byte entries.
    pub unhappiness: u64,
    /// `u8`, the kind of contract (0 part-time, 1 full-time, 2 amateur, 3 youth, 4 non-contract, 10 and 11 the MLS's
    /// senior contracts); none in a layout where it has not been checked.
    #[serde(default)]
    pub contract_type: Option<u64>,
    /// Bytes of a contract: the size of the slots of the game's pool of contracts, which the editor takes one of for a
    /// contract of its making (see `signing.rs`). None in a layout where it does not make contracts.
    #[serde(default)]
    pub size: Option<u64>,
    /// Where a contract the editor makes holds 8 zero bytes in place of what the contract it is modelled on has: places
    /// that hold a pointer in some contracts and nothing in most, to records the editor does not know and must not
    /// share. The unhappiness record and the two lists of extras start empty too.
    #[serde(default)]
    pub cleared: Vec<u64>,
}

impl ContractLayout {
    /// One past the last byte of every contract field.
    pub fn end(&self) -> u64 {
        let contract_type = self.contract_type.map(|offset| offset + 1);
        [
            self.owner + 8,
            self.wage + 4,
            self.signed + 4,
            self.expires + 4,
            self.joined + 4,
            self.squad_status + 1,
            self.listing + 1,
            self.squad_number + 1,
            self.team + 8,
            self.senior_team + 8,
            self.job + 1,
            self.loyalty_bonus + 4,
            self.happiness + 1,
            self.playing_time_happiness + 1,
            self.unhappiness + 8,
        ]
        .into_iter()
        .chain(contract_type)
        .max()
        .unwrap_or(0)
    }
}

/// Static values next to the entity arrays, as offsets from the players `(begin, end)` pair.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClusterLayout {
    pub current_date: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StaffLayout {
    pub uid: u64,
    pub full_name: u64,
    pub first_name: u64,
    pub last_name: u64,
    pub common_name: u64,
    pub nation: u64,
    /// First of the 8 personality ratings, in [`crate::PERSONALITY`] order.
    pub personality: u64,
    pub date_of_birth: u64,
    pub contract: u64,
    pub home_reputation: u64,
    pub current_reputation: u64,
    pub world_reputation: u64,
    pub current_ability: u64,
    pub potential_ability: u64,
    /// Start of the person block; fields from here on move with the person-block shift.
    pub person_block: u64,
    /// The block with the UID that contracts point at, when it does not start the person
    /// block (on macOS it ends it).
    #[serde(default)]
    pub identity: Option<u64>,
    /// Shifts of the person block seen across staff classes (the human manager uses 0x340).
    pub person_block_shifts: Vec<u64>,
    /// `u8` of flags in the identity block, as for players; unset where the layout has not placed them yet.
    #[serde(default)]
    pub gender: Option<u64>,
    /// Attributes stored raw (0..100) by key; see [`crate::STAFF_ATTRIBUTE_GROUPS`].
    pub attributes: BTreeMap<String, u64>,
    /// Ratings stored as shown (1..20) by key.
    pub ratings: BTreeMap<String, u64>,
}

impl StaffLayout {
    /// Where `offset` lands in an object whose person block is shifted by `shift`.
    pub fn at(&self, offset: u64, shift: u64) -> u64 {
        if offset >= self.person_block { offset + shift } else { offset }
    }

    /// Where the block that contracts point at starts, before any shift.
    pub fn identity(&self) -> u64 {
        self.identity.unwrap_or(self.person_block)
    }

    /// One past the last byte of every staff field, before any shift.
    pub fn end(&self) -> u64 {
        let fields = [
            self.uid + 4,
            self.full_name + 8,
            self.first_name + 8,
            self.last_name + 8,
            self.common_name + 8,
            self.nation + 8,
            self.personality + crate::PERSONALITY.len() as u64,
            self.date_of_birth + 4,
            self.contract + 8,
            self.world_reputation + 2,
            self.potential_ability + 2,
        ];
        let single_bytes =
            self.attributes.values().chain(self.ratings.values()).chain(&self.gender).map(|offset| offset + 1);
        fields.into_iter().chain(single_bytes).max().unwrap_or(0)
    }

    pub fn max_shift(&self) -> u64 {
        self.person_block_shifts.iter().copied().max().unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamLayout {
    pub club: u64,
    /// `u8`: the kind of team, 0 for the first team.
    pub kind: u64,
    /// `u8`: the oldest its players may be; 100 for a team without a limit.
    pub age_limit: u64,
    /// The team's player pointers as `(begin, end, capacity)`.
    pub players: u64,
    /// Pointers to the person blocks of the captain and the vice-captain, null for none.
    pub captain: u64,
    pub vice_captain: u64,
    pub reputation: u64,
    /// Where the team points at its manager's object, null for none; unset where the layout has not placed it, and a
    /// manager is then left as he is.
    #[serde(default)]
    pub manager: Option<u64>,
    /// Pointer to the league the team plays in this season (a competition), null for none; unset where the layout has
    /// not placed it.
    #[serde(default)]
    pub competition: Option<u64>,
}

impl TeamLayout {
    /// One past the last byte of every team field.
    pub fn end(&self) -> u64 {
        [
            self.club + 8,
            self.kind + 1,
            self.age_limit + 1,
            self.players + 24,
            self.captain + 8,
            self.vice_captain + 8,
            self.reputation + 2,
            self.manager.map_or(0, |at| at + 8),
            self.competition.map_or(0, |at| at + 8),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubLayout {
    pub uid: u64,
    pub name: u64,
    pub short_name: u64,
    pub women: u64,
    pub teams: u64,
    pub info: u64,
    pub finance: u64,
    /// The club's staff by department, each a list of pointers as `(begin, end, capacity)`: the medical team, the
    /// coaches and the scouts.
    pub medical_staff: u64,
    pub coaching_staff: u64,
    pub scouting_staff: u64,
    /// Where the club points at the member of staff whose job is to be its director of football, null for none; unset
    /// where the layout has not placed it, and a director of football is then left as he is.
    #[serde(default)]
    pub director_of_football: Option<u64>,
    /// Pointer to the nation the club is from, as its profile in the game names it (Wales for Cardiff City, who play
    /// in England); unset where the layout has not placed it.
    #[serde(default)]
    pub nation: Option<u64>,
    /// The teams the club runs that belong to other clubs, a list of team pointers as `(begin, end, capacity)`: the
    /// game keeps a B team as a club of its own (1. FC Nürnberg II), and its parent lists that club's senior team
    /// here. Unset where the layout has not placed it: the club then shows its own teams only.
    #[serde(default)]
    pub linked_teams: Option<u64>,
}

impl ClubLayout {
    pub fn end(&self) -> u64 {
        [
            self.uid + 4,
            self.name + 8,
            self.short_name + 8,
            self.women + 1,
            self.teams + 8,
            self.info + 8,
            self.finance + 8,
            self.medical_staff + 24,
            self.coaching_staff + 24,
            self.scouting_staff + 24,
            self.director_of_football.map_or(0, |at| at + 8),
            self.nation.map_or(0, |at| at + 8),
            self.linked_teams.map_or(0, |at| at + 24),
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubInfoLayout {
    pub season_tickets: u64,
    pub founded: u64,
    pub social_media: u64,
    /// First of 6 supporter-mix percentages, in [`crate::SUPPORTER_MIX`] order.
    pub supporter_mix: u64,
    /// First of 6 supporter traits (1..20), in [`crate::SUPPORTER_TRAITS`] order.
    pub supporter_traits: u64,
    pub training: u64,
    pub youth_facilities: u64,
    pub youth_coaching: u64,
    pub youth_recruitment: u64,
}

impl ClubInfoLayout {
    pub fn end(&self) -> u64 {
        [
            self.season_tickets + 4,
            self.founded + 2,
            self.social_media + 4,
            self.supporter_mix + 6,
            self.supporter_traits + 6,
            self.training + 1,
            self.youth_facilities + 1,
            self.youth_coaching + 1,
            self.youth_recruitment + 1,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ClubFinanceLayout {
    pub balance: u64,
    pub transfer_budget: u64,
    pub total_wage_budget: u64,
    pub wage_budget: u64,
    pub ticket_price: u64,
    pub corporate: u64,
    /// The class of the full record, as written in C++: the clubs outside the leagues being played have a smaller one,
    /// which values read past its end can make look real. A build without a profile reads only records of this class
    /// (see `Session::finance_class`); none where the layout does not name it.
    #[serde(default)]
    pub class: Option<String>,
}

impl ClubFinanceLayout {
    pub fn end(&self) -> u64 {
        [
            self.balance + 4,
            self.transfer_budget + 4,
            self.total_wage_budget + 4,
            self.wage_budget + 4,
            self.ticket_price + 4,
            self.corporate + 1,
        ]
        .into_iter()
        .max()
        .unwrap_or(0)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NationLayout {
    pub uid: u64,
    pub name: u64,
}

/// A city (`db::CITY`): its UID and name where a nation keeps them, and the nation it is in.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CityLayout {
    pub uid: u64,
    pub name: u64,
    pub nation: u64,
}

/// What the game's allocator does with the blocks it hands out.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HeapLayout {
    /// Block sizes in bytes, ascending. A buffer of more than the first size and up to the last one sits in
    /// the smallest block at least as large as it; outside that span the block size is not known.
    pub block_sizes: Vec<u64>,
    /// The steps, in bytes, in which the game's allocator sizes the blocks of its strings (a header of 8 bytes, a
    /// count of holders, the length, the text and a NUL), for the names the editor writes (see `stadium_name.rs`).
    /// 16 when not given.
    pub string_step: Option<u64>,
    /// The largest block the game's own allocator hands out: it gets larger ones from the system's allocator, and
    /// gives them back to it, so the editor grows no list into memory of its own past it (see `own_memory.rs`). Not
    /// given where it is not known.
    pub largest_block: Option<u64>,
}

impl HeapLayout {
    /// The size of the block that holds a buffer of `bytes`, where that is known.
    pub fn block_size(&self, bytes: u64) -> Option<u64> {
        let (&smallest, sizes) = self.block_sizes.split_first()?;
        if bytes <= smallest {
            return None;
        }
        sizes.iter().copied().find(|&size| size >= bytes)
    }

    /// The size of a block of the editor's own for a list's buffer of `bytes`, to be at least as large as the game's
    /// allocator would give it, so that the game can hand it out again once it lets the list go. Within the classes
    /// the layout lists, that class; past them, where the class is not known, the next power of two, which holds it (on
    /// the Mac every class past 512 bytes lies below it); a smaller buffer gets its own size, as the classes below the
    /// first come in steps of 8 and then 16. None past `largest_block`: the game would give that block to `free()`.
    pub fn grown_block(&self, bytes: u64) -> Option<u64> {
        if self.largest_block.is_some_and(|largest| bytes > largest) {
            return None;
        }
        if let Some(size) = self.block_size(bytes) {
            return Some(size);
        }
        let past_classes = self.block_sizes.last().is_some_and(|&last| bytes > last);
        Some(if past_classes { bytes.next_power_of_two() } else { bytes })
    }
}

/// Addresses that change with every build of the game plugin.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BuildProfile {
    pub name: String,
    pub edition: u32,
    pub storefront: Storefront,
    pub package_version: Option<String>,
    pub plugin: PluginFingerprint,
    pub arrays: ArrayRvas,
    /// RVA in the game plugin of the in-game date, where it is not next to the arrays at
    /// [`ClusterLayout::current_date`]: on macOS, and on Windows since the November 2026 update (Game Pass
    /// 0.9.2409.0, Steam build 26340721), it is a variable of its own.
    pub current_date: Option<u64>,
    /// RVA in the game plugin of the static pointer to the retirement manager ([`RetirementLayout`]). It is not at
    /// the same distance from the arrays in every build: 0xED60 before the players pair on Game Pass, 0xDAC0 on
    /// Steam.
    pub retirement_manager: Option<u64>,
    /// RVA in the game plugin of a static pointer to the game's own object ([`GameLayout`]), whose count of the saves
    /// loaded tells a load from a save: 0x3C80 before the players pair on Game Pass 0.9.2409.0 and Steam build 26340721.
    pub game_ui: Option<u64>,
    /// RVA in the game plugin of the static pointer to the tactics the human managers keep for their teams
    /// ([`TacticsLayout`]). Where it does not point at the manager, or for a build without a profile, the editor looks
    /// for it as for the retirement manager's (see `crate::locate`).
    pub tactics_manager: Option<u64>,
    /// RVA in the game plugin of the static pointer to the training manager (`TRAINING_MANAGER`), which keeps the
    /// history of training of the human managers' players; looked for as [`BuildProfile::tactics_manager`] is.
    pub training_manager: Option<u64>,
    /// Whether the prize money competitions pay ([`PrizeMoneyLayout`]) was read on this build and found to be what the
    /// game shows. The app shows and changes it only on such builds; the probe reads it on any.
    #[serde(default)]
    pub prize_money: bool,
    /// Whether a club's sponsorship deals ([`SponsorshipLayout`]) were read on this build and matched to the game's
    /// Sponsorship screen. The app shows them only on such builds; the probe reads them on any.
    #[serde(default)]
    pub sponsorships: bool,
    /// Whether the rules competitions register their squads under ([`RulesLayout`]) were read on this build and matched
    /// to the game's Competition Stages screen. The app shows and changes them only on such builds; the probe reads
    /// them on any.
    #[serde(default)]
    pub squad_rules: bool,
    /// Where the build keeps its arrays of national teams' containers, for the builds they were read on; none where
    /// they were not, which leaves the National teams tab off.
    #[serde(default)]
    pub national_teams: Option<NationalArrays>,
    /// What the build lays out otherwise than the edition's layout, field by field (see [`layout_of`]): since the update
    /// of 17 November 2026 (Game Pass 0.9.2524.0, Steam build 26620374), corporate facilities in the club finance record
    /// and, in a team's tactics, the list of tactics and the index of the one in use, each a few bytes further on.
    /// Empty where the layout holds.
    #[serde(default)]
    pub layout: LayoutOverrides,
}

/// RVAs in the game plugin of the `(begin, end)` pointer pairs of the arrays of national teams' containers: one holds a
/// container for each nation's men's teams and the other for its women's.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NationalArrays {
    pub men: u64,
    pub women: u64,
}

/// What a build lays out otherwise than the edition's layout (`layout.toml`), as its profile's `[layout.<section>]`
/// tables give it: offsets by the layout's section and field, each put in place of the layout's (see [`layout_of`]).
/// A layout that changed with an update can only change for the builds since: the builds before keep it as it was.
///
/// A build without a profile reads its layout with the overrides of the newest build of its kind ([`layout_lender`]),
/// which nobody has read on it. So each field named here must be one a check guards: read from the wrong place, it has
/// to leave something unread, not show or write it wrong. Corporate facilities are read only where the whole finance
/// record looks real (`finances_look_real` in `clubs.rs`), and a team's tactics, on such a build, only where their
/// list is the one of the class that keeps it (`tactical_areas.rs`). A unit test refuses an override of any other
/// field until it has such a check.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(transparent)]
pub struct LayoutOverrides(pub BTreeMap<String, BTreeMap<String, u64>>);

impl LayoutOverrides {
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

/// Identifies a build of the game plugin from its headers as mapped in memory.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(untagged, deny_unknown_fields)]
pub enum PluginFingerprint {
    /// `game_plugin.dll` on Windows: two values of its PE header.
    Pe { size_of_image: u32, link_timestamp: u32 },
    /// `game_plugin` on macOS: its `LC_UUID`. The arm64 and the Intel half of the universal
    /// binary have one each, so a build has a profile per architecture.
    MachO {
        #[serde(deserialize_with = "uuid_from_text")]
        uuid: [u8; 16],
    },
}

impl PluginFingerprint {
    /// Reads the fingerprint of the game plugin `plugin` from the headers mapped in `process`.
    #[cfg(windows)]
    pub fn read(process: &Process, plugin: &Module) -> fmlibre_mem::Result<Self> {
        let image = fmlibre_mem::PeImage::read(process, plugin.base)?;
        Ok(Self::Pe { size_of_image: image.size_of_image, link_timestamp: image.timestamp })
    }

    /// Reads the fingerprint of the game plugin `plugin` from the headers mapped in `process`.
    #[cfg(target_os = "macos")]
    pub fn read(process: &Process, plugin: &Module) -> fmlibre_mem::Result<Self> {
        let image = fmlibre_mem::MachImage::read(process, plugin.base)?;
        let uuid = image.uuid.ok_or(fmlibre_mem::Error::InvalidMachO { base: plugin.base, reason: "no LC_UUID" })?;
        Ok(Self::MachO { uuid })
    }

    /// Whether `other` is the fingerprint of the same kind of plugin: both of Windows (PE) or both of macOS (Mach-O).
    /// Only those profiles say anything about each other's builds: the others' statics are in another binary, and
    /// their overrides are of another layout file.
    pub fn same_kind(self, other: PluginFingerprint) -> bool {
        std::mem::discriminant(&self) == std::mem::discriminant(&other)
    }
}

impl fmt::Display for PluginFingerprint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PluginFingerprint::Pe { size_of_image, link_timestamp } => {
                write!(f, "size of image {size_of_image:#x}, link timestamp {link_timestamp:#010x}")
            }
            PluginFingerprint::MachO { uuid } => write!(f, "UUID {}", uuid_text(uuid)),
        }
    }
}

/// A UUID as macOS writes it, e.g. "9E8E47DE-F704-314C-917D-C32D12637678".
fn uuid_text(uuid: &[u8; 16]) -> String {
    let hex = |bytes: &[u8]| bytes.iter().map(|b| format!("{b:02X}")).collect::<String>();
    let (a, b, c, d, e) = (&uuid[..4], &uuid[4..6], &uuid[6..8], &uuid[8..10], &uuid[10..]);
    format!("{}-{}-{}-{}-{}", hex(a), hex(b), hex(c), hex(d), hex(e))
}

/// A UUID as macOS writes it, e.g. "9E8E47DE-F704-314C-917D-C32D12637678".
fn uuid_from_text<'de, D: Deserializer<'de>>(deserializer: D) -> Result<[u8; 16], D::Error> {
    let text = String::deserialize(deserializer)?;
    let hex: String = text.chars().filter(|&c| c != '-').collect();
    let bytes: Option<Vec<u8>> = (0..hex.len())
        .step_by(2)
        .map(|i| hex.get(i..i + 2).and_then(|pair| u8::from_str_radix(pair, 16).ok()))
        .collect();
    bytes.and_then(|bytes| bytes.try_into().ok()).ok_or_else(|| serde::de::Error::custom(format!("not a UUID: {text}")))
}

/// RVAs in the game plugin of the `(begin, end)` pairs of the entity arrays.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArrayRvas {
    pub players: u64,
    pub staff: u64,
    pub clubs: u64,
}

#[cfg(windows)]
const LAYOUTS: &[&str] = &[include_str!("../../../profiles/fm27/layout.toml")];

/// On macOS the game is built with clang, which lays some of its classes out otherwise.
#[cfg(target_os = "macos")]
const LAYOUTS: &[&str] = &[include_str!("../../../profiles/fm27/layout-macos.toml")];

const BUILDS: &[&str] = &[
    include_str!("../../../profiles/fm27/gamepass-0.9.2355.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2409.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2435.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2524.0.toml"),
    include_str!("../../../profiles/fm27/gamepass-0.9.2562.0.toml"),
    include_str!("../../../profiles/fm27/steam-26227640.toml"),
    include_str!("../../../profiles/fm27/steam-26340721.toml"),
    include_str!("../../../profiles/fm27/steam-26385295.toml"),
    include_str!("../../../profiles/fm27/steam-26577676.toml"),
    include_str!("../../../profiles/fm27/steam-26620374.toml"),
    include_str!("../../../profiles/fm27/steam-26797085.toml"),
    include_str!("../../../profiles/fm27/steam-26227640-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26227640-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26340721-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26340721-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26385295-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26385295-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26577676-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26577676-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26620374-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26620374-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/steam-26797085-macos-x86_64.toml"),
    include_str!("../../../profiles/fm27/steam-26797085-macos-arm64.toml"),
    include_str!("../../../profiles/fm27/epic-27.1.0.toml"),
];

/// The built-in object layout for `edition`, if there is one.
pub fn layout_for(edition: u32) -> Option<Layout> {
    layout_of(edition, &LayoutOverrides::default())
}

/// The built-in object layout for `edition` as a build lays it out: with each field `overrides` names (its profile's
/// [`BuildProfile::layout`]) at the offset given there. A section the layout does not have is left out, as a Windows
/// build's profile is on macOS, whose layout is another; a field it does not have is refused when it is read.
pub fn layout_of(edition: u32, overrides: &LayoutOverrides) -> Option<Layout> {
    LAYOUTS.iter().find_map(|text| {
        let mut layout: toml::Table = parse(text);
        if layout.get("edition").and_then(toml::Value::as_integer) != Some(i64::from(edition)) {
            return None;
        }
        for (section, fields) in &overrides.0 {
            let Some(toml::Value::Table(section)) = layout.get_mut(section) else {
                continue;
            };
            for (field, &offset) in fields {
                let offset = i64::try_from(offset).expect("an offset within an object");
                section.insert(field.clone(), toml::Value::Integer(offset));
            }
        }
        Some(toml::Value::Table(layout).try_into().expect("built-in profiles are checked by the unit tests"))
    })
}

/// The built-in build profile matching `fingerprint`, if there is one.
pub fn profile_for(fingerprint: PluginFingerprint) -> Option<BuildProfile> {
    built_in_profiles().find(|profile| profile.plugin == fingerprint)
}

/// The profile whose [`BuildProfile::layout`] a build without a profile reads its objects with: of `profiles`, the
/// newest for the same edition and kind of plugin as the build's `fingerprint`, of its `storefront` where there is one
/// (a storefront's next build replaces its newest), its own left out, so that [`crate::IGNORE_PROFILES`] rehearses an
/// update on a build the editor knows. An update far likelier keeps what the build before it laid out otherwise than
/// goes back to the layout of the first builds: the update of 24 November 2026 kept both places that of 17 November
/// moved. On Windows the newest is the last linked, by the time stamp of the PE header; a Mach-O fingerprint holds no
/// time, and the newest is the last listed, as [`BUILDS`] lists a storefront's builds in the order they came out (a
/// unit test keeps it so). `None` where `profiles` hold none of the kind.
///
/// Nobody has read the overrides on that build, so each must be a field a check guards (see [`LayoutOverrides`]):
/// where the build moved it again, it is left unread, as without them.
pub fn layout_lender(
    edition: u32,
    fingerprint: PluginFingerprint,
    storefront: Storefront,
    profiles: impl IntoIterator<Item = BuildProfile>,
) -> Option<BuildProfile> {
    profiles
        .into_iter()
        .enumerate()
        .filter(|(_, profile)| {
            profile.edition == edition && profile.plugin != fingerprint && profile.plugin.same_kind(fingerprint)
        })
        .max_by_key(|(listed, profile)| {
            let linked = match profile.plugin {
                PluginFingerprint::Pe { link_timestamp, .. } => link_timestamp,
                PluginFingerprint::MachO { .. } => 0,
            };
            (profile.storefront == storefront, linked, *listed)
        })
        .map(|(_, profile)| profile)
}

/// Every built-in build profile, those of macOS among them.
pub fn built_in_profiles() -> impl Iterator<Item = BuildProfile> {
    BUILDS.iter().map(|text| parse::<BuildProfile>(text))
}

fn parse<T: serde::de::DeserializeOwned>(text: &str) -> T {
    toml::from_str(text).expect("built-in profiles are checked by the unit tests")
}

/// The Windows object layout, as written, for the unit tests of other modules.
#[cfg(test)]
pub(crate) fn windows_layout() -> Layout {
    parse(include_str!("../../../profiles/fm27/layout.toml"))
}

/// What `fmlibre-probe profile` writes in comments around the values of a build profile.
#[derive(Debug, Clone, Default)]
pub struct ProfileNotes {
    /// Lines at the top of the file.
    pub header: Vec<String>,
    /// Lines above the in-game date, above the static pointer to the retirement manager and above the one to the
    /// game's own object.
    pub current_date: Vec<String>,
    pub retirement_manager: Vec<String>,
    pub game_ui: Vec<String>,
}

/// The text of a build profile file, laid out as the built-in ones, with `notes` as comments.
pub fn profile_text(profile: &BuildProfile, notes: &ProfileNotes) -> String {
    let comments = |lines: &[String]| lines.iter().map(|line| format!("# {line}\n")).collect::<String>();
    let quoted = |text: &str| format!("\"{}\"", text.replace('\\', "\\\\").replace('"', "\\\""));
    let mut text = comments(&notes.header);
    text += &format!("name = {}\nedition = {}\n", quoted(&profile.name), profile.edition);
    let storefront = match profile.storefront {
        Storefront::GamePass => "gamePass",
        Storefront::Steam => "steam",
        Storefront::Epic => "epic",
        Storefront::Unknown => "unknown",
    };
    text += &format!("storefront = \"{storefront}\"\n");
    if let Some(version) = &profile.package_version {
        text += &format!("package_version = {}\n", quoted(version));
    }
    if let Some(rva) = profile.current_date {
        text += &format!("\n{}current_date = {rva:#X}\n", comments(&notes.current_date));
    }
    if let Some(rva) = profile.retirement_manager {
        text += &format!("\n{}retirement_manager = {rva:#X}\n", comments(&notes.retirement_manager));
    }
    if let Some(rva) = profile.game_ui {
        text += &format!("\n{}game_ui = {rva:#X}\n", comments(&notes.game_ui));
    }
    if let Some(rva) = profile.tactics_manager {
        text += &format!("\ntactics_manager = {rva:#X}\n");
    }
    if let Some(rva) = profile.training_manager {
        text += &format!("\ntraining_manager = {rva:#X}\n");
    }
    if profile.prize_money {
        text += "\nprize_money = true\n";
    }
    if profile.sponsorships {
        text += "\nsponsorships = true\n";
    }
    if profile.squad_rules {
        text += "\nsquad_rules = true\n";
    }
    text += "\n# game_plugin as mapped in memory; these values identify the build.\n[plugin]\n";
    match profile.plugin {
        PluginFingerprint::Pe { size_of_image, link_timestamp } => {
            text += &format!("size_of_image = {size_of_image:#X}\nlink_timestamp = {link_timestamp:#X}\n");
        }
        PluginFingerprint::MachO { uuid } => text += &format!("uuid = \"{}\"\n", uuid_text(&uuid)),
    }
    let ArrayRvas { players, staff, clubs } = profile.arrays;
    text += "\n# RVAs in game_plugin of the (begin, end) pointer pairs of the entity arrays.\n[arrays]\n";
    text += &format!("players = {players:#X}\nstaff = {staff:#X}\nclubs = {clubs:#X}\n");
    if let Some(NationalArrays { men, women }) = profile.national_teams {
        text += &format!(
            "\n# RVAs of the pairs of the arrays of national teams' containers.\n[national_teams]\nmen = {men:#X}\nwomen = {women:#X}\n"
        );
    }
    for (section, fields) in &profile.layout.0 {
        text += &format!("\n# What the build lays out otherwise than layout.toml.\n[layout.{section}]\n");
        for (field, offset) in fields {
            text += &format!("{field} = {offset:#X}\n");
        }
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    const WINDOWS: &str = include_str!("../../../profiles/fm27/layout.toml");
    const MACOS: &str = include_str!("../../../profiles/fm27/layout-macos.toml");

    #[test]
    fn attribute_groups_cover_the_layout() {
        for text in [WINDOWS, MACOS] {
            let layout: Layout = parse(text);
            let mut grouped: Vec<&str> =
                crate::ATTRIBUTE_GROUPS.iter().flat_map(|(_, keys)| keys.iter().copied()).collect();
            grouped.sort_unstable();
            let mut mapped: Vec<&str> = layout.player.attributes.keys().map(String::as_str).collect();
            mapped.sort_unstable();
            assert_eq!(grouped, mapped);
        }
    }

    /// A nation's details were read on the Mac only (#210): the Windows layout leaves them unplaced, and a national
    /// team's profile there shows none of them.
    #[test]
    fn only_the_mac_layout_places_a_nations_details() {
        let windows: Layout = parse(WINDOWS);
        let macos: Layout = parse(MACOS);
        assert!(windows.national.expect("national teams on Windows").details.is_none());
        let details = macos.national.expect("national teams on the Mac").details.expect("a nation's details");
        assert_eq!((details.founded, details.continent, details.continent_name), (0x870, 0xF8, 0x18));
        assert_eq!((details.medical_staff, details.coaching_staff, details.scouting_staff), (0x60, 0x78, 0x90));
        // The record of a member of staff's other contracts comes right after his contract.
        assert_eq!(details.staff_contracts, macos.staff.contract + 8);
        assert_eq!(details.national_contract, 0x10);
    }

    /// A nation's youth rating and settings were read on Windows and on the Mac, where they sit 8 bytes later (see
    /// `the_mac_layout_follows_the_windows_one`): both layouts place them, and offer their fields. The youth rating is in
    /// a container of either kind, men's or women's, at the same offsets.
    #[test]
    fn both_layouts_place_the_nation_settings() {
        let windows: Layout = parse(WINDOWS);
        let macos: Layout = parse(MACOS);
        let w = windows.national.as_ref().expect("national teams on Windows");
        assert_eq!((w.youth_rating, w.youth_rating_copy), (Some(0x86A), Some(0x86C)));
        assert_eq!((w.game_importance, w.game_importance_copy), (Some(0x87C), Some(0x87D)));
        assert_eq!((w.fa_financial_power, w.fa_financial_power_copy), (Some(0x882), Some(0x883)));
        assert_eq!(w.fa_patience, Some(0x885));
        assert_eq!(w.container_record, Some(0xB0));
        assert_eq!((w.attendance, w.min_attendance, w.max_attendance), (Some(0x68), Some(0x6C), Some(0x70)));
        assert_eq!((w.economic_factor, w.state_of_development), (Some(0x1F0), Some(0x1EC)));
        // On the Mac, England, France, Poland and San Marino read there as on Windows.
        let m = macos.national.as_ref().expect("national teams on the Mac");
        assert_eq!((m.youth_rating, m.youth_rating_copy), (Some(0x872), Some(0x874)));
        assert_eq!((m.economic_factor, m.state_of_development), (Some(0x1F8), Some(0x1F4)));
        let keys = [
            crate::YOUTH_RATING,
            "game_importance",
            "fa_financial_power",
            "fa_patience",
            "attendance",
            "min_attendance",
            "max_attendance",
            "economic_factor",
            "state_of_development",
        ];
        let has_fields = |layout: &Layout| {
            let fields = crate::fields(layout, crate::Entity::NationalTeam);
            keys.iter().all(|key| fields.iter().any(|field| field.key == *key))
        };
        assert!(has_fields(&windows) && has_fields(&macos));
    }

    #[test]
    fn the_mac_layout_follows_the_windows_one() {
        let (windows, mac): (Layout, Layout) = (parse(WINDOWS), parse(MACOS));
        assert_eq!(windows.player.identity(), windows.player.person_block);
        assert_eq!(windows.staff.identity(), windows.staff.person_block);

        // The player's own fields sit 8 bytes earlier, the person's 0x40, the identity block 0x100 later.
        for (key, &offset) in &windows.player.attributes {
            assert_eq!(mac.player.attributes[key], offset - 8, "{key}");
        }
        assert_eq!(
            (mac.player.positions, mac.player.morale, mac.player.jadedness),
            (windows.player.positions - 8, windows.player.morale - 8, windows.player.jadedness - 8)
        );
        assert_eq!(
            (mac.player.transfer_value, mac.player.asking_price),
            (windows.player.transfer_value.map(|offset| offset - 8), windows.player.asking_price - 8)
        );
        assert_eq!(mac.player.date_of_birth, windows.player.date_of_birth - 0x40);
        assert_eq!(mac.player.traits, windows.player.traits - 0x40);
        assert_eq!(mac.player.relations, windows.player.relations - 0x40);
        assert_eq!(mac.player.international_caps, windows.player.international_caps - 0x40);
        assert_eq!(mac.player.identity(), windows.player.identity() + 0x100);
        assert_eq!(mac.player.uid - mac.player.identity(), windows.player.uid - windows.player.identity());
        // Paul Ifill, a player-coach: his UID at 0x48C.
        assert_eq!(mac.player.at(mac.player.uid, 0xF8), 0x48C);
        assert_eq!(mac.player.at(mac.player.team, 0xF8), mac.player.team);

        // Staff keep their own fields where they are; their identity block also ends the person.
        assert_eq!(mac.staff.attributes, windows.staff.attributes);
        assert_eq!(mac.staff.current_ability, windows.staff.current_ability);
        assert_eq!(mac.staff.uid - mac.staff.identity(), windows.staff.uid - windows.staff.identity());

        // Competitions and their prize money are laid out alike.
        assert!(windows.prize_money.is_some() && windows.competition.is_some());
        assert_eq!(mac.prize_money, windows.prize_money);
        assert_eq!(mac.competition, windows.competition);
        assert_eq!(mac.player.identity() - mac.player.person_block, mac.staff.identity() - mac.staff.person_block);

        // A nation's containers of national teams read alike; the nation keeps its pointers to them 8 bytes later on
        // the Mac, as everything from its capital on.
        let (w, m) =
            (windows.national.as_ref().expect("national teams"), mac.national.as_ref().expect("national teams"));
        assert_eq!(
            (m.container_uid, m.container_teams, m.container_women, m.container_nation, m.nation_code),
            (w.container_uid, w.container_teams, w.container_women, w.container_nation, w.nation_code)
        );
        assert_eq!((m.nation_men, m.nation_women), (w.nation_men + 8, w.nation_women + 8));
        // So are a nation's youth rating and settings: those in the container and in the nation sit 8 bytes later on
        // the Mac, and the record of the attendance the container points at is laid out alike.
        let later = |offset: Option<u64>| offset.map(|offset| offset + 8);
        assert_eq!(
            (m.youth_rating, m.youth_rating_copy, m.game_importance, m.game_importance_copy),
            (
                later(w.youth_rating),
                later(w.youth_rating_copy),
                later(w.game_importance),
                later(w.game_importance_copy)
            )
        );
        assert_eq!(
            (m.fa_financial_power, m.fa_financial_power_copy, m.fa_patience),
            (later(w.fa_financial_power), later(w.fa_financial_power_copy), later(w.fa_patience))
        );
        assert_eq!(
            (m.economic_factor, m.state_of_development),
            (later(w.economic_factor), later(w.state_of_development))
        );
        assert_eq!(
            (m.container_record, m.attendance, m.min_attendance, m.max_attendance),
            (w.container_record, w.attendance, w.min_attendance, w.max_attendance)
        );

        // The tables of names are reached and laid out alike.
        assert!(windows.names.is_some());
        assert_eq!(mac.names, windows.names);

        // The transfers are laid out alike, but for the player's records, which sit in the person, 0x40 earlier as
        // his other fields there, and which take 24 bytes on the Mac.
        let (w, m) = (windows.transfers.as_ref().expect("transfers"), mac.transfers.as_ref().expect("transfers"));
        assert_eq!(
            (m.player_offer_numbers, m.player_entries),
            (w.player_offer_numbers - 0x40, w.player_entries - 0x40)
        );
        assert!(m.player_offer_numbers >= mac.player.person_block);
        assert_eq!((w.record_size, m.record_size), (0x28, 0x18));
        let shared = |t: &TransfersLayout| TransfersLayout {
            player_offer_numbers: 0,
            player_entries: 0,
            record_size: 0,
            ..t.clone()
        };
        assert_eq!(shared(m), shared(w));
        // So are the game's loan offers and the loan contracts they offer.
        assert!(m.loan.is_some());

        // The records the people point at are laid out alike. The kind of contract is left out of a layout until it
        // has been read on that system; where both have it, it sits at the same place.
        let without_kind = |c: &ContractLayout| ContractLayout { contract_type: None, ..c.clone() }.end();
        assert_eq!(without_kind(&mac.contract), without_kind(&windows.contract));
        if mac.contract.contract_type.is_some() {
            assert_eq!(mac.contract.contract_type, windows.contract.contract_type);
        }
        assert_eq!(mac.team.end(), windows.team.end());
        assert_eq!(mac.team.manager, windows.team.manager);
        assert_eq!(mac.club.director_of_football, windows.club.director_of_football);
        // Where a club keeps its nation, and a team its league.
        assert!(windows.club.nation.is_some() && windows.team.competition.is_some());
        assert_eq!(mac.club.nation, windows.club.nation);
        assert_eq!(mac.team.competition, windows.team.competition);
        assert_eq!(mac.club_finance.end(), windows.club_finance.end());
        assert_eq!(
            (mac.ban.list, mac.ban.started, mac.ban.marker, mac.ban.matches),
            (windows.ban.list, windows.ban.started, windows.ban.marker, windows.ban.matches)
        );
        let relation = |l: &Layout| {
            let r = &l.relation;
            (r.target, r.target_kind, r.relation, r.value, r.size)
        };
        assert_eq!(relation(&mac), relation(&windows));
        let stadium = |l: &Layout| {
            let s = l.stadium.as_ref().expect("stadiums");
            (s.team_pointer, s.name, s.capacity, s.seating, s.used, s.expansion, s.owner)
        };
        assert_eq!(stadium(&mac), stadium(&windows));
        // The retirement manager's lists and entries too; a player keeps the game's id 8 bytes into his identity
        // block. The static pointer to the manager is placed by the build profiles.
        let retirement = |l: &Layout| {
            let r = l.retirement.as_ref().expect("planned retirements");
            (r.planned, r.by_person, r.person, r.date, r.player_person - l.player.identity())
        };
        assert_eq!(retirement(&mac), retirement(&windows));
        // The game's count of the saves it loaded: in the same object, at the same place, on both systems (read on the
        // Mac on Steam build 26385295).
        let game =
            |l: &Layout| l.game.as_ref().map(|game| (game.class.clone(), game.loads)).expect("the game's object");
        assert_eq!(game(&windows), ("game_plugin::GAME_UI".to_owned(), 0x100));
        assert_eq!(game(&mac), game(&windows));
        // The game's own allocator, with the same size classes on both systems; the Mac's go on to 4,096 bytes, read
        // from the allocator itself.
        assert!(mac.heap.block_sizes.starts_with(&windows.heap.block_sizes));
        assert_eq!(mac.heap.block_sizes.last(), mac.heap.largest_block.as_ref());
        assert_eq!(mac.heap.largest_block, windows.heap.largest_block);
    }

    #[test]
    fn fingerprints_parse() {
        let pe: PluginFingerprint = toml::from_str("size_of_image = 0x10\nlink_timestamp = 0x20").expect("PE");
        assert_eq!(pe, PluginFingerprint::Pe { size_of_image: 0x10, link_timestamp: 0x20 });
        let mach_o: PluginFingerprint =
            toml::from_str(r#"uuid = "9E8E47DE-F704-314C-917D-C32D12637678""#).expect("Mach-O");
        assert_eq!(mach_o.to_string(), "UUID 9E8E47DE-F704-314C-917D-C32D12637678");
        assert!(toml::from_str::<PluginFingerprint>(r#"uuid = "9E8E47DE-F704""#).is_err());
        assert!(toml::from_str::<PluginFingerprint>("size_of_image = 1\nlink_timestamp = 2\nuuid = 3").is_err());
    }

    #[test]
    fn a_grown_list_gets_a_block_the_game_can_hand_out_again() {
        let windows: Layout = parse(WINDOWS);
        let mac: Layout = parse(MACOS);
        // Within the classes listed, the class: 20 pointers and room for 3 more in 192 bytes.
        assert_eq!(windows.heap.grown_block(23 * 8), Some(192));
        assert_eq!(mac.heap.grown_block(23 * 8), Some(192));
        // Past Windows' 512, a power of two, at least the class the Mac reads (75 pointers: 600 bytes, a class of 640).
        assert_eq!(windows.heap.grown_block(600), Some(1024));
        assert_eq!(mac.heap.grown_block(600), Some(640));
        for bytes in (520..=4096).step_by(8) {
            let class = mac.heap.grown_block(bytes).expect("a class");
            assert!(windows.heap.grown_block(bytes).expect("a block") >= class, "{bytes}");
        }
        // Below the first class, its own size; past the largest block, none.
        assert_eq!(windows.heap.grown_block(96), Some(96));
        assert_eq!(windows.heap.grown_block(4104), None);
        assert_eq!(mac.heap.grown_block(4104), None);
    }

    #[test]
    fn built_in_profiles_parse() {
        assert!(layout_for(27).is_some());
        let layout: Layout = parse(WINDOWS);
        assert_eq!(layout.player.uid, 0x294);
        assert_eq!(layout.player.at(layout.player.uid, 0xF8), 0x38C);
        assert_eq!(layout.player.at(layout.player.team, 0xF8), 0x130);

        // Lists measured on the test save: 19 pointers in 160 bytes, 29 in 256, 33 to 36 in 288, 41 in 384.
        assert_eq!(layout.heap.block_size(19 * 8), Some(160));
        assert_eq!(layout.heap.block_size(29 * 8), Some(256));
        assert_eq!(layout.heap.block_size(33 * 8), Some(288));
        assert_eq!(layout.heap.block_size(36 * 8), Some(288));
        assert_eq!(layout.heap.block_size(41 * 8), Some(384));
        assert_eq!(layout.heap.block_size(18 * 8), None);
        assert_eq!(layout.heap.block_size(65 * 8), None);

        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1943_6000, link_timestamp: 0x6ADF_B161 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2355.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.arrays.players, 0x568_1DC0);
        assert_eq!(profile.edition, layout.edition);
        // The static pointer to the retirement manager, 0xED60 before the players pair on this build.
        assert_eq!(profile.retirement_manager, Some(0x567_3060));

        // The Game Pass update of November 2026: everything 0x2000 further, and the in-game date apart from the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x175D_A000, link_timestamp: 0x6AE5_63A1 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2409.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.package_version.as_deref(), Some("0.9.2409.0"));
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x568_3DC0, 0x568_3E08, 0x568_3F78)
        );
        assert_eq!(profile.current_date, Some(0x562_57C8));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xED60));
        // The static pointer to the game's own object, as far from the players pair as on Steam.
        assert_eq!(profile.game_ui, Some(profile.arrays.players - 0x3C80));

        // The full release on Game Pass (0.9.2435.0): the statics no longer quite as far from each other as before.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1796_9000, link_timestamp: 0x6AE8_CF77 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2435.0 profile");
        assert_eq!(profile.storefront, Storefront::GamePass);
        assert_eq!(profile.package_version.as_deref(), Some("0.9.2435.0"));
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x53B_7DE0, 0x53B_7E28, 0x53B_7F98)
        );
        assert_eq!(profile.current_date, Some(0x535_97C8));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xED70));
        // The managers of tactics and of training, for Max tactics: the first 0xD0 after the retirement manager's on
        // both storefronts, the second not as far from it on each.
        assert_eq!((profile.tactics_manager, profile.training_manager), (Some(0x53A_9140), Some(0x53A_5700)));
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x17CB_9000, link_timestamp: 0x6AE8_B5A4 };
        let steam = profile_for(fingerprint).expect("Steam build 26385295 profile");
        assert_eq!((steam.tactics_manager, steam.training_manager), (Some(0x581_2E20), Some(0x580_F3F0)));
        assert_eq!(steam.tactics_manager, steam.retirement_manager.map(|rva| rva + 0xD0));
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x185F_A000, link_timestamp: 0x6AF3_8E5C };
        let update = profile_for(fingerprint).expect("Steam build 26577676 profile");
        assert_eq!((update.tactics_manager, update.training_manager), (steam.tactics_manager, steam.training_manager));

        // The update of 17 November 2026 on Game Pass (0.9.2524.0): the statics moved again, and the retirement
        // manager's no longer sits as far from the players pair, nor the game's own object's; the tactics manager's
        // is still 0xD0 after the retirement manager's.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x179A_D000, link_timestamp: 0x6AF5_C8C6 };
        let profile = profile_for(fingerprint).expect("Game Pass 0.9.2524.0 profile");
        assert_eq!(
            (profile.storefront, profile.package_version.as_deref()),
            (Storefront::GamePass, Some("0.9.2524.0"))
        );
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x53F_AE88, 0x53F_AED0, 0x53F_B040)
        );
        assert_eq!(profile.current_date, Some(0x539_DD10));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xD2E8));
        assert_eq!(profile.game_ui, Some(profile.arrays.players + 0xBB8));
        assert_eq!(profile.tactics_manager, profile.retirement_manager.map(|rva| rva + 0xD0));
        assert_eq!(profile.training_manager, Some(0x53E_A210));
        let national = profile.national_teams.expect("the national teams' arrays");
        assert_eq!((national.men, national.women), (profile.arrays.players + 0xA8, profile.arrays.players + 0xC0));
        // The same update on Steam (build 26620374): the game's own object as far from the players pair, the
        // retirement manager not.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1887_8000, link_timestamp: 0x6AF5_C68F };
        let steam = profile_for(fingerprint).expect("Steam build 26620374 profile");
        assert_eq!((steam.storefront, steam.package_version.as_deref()), (Storefront::Steam, None));
        assert_eq!(
            (steam.arrays.players, steam.arrays.staff, steam.arrays.clubs),
            (0x587_B8B8, 0x587_B900, 0x587_BA70)
        );
        assert_eq!(steam.current_date, Some(0x582_68E0));
        assert_eq!(steam.retirement_manager, Some(steam.arrays.players - 0xC068));
        assert_eq!(steam.game_ui, Some(steam.arrays.players + 0xBB8));
        assert_eq!(steam.tactics_manager, steam.retirement_manager.map(|rva| rva + 0xD0));
        assert_eq!(steam.training_manager, Some(0x586_BED0));
        let national = steam.national_teams.expect("the national teams' arrays");
        assert_eq!((national.men, national.women), (steam.arrays.players + 0xA8, steam.arrays.players + 0xC0));

        // The update of 24 November 2026 on Game Pass (0.9.2562.0): every static 0x1FE0 back from 0.9.2524.0's, each
        // as far from the players pair as there but the training manager's, 8 bytes further back.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1762_4000, link_timestamp: 0x6AFF_583B };
        let update = profile_for(fingerprint).expect("Game Pass 0.9.2562.0 profile");
        assert_eq!((update.storefront, update.package_version.as_deref()), (Storefront::GamePass, Some("0.9.2562.0")));
        assert_eq!(profile.arrays.players - update.arrays.players, 0x1FE0);
        assert_eq!(
            (update.arrays.staff, update.arrays.clubs),
            (update.arrays.players + 0x48, update.arrays.players + 0x1B8)
        );
        assert_eq!(update.current_date, Some(0x539_BD10));
        assert_eq!(update.retirement_manager, Some(update.arrays.players - 0xD2E8));
        assert_eq!(update.game_ui, Some(update.arrays.players + 0xBB8));
        assert_eq!(update.tactics_manager, update.retirement_manager.map(|rva| rva + 0xD0));
        assert_eq!(update.training_manager, Some(0x53E_8228));
        let national = update.national_teams.expect("the national teams' arrays");
        assert_eq!((national.men, national.women), (update.arrays.players + 0xA8, update.arrays.players + 0xC0));
        assert_eq!(update.layout, profile.layout);
        // The same update on Steam (build 26797085): the arrays, the date, the game's own object and the national
        // teams where build 26620374 keeps them, the retirement manager's static (and the tactics manager's with it)
        // 0x20 further on, the training manager's 0x18.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1849_A000, link_timestamp: 0x6AFF_57A2 };
        let update = profile_for(fingerprint).expect("Steam build 26797085 profile");
        assert_eq!((update.storefront, update.package_version.as_deref()), (Storefront::Steam, None));
        assert_eq!(
            (update.arrays, update.current_date, update.game_ui, update.national_teams),
            (steam.arrays, steam.current_date, steam.game_ui, steam.national_teams)
        );
        assert_eq!(update.retirement_manager, steam.retirement_manager.map(|rva| rva + 0x20));
        assert_eq!(update.tactics_manager, update.retirement_manager.map(|rva| rva + 0xD0));
        assert_eq!(update.training_manager, steam.training_manager.map(|rva| rva + 0x18));
        assert_eq!(update.layout, steam.layout);
        // The Windows layout walks MSVC's maps; the Mac's does not say, and walks libc++'s.
        let familiarity = layout.familiarity.as_ref().expect("the Windows layout places familiarity");
        assert_eq!((familiarity.tree, layout.tactics.as_ref().map(|t| t.tree)), (Tree::Msvc, Some(Tree::Msvc)));

        // The same version on Steam, packaged differently: another fingerprint and other RVAs, the manager's static
        // 0xDAC0 before the players pair.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x19E6_9000, link_timestamp: 0x6ADF_B11C };
        let profile = profile_for(fingerprint).expect("Steam build 26227640 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(profile.arrays.players, 0x570_37D0);
        assert_eq!(profile.edition, layout.edition);
        assert_eq!(profile.retirement_manager, Some(0x56F_5D10));

        // 27.0.0 on Steam (build 26340721): moved as Game Pass 0.9.2409.0 did, the date apart from the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x1821_C000, link_timestamp: 0x6AE5_65AF };
        let profile = profile_for(fingerprint).expect("Steam build 26340721 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x570_57D0, 0x570_5818, 0x570_5988)
        );
        assert_eq!(profile.current_date, Some(0x56A_F378));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xDAC0));
        assert_eq!(profile.game_ui, Some(profile.arrays.players - 0x3C80));

        // 27.0.1 on Steam (build 26385295), the full release: every static 0x11B040 further than in build 26340721.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x17CB_9000, link_timestamp: 0x6AE8_B5A4 };
        let profile = profile_for(fingerprint).expect("Steam build 26385295 profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x570_57D0 + 0x11_B040, 0x570_5818 + 0x11_B040, 0x570_5988 + 0x11_B040)
        );
        assert_eq!(profile.current_date, Some(0x56A_F378 + 0x11_B040));
        assert_eq!(profile.retirement_manager, Some(profile.arrays.players - 0xDAC0));

        // The update of 12 November 2026 (build 26577676): another image, every static where 26385295 keeps it.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x185F_A000, link_timestamp: 0x6AF3_8E5C };
        let update = profile_for(fingerprint).expect("Steam build 26577676 profile");
        assert_eq!(update.storefront, Storefront::Steam);
        assert_eq!(update.arrays, profile.arrays);
        assert_eq!(
            (update.current_date, update.retirement_manager, update.game_ui),
            (profile.current_date, profile.retirement_manager, profile.game_ui)
        );

        // On macOS, the Intel half of the same build: told apart by its LC_UUID.
        let uuid = [0x22, 0xCF, 0xE5, 0xC3, 0xB5, 0xCF, 0x3C, 0x00, 0x80, 0x43, 0x1E, 0xA1, 0x90, 0xA6, 0x9B, 0x89];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("Steam build 26227640 on macOS profile");
        assert_eq!(profile.storefront, Storefront::Steam);
        assert_eq!(profile.arrays.players, 0x5C8_91C8);
        assert_eq!((profile.arrays.staff, profile.arrays.clubs), (0x5C8_9210, 0x5C8_9380));
        assert_eq!(profile.retirement_manager, Some(0x5C5_FEF0));

        // Its arm64 half, which Apple silicon runs natively: other RVAs, and the date apart.
        let uuid = [0x9E, 0x8E, 0x47, 0xDE, 0xF7, 0x04, 0x31, 0x4C, 0x91, 0x7D, 0xC3, 0x2D, 0x12, 0x63, 0x76, 0x78];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("the arm64 half's profile");
        assert_eq!(profile.arrays.players, 0x56D_2E18);
        assert_eq!(profile.current_date, Some(0x56B_1DB8));
        assert_eq!(profile.retirement_manager, Some(0x56A_82A8));

        // 27.0.0 (Steam build 26340721): new UUIDs for both halves, the Launch Preview's RVAs.
        let uuid = [0xF4, 0x54, 0x03, 0x55, 0x21, 0x86, 0x39, 0xCB, 0x91, 0x19, 0xC7, 0x06, 0xA6, 0xA3, 0x53, 0x46];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.0's arm64 half");
        assert_eq!(profile.arrays.players, 0x56D_2E18);
        assert_eq!(profile.current_date, Some(0x56B_1DB8));
        assert_eq!(profile.tactics_manager, Some(0x56A_8310));
        assert_eq!(profile.training_manager, Some(0x56A_5740));
        let uuid = [0x09, 0x81, 0xAB, 0x31, 0xAC, 0x3B, 0x3D, 0x93, 0x94, 0x4F, 0x47, 0xFE, 0x4B, 0x59, 0xCD, 0x9E];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.0's Intel half");
        assert_eq!(profile.arrays.players, 0x5C8_91C8);
        assert_eq!(profile.current_date, Some(0x5C6_9700));

        // 27.0.1 (Steam build 26385295): new UUIDs again, every place moved on with __DATA and the arrays a little more.
        let uuid = [0x2A, 0x2D, 0x0E, 0xD6, 0x32, 0x4E, 0x3D, 0x0D, 0xA2, 0x7D, 0x10, 0xAE, 0xDB, 0xD0, 0xE2, 0x70];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.1's arm64 half");
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x576_EE50, 0x576_EE98, 0x576_F008)
        );
        assert_eq!(profile.current_date, Some(0x574_DDB8));
        assert_eq!(profile.retirement_manager, Some(0x574_42A8));
        assert_eq!(profile.game_ui, Some(0x574_0B60));
        assert_eq!((profile.tactics_manager, profile.training_manager), (Some(0x574_4310), Some(0x574_1740)));
        let uuid = [0x94, 0xCD, 0xDC, 0x80, 0x84, 0x74, 0x32, 0x7A, 0x85, 0xE0, 0xE4, 0xFF, 0x95, 0xDC, 0x68, 0x93];
        let profile = profile_for(PluginFingerprint::MachO { uuid }).expect("27.0.1's Intel half");
        assert_eq!(
            (profile.arrays.players, profile.arrays.staff, profile.arrays.clubs),
            (0x5D0_31E8, 0x5D0_3230, 0x5D0_33A0)
        );
        assert_eq!(profile.current_date, Some(0x5CE_3700));
        assert_eq!(profile.retirement_manager, Some(0x5CD_9EF0));
        assert_eq!(profile.game_ui, Some(0x5D0_4CA8));

        // The update of 12 November 2026 (Steam build 26577676, 27.0.1.2503222): new UUIDs again, but every place, the
        // managers' statics included, where 27.0.1 keeps it, in both halves.
        for (old, new) in [
            (
                [0x2A, 0x2D, 0x0E, 0xD6, 0x32, 0x4E, 0x3D, 0x0D, 0xA2, 0x7D, 0x10, 0xAE, 0xDB, 0xD0, 0xE2, 0x70],
                [0xA8, 0x55, 0x0B, 0x47, 0xFD, 0xE0, 0x3D, 0x0D, 0xA6, 0xCB, 0x1B, 0x63, 0xDE, 0xE8, 0xDA, 0x19],
            ),
            (
                [0x94, 0xCD, 0xDC, 0x80, 0x84, 0x74, 0x32, 0x7A, 0x85, 0xE0, 0xE4, 0xFF, 0x95, 0xDC, 0x68, 0x93],
                [0xDD, 0x0E, 0xE1, 0x57, 0x4C, 0x9C, 0x31, 0xA7, 0x81, 0xDD, 0x0D, 0x11, 0x22, 0xE6, 0x2F, 0xC7],
            ),
        ] {
            let old = profile_for(PluginFingerprint::MachO { uuid: old }).expect("a half of 27.0.1");
            let new = profile_for(PluginFingerprint::MachO { uuid: new }).expect("a half of Steam build 26577676");
            assert_eq!(new.storefront, Storefront::Steam);
            assert_eq!(new.arrays, old.arrays);
            assert_eq!(
                (new.current_date, new.retirement_manager, new.game_ui, new.tactics_manager, new.training_manager),
                (old.current_date, old.retirement_manager, old.game_ui, old.tactics_manager, old.training_manager)
            );
        }

        // The update of 17 November 2026 (Steam build 26620374, 27.1.0.2505117): new UUIDs, and every place moved on
        // with __DATA (0x34000 in the arm64 half, 0x50000 in the Intel one), the date and the retirement manager's
        // static 0x10 more, the arrays 0x178 and 0x180 more.
        let uuid = [0x86, 0x9F, 0x5F, 0x90, 0xFD, 0x89, 0x36, 0x06, 0x8A, 0xE4, 0x2B, 0x4A, 0x7F, 0x02, 0xF3, 0x24];
        let arm = profile_for(PluginFingerprint::MachO { uuid }).expect("the arm64 half of Steam build 26620374");
        assert_eq!((arm.arrays.players, arm.arrays.staff, arm.arrays.clubs), (0x57A_2FC8, 0x57A_3010, 0x57A_3180));
        assert_eq!(arm.current_date, Some(0x578_1DC8));
        assert_eq!(arm.retirement_manager, Some(0x577_82B8));
        assert_eq!(arm.game_ui, Some(0x577_4B60));
        assert_eq!((arm.tactics_manager, arm.training_manager), (Some(0x577_8320), Some(0x577_5758)));
        assert_eq!(arm.tactics_manager, arm.retirement_manager.map(|rva| rva + 0x68));
        let national = arm.national_teams.expect("the national teams' arrays");
        assert_eq!((national.men, national.women), (arm.arrays.players + 0xA8, arm.arrays.players + 0xC0));
        let uuid = [0x86, 0x46, 0x25, 0xAF, 0x9A, 0xA9, 0x32, 0x54, 0x8E, 0xC5, 0x47, 0xE9, 0xD4, 0x86, 0x13, 0x2A];
        let intel = profile_for(PluginFingerprint::MachO { uuid }).expect("the Intel half of Steam build 26620374");
        assert_eq!(
            (intel.arrays.players, intel.arrays.staff, intel.arrays.clubs),
            (0x5D5_3368, 0x5D5_33B0, 0x5D5_3520)
        );
        assert_eq!(intel.current_date, Some(0x5D3_3710));
        assert_eq!(intel.retirement_manager, intel.current_date.map(|rva| rva - 0x9810));
        assert_eq!(intel.game_ui, Some(intel.arrays.players + 0x1AE8));

        // The update of 24 November 2026 (Steam build 26797085, 27.1.1.2511875): new UUIDs, and __DATA moved (0x10000
        // on in the arm64 half, 0x6000 back in the Intel one). The arm64 half keeps the date, the retirement manager's
        // static and the game's own object where they were in __DATA, and the arrays 0x10 back; the Intel half keeps
        // the date and the static 0x20 back, the arrays and the game's own object 0x30. Each still sits from the
        // others as before, and the objects are laid out as in build 26620374.
        let uuid = [0xF5, 0x3E, 0xAD, 0x40, 0xBD, 0x51, 0x30, 0x7F, 0x9B, 0xD8, 0xBA, 0x24, 0x57, 0x7B, 0xF2, 0xAF];
        let new_arm = profile_for(PluginFingerprint::MachO { uuid }).expect("the arm64 half of Steam build 26797085");
        assert_eq!(
            (new_arm.arrays.players, new_arm.arrays.staff, new_arm.arrays.clubs),
            (0x57B_2FB8, 0x57B_3000, 0x57B_3170)
        );
        let moved = |rva: Option<u64>| rva.map(|rva| rva + 0x1_0000);
        assert_eq!(new_arm.current_date, moved(arm.current_date));
        assert_eq!(new_arm.retirement_manager, moved(arm.retirement_manager));
        assert_eq!(new_arm.game_ui, moved(arm.game_ui));
        assert_eq!(new_arm.tactics_manager, moved(arm.tactics_manager));
        assert_eq!(new_arm.training_manager, moved(arm.training_manager));
        let national = new_arm.national_teams.expect("the national teams' arrays");
        assert_eq!((national.men, national.women), (new_arm.arrays.players + 0xA8, new_arm.arrays.players + 0xC0));
        assert_eq!((new_arm.prize_money, new_arm.squad_rules), (true, true));
        assert_eq!(new_arm.layout, arm.layout);
        let uuid = [0xD1, 0xD8, 0x1C, 0x1A, 0x44, 0xAD, 0x33, 0x42, 0xB6, 0xD4, 0xB8, 0xDD, 0xF2, 0xEA, 0x6B, 0x61];
        let new_intel = profile_for(PluginFingerprint::MachO { uuid }).expect("the Intel half of Steam build 26797085");
        assert_eq!(
            (new_intel.arrays.players, new_intel.arrays.staff, new_intel.arrays.clubs),
            (0x5D4_D338, 0x5D4_D380, 0x5D4_D4F0)
        );
        assert_eq!(new_intel.current_date, Some(0x5D2_D6F0));
        assert_eq!(new_intel.retirement_manager, new_intel.current_date.map(|rva| rva - 0x9810));
        assert_eq!(new_intel.game_ui, Some(new_intel.arrays.players + 0x1AE8));
        assert_eq!(new_intel.layout, intel.layout);

        // On Windows the Launch Preview's date sits with the arrays.
        let fingerprint = PluginFingerprint::Pe { size_of_image: 0x19E6_9000, link_timestamp: 0x6ADF_B11C };
        assert_eq!(profile_for(fingerprint).and_then(|profile| profile.current_date), None);

        // The builds of November 2026 on Windows and those since 27.0.1 on the Mac place the game's own object; on the
        // others the editor looks for it as far from the players pair as there, or else for a pointer to it.
        let placed: Vec<String> =
            built_in_profiles().filter(|profile| profile.game_ui.is_some()).map(|profile| profile.name).collect();
        assert_eq!(
            placed,
            [
                "FM27 0.9.2409.0 (Game Pass)",
                "FM27 0.9.2435.0 (Game Pass)",
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26340721 (27.0.0)",
                "FM27 Steam build 26385295 (27.0.1)",
                "FM27 Steam build 26577676",
                "FM27 Steam build 26620374",
                "FM27 Steam build 26797085",
                "FM27 Steam build 26385295 (27.0.1, macOS, Intel)",
                "FM27 Steam build 26385295 (27.0.1, macOS, Apple silicon)",
                "FM27 Steam build 26577676 (macOS, Intel)",
                "FM27 Steam build 26577676 (macOS, Apple silicon)",
                "FM27 Steam build 26620374 (macOS, Intel)",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085 (macOS, Intel)",
                "FM27 Steam build 26797085 (macOS, Apple silicon)",
                "FM27 (Epic Games Store)",
            ]
        );
    }

    /// A profile file left out of [`BUILDS`] would leave its build unknown to the editor.
    #[test]
    fn every_profile_file_is_built_in() {
        let folder = concat!(env!("CARGO_MANIFEST_DIR"), "/../../profiles/fm27");
        let mut files = 0;
        for entry in std::fs::read_dir(folder).expect("the profiles folder") {
            let path = entry.expect("a file of the profiles folder").path();
            let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
            if !name.ends_with(".toml") || name.starts_with("layout") {
                continue;
            }
            let text = std::fs::read_to_string(&path).expect("a profile file");
            assert!(BUILDS.contains(&text.as_str()), "{name} is not built in: add it to BUILDS in profile.rs");
            files += 1;
        }
        assert_eq!(files, BUILDS.len());
        // One profile per build, each for an edition with a layout.
        let profiles: Vec<BuildProfile> = built_in_profiles().collect();
        for (i, profile) in profiles.iter().enumerate() {
            assert!(profiles[i + 1..].iter().all(|other| other.plugin != profile.plugin), "{} twice", profile.name);
            assert_eq!(profile.edition, 27, "{}", profile.name);
        }
    }

    /// The Epic build of an update is the Steam build's code under another fingerprint: on 27.1.0 every place the probe
    /// found on Epic is where Steam build 26620374 keeps it. So an Epic profile keeps all that the profile of the Steam
    /// build on Windows with the same arrays keeps, and what is added to that one later has to be added to it too.
    #[test]
    fn epic_profiles_keep_what_their_steam_twin_keeps() {
        let profiles: Vec<BuildProfile> = built_in_profiles().collect();
        let windows = |profile: &BuildProfile| matches!(profile.plugin, PluginFingerprint::Pe { .. });
        let epics: Vec<&BuildProfile> =
            profiles.iter().filter(|profile| profile.storefront == Storefront::Epic).collect();
        assert!(!epics.is_empty(), "an Epic profile");
        for epic in epics {
            let twin = profiles
                .iter()
                .find(|other| other.storefront == Storefront::Steam && windows(other) && other.arrays == epic.arrays)
                .unwrap_or_else(|| panic!("{}: no Steam build on Windows keeps the arrays where it does", epic.name));
            let as_twin = BuildProfile {
                name: twin.name.clone(),
                storefront: twin.storefront,
                plugin: twin.plugin,
                ..epic.clone()
            };
            assert_eq!(&as_twin, twin, "{} keeps otherwise than {}", epic.name, twin.name);
        }
    }

    /// The app shows the prize money only on the builds it was read and checked on (#123): no others until someone has.
    #[test]
    fn prize_money_is_shown_only_on_the_builds_it_was_checked_on() {
        let mut checked: Vec<String> =
            built_in_profiles().filter(|profile| profile.prize_money).map(|profile| profile.name).collect();
        checked.sort();
        assert_eq!(
            checked,
            [
                "FM27 (Epic Games Store)",
                "FM27 0.9.2409.0 (Game Pass)",
                "FM27 0.9.2435.0 (Game Pass)",
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26340721 (27.0.0)",
                "FM27 Steam build 26340721 (27.0.0, macOS, Apple silicon)",
                "FM27 Steam build 26385295 (27.0.1, macOS, Apple silicon)",
                "FM27 Steam build 26577676",
                "FM27 Steam build 26620374",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085",
                "FM27 Steam build 26797085 (macOS, Apple silicon)",
            ]
        );
    }

    /// The app shows a club's sponsorship deals only on the builds they were read on (#114): the Windows build the
    /// issue's reports are from, the three Mac builds they were matched to the game's screen on, Game Pass 0.9.2524.0,
    /// where the deals of 90 clubs were read, 0.9.2562.0, which reads them as 0.9.2524.0 does, and Steam build
    /// 26797085 on Windows, the same FM 27.1.1, matched to the game's screen.
    #[test]
    fn sponsorships_are_shown_only_on_the_builds_they_were_checked_on() {
        let mut checked: Vec<String> =
            built_in_profiles().filter(|profile| profile.sponsorships).map(|profile| profile.name).collect();
        checked.sort();
        assert_eq!(
            checked,
            [
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26340721 (27.0.0)",
                "FM27 Steam build 26385295 (27.0.1, macOS, Apple silicon)",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085",
                "FM27 Steam build 26797085 (macOS, Apple silicon)"
            ]
        );
        assert!(layout_for(27).is_some_and(|layout| layout.sponsorship.is_some()));
    }

    /// The app shows the competitions' squad rules only on the builds they were read on and matched to the game's
    /// screens: Game Pass 0.9.2524.0, where the Süper Lig's were changed and seen in the game, and the Apple silicon
    /// half of Steam build 26620374, where the Premier League's were, and of build 26797085, where they read the same
    /// on the same save. The Intel halves were not run. Game Pass 0.9.2562.0 read the same save's rules as 0.9.2524.0
    /// did, and Steam build 26797085 on Windows, the same FM 27.1.1, was matched to the game's screens.
    #[test]
    fn squad_rules_are_shown_only_on_the_builds_they_were_checked_on() {
        let checked: Vec<String> =
            built_in_profiles().filter(|profile| profile.squad_rules).map(|profile| profile.name).collect();
        assert_eq!(
            checked,
            [
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26797085",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085 (macOS, Apple silicon)"
            ]
        );
    }

    /// Since the update of 17 November 2026 the club finance record keeps corporate facilities 4 bytes further on, and a
    /// team's tactics their list and the index of the one in use 8 bytes further on: the profiles of its builds say
    /// so, and the layout of a session over one of them has them there; every other build keeps the layout's places,
    /// and nothing else moves.
    #[test]
    fn builds_lay_out_what_their_profiles_say() {
        let layout = layout_for(27).expect("FM27 layout");
        let tactics = layout.tactics.as_ref().expect("the layout places the tactics");
        // A profile's offsets are its layout's: Windows builds' are layout.toml's, the Mac halves' layout-macos.toml's.
        let windows = |profile: &BuildProfile| matches!(profile.plugin, PluginFingerprint::Pe { .. });
        let moved = |on_windows: bool| -> Vec<String> {
            built_in_profiles()
                .filter(|profile| !profile.layout.is_empty() && windows(profile) == on_windows)
                .map(|profile| profile.name)
                .collect()
        };
        assert_eq!(
            moved(true),
            [
                "FM27 0.9.2524.0 (Game Pass)",
                "FM27 0.9.2562.0 (Game Pass)",
                "FM27 Steam build 26620374",
                "FM27 Steam build 26797085",
                "FM27 (Epic Games Store)"
            ]
        );
        assert_eq!(
            moved(false),
            [
                "FM27 Steam build 26620374 (macOS, Intel)",
                "FM27 Steam build 26620374 (macOS, Apple silicon)",
                "FM27 Steam build 26797085 (macOS, Intel)",
                "FM27 Steam build 26797085 (macOS, Apple silicon)"
            ]
        );
        for profile in built_in_profiles() {
            let laid = layout_of(27, &profile.layout).expect("FM27 layout");
            let moved = |section: &str, field: &str| profile.layout.0.get(section).and_then(|fields| fields.get(field));
            let at = |section: &str, field: &str, otherwise: u64| moved(section, field).copied().unwrap_or(otherwise);
            assert_eq!(
                laid.club_finance.corporate,
                at("club_finance", "corporate", layout.club_finance.corporate),
                "{}",
                profile.name
            );
            let laid_tactics = laid.tactics.as_ref().expect("the layout places the tactics");
            assert_eq!(
                (laid_tactics.tactics, laid_tactics.current, laid_tactics.instructions),
                (
                    at("tactics", "tactics", tactics.tactics),
                    at("tactics", "current", tactics.current),
                    tactics.instructions
                ),
                "{}",
                profile.name
            );
            let (f, g) = (&laid.club_finance, &layout.club_finance);
            assert_eq!(
                (f.balance, f.transfer_budget, f.total_wage_budget, f.wage_budget, f.ticket_price),
                (g.balance, g.transfer_budget, g.total_wage_budget, g.wage_budget, g.ticket_price),
                "{}",
                profile.name
            );
        }
        // On Windows: the new builds' places, 4 and 8 bytes past the old ones.
        #[cfg(windows)]
        for profile in built_in_profiles().filter(|profile| !profile.layout.is_empty() && windows(profile)) {
            let laid = layout_of(27, &profile.layout).expect("FM27 layout");
            let laid_tactics = laid.tactics.expect("the layout places the tactics");
            assert_eq!(laid.club_finance.corporate, 0x8AD, "{}", profile.name);
            assert_eq!((laid_tactics.tactics, laid_tactics.current), (0x1018, 0x1030), "{}", profile.name);
            assert_eq!((layout.club_finance.corporate, tactics.tactics, tactics.current), (0x8A9, 0x1010, 0x1028));
        }
        // On macOS: the Mac halves of the same update, as many bytes past the Mac layout's places.
        #[cfg(target_os = "macos")]
        for profile in built_in_profiles().filter(|profile| !profile.layout.is_empty() && !windows(profile)) {
            let laid = layout_of(27, &profile.layout).expect("FM27 layout");
            let laid_tactics = laid.tactics.expect("the layout places the tactics");
            assert_eq!(laid.club_finance.corporate, 0x8AD, "{}", profile.name);
            assert_eq!((laid_tactics.tactics, laid_tactics.current), (0x1008, 0x1020), "{}", profile.name);
            assert_eq!((layout.club_finance.corporate, tactics.tactics, tactics.current), (0x8A9, 0x1000, 0x1018));
        }
    }

    /// A build without a profile reads its objects as the newest build of its kind lays them out: the latest linked on
    /// Windows, of its own storefront where it has one, and the last listed on the Mac; never as its own profile, so
    /// that ignoring the profiles rehearses an update.
    #[test]
    fn a_build_without_a_profile_borrows_the_newest_layout_of_its_kind() {
        let base = built_in_profiles().next().expect("a profile");
        let fake =
            |name: &str, storefront, plugin| BuildProfile { name: name.to_owned(), storefront, plugin, ..base.clone() };
        let pe = |link_timestamp| PluginFingerprint::Pe { size_of_image: 0x1000, link_timestamp };
        let mac = |byte| PluginFingerprint::MachO { uuid: [byte; 16] };
        let profiles = [
            fake("old Steam", Storefront::Steam, pe(10)),
            fake("new Game Pass", Storefront::GamePass, pe(30)),
            fake("new Steam", Storefront::Steam, pe(20)),
            fake("new Mac", Storefront::Steam, mac(1)),
            fake("newer Mac", Storefront::Steam, mac(0)),
        ];
        let lender = |edition, plugin, storefront| {
            layout_lender(edition, plugin, storefront, profiles.iter().cloned()).map(|profile| profile.name)
        };
        // The newest of its storefront, though another storefront's was linked later.
        assert_eq!(lender(27, pe(40), Storefront::Steam).as_deref(), Some("new Steam"));
        assert_eq!(lender(27, pe(40), Storefront::GamePass).as_deref(), Some("new Game Pass"));
        // For a storefront no profile is for, the latest linked of all.
        assert_eq!(lender(27, pe(40), Storefront::Epic).as_deref(), Some("new Game Pass"));
        // Never its own: with its profile ignored, the build before it.
        assert_eq!(lender(27, pe(20), Storefront::Steam).as_deref(), Some("old Steam"));
        // On the Mac the last listed, whatever its UUID, and never a Windows build.
        assert_eq!(lender(27, mac(9), Storefront::Steam).as_deref(), Some("newer Mac"));
        assert_eq!(lender(27, mac(0), Storefront::Steam).as_deref(), Some("new Mac"));
        // Nor one of another edition, whose layout is another.
        assert_eq!(lender(28, pe(40), Storefront::Steam), None);
        assert_eq!(layout_lender(27, mac(9), Storefront::Steam, profiles[..3].iter().cloned()), None);

        // The built-in profiles: a new build on any storefront reads its objects as the update of 17 November 2026 laid
        // them out, and as its builds and those since lay them out (see `builds_lay_out_what_their_profiles_say`).
        let moved = |profile: &BuildProfile, section: &str, field: &str| {
            profile.layout.0.get(section).and_then(|fields| fields.get(field)).copied()
        };
        let places = |profile: &BuildProfile| {
            (
                moved(profile, "club_finance", "corporate"),
                moved(profile, "tactics", "tactics"),
                moved(profile, "tactics", "current"),
            )
        };
        let new_pe = PluginFingerprint::Pe { size_of_image: 0, link_timestamp: u32::MAX };
        for storefront in [Storefront::GamePass, Storefront::Steam, Storefront::Epic, Storefront::Unknown] {
            let lent = layout_lender(27, new_pe, storefront, built_in_profiles()).expect("a Windows profile");
            assert!(
                storefront == Storefront::Unknown || lent.storefront == storefront,
                "{storefront:?}: {}",
                lent.name
            );
            assert_eq!(places(&lent), (Some(0x8AD), Some(0x1018), Some(0x1030)), "{storefront:?}: {}", lent.name);
        }
        let new_mac = PluginFingerprint::MachO { uuid: [0; 16] };
        let lent = layout_lender(27, new_mac, Storefront::Steam, built_in_profiles()).expect("a Mac profile");
        assert_eq!(places(&lent), (Some(0x8AD), Some(0x1008), Some(0x1020)), "{}", lent.name);
    }

    /// A Mach-O fingerprint holds no time, so [`layout_lender`] takes the Mac build listed last for the newest: BUILDS
    /// lists the Mac builds in the order they came out, by their Steam build numbers. The two halves of a build lay out
    /// their objects alike, with one layout file, so whichever of them is listed last lends the same.
    #[test]
    fn mac_builds_are_listed_in_the_order_they_came_out() {
        let mac: Vec<BuildProfile> =
            built_in_profiles().filter(|profile| matches!(profile.plugin, PluginFingerprint::MachO { .. })).collect();
        let build = |profile: &BuildProfile| -> u32 {
            let number = profile.name.split("Steam build ").nth(1).and_then(|rest| rest.split(' ').next());
            number.and_then(|number| number.parse().ok()).unwrap_or_else(|| panic!("{}: no Steam build", profile.name))
        };
        let names: Vec<&str> = mac.iter().map(|profile| profile.name.as_str()).collect();
        assert!(mac.windows(2).all(|pair| build(&pair[0]) <= build(&pair[1])), "{names:?}");
        for pair in mac.windows(2).filter(|pair| build(&pair[0]) == build(&pair[1])) {
            assert_eq!(pair[0].layout, pair[1].layout, "{} and {}", pair[0].name, pair[1].name);
        }
    }

    /// What a profile's `[layout.*]` may name: the fields a check guards, so that a build without a profile, which
    /// borrows them ([`layout_lender`]), leaves them unread where its update moved them again, rather than read wrong
    /// (see [`LayoutOverrides`]). Add one here only with such a check, and say in docs/DEVELOPING.md which it is.
    #[test]
    fn every_override_is_a_field_a_check_guards() {
        // The field, and what keeps it from being read from the wrong place.
        const GUARDED: [(&str, &str, &str); 3] = [
            ("club_finance", "corporate", "finances_look_real: the whole record looks real, corporate facilities 1-20"),
            (
                "tactics",
                "tactics",
                "Session::tactic_in_use: the list of a PREPARED_TACTICS_CREATOR_ARRAY, by its vtable",
            ),
            ("tactics", "current", "Session::tactic_in_use: within that list, as far after it as the class keeps it"),
        ];
        for profile in built_in_profiles() {
            for (section, fields) in &profile.layout.0 {
                for field in fields.keys() {
                    let guarded = GUARDED.iter().any(|&(s, f, _)| s == section && f == field);
                    assert!(guarded, "{}: [layout.{section}] {field} has no check that guards it", profile.name);
                }
            }
        }
    }

    /// The index of the tactic in use is the `simatch::PREPARED_TACTICS_CREATOR_ARRAY`'s own, 0x18 after its list,
    /// which starts 8 bytes into the object, after its vtable, as in a selection: so in both layouts, and as every profile
    /// moves them. An override moves both or neither, and the class found before the list vouches for the index too.
    #[test]
    fn the_tactic_in_use_is_indexed_beside_its_list() {
        for text in [WINDOWS, MACOS] {
            let layout: Layout = parse(text);
            let tactics = layout.tactics.expect("the layout places the tactics");
            assert_eq!(tactics.current, tactics.tactics + 0x18);
            assert_eq!(layout.selection.expect("the layout places the selections").list, 8);
        }
        for profile in built_in_profiles() {
            if let Some(fields) = profile.layout.0.get("tactics") {
                let (list, index) = (fields.get("tactics").copied(), fields.get("current").copied());
                assert_eq!(index, list.map(|list| list + 0x18), "{}", profile.name);
            }
        }
    }

    #[test]
    fn profile_text_reads_back() {
        let notes = ProfileNotes {
            header: vec!["FM27 Steam build 1 \"test\"".to_owned()],
            current_date: vec!["13 August 2027 on the save.".to_owned()],
            retirement_manager: vec!["0xDAC0 before the players pair.".to_owned()],
            game_ui: vec!["0x3C80 before the players pair.".to_owned()],
        };
        for profile in built_in_profiles() {
            let text = profile_text(&profile, &notes);
            let read: BuildProfile = toml::from_str(&text).unwrap_or_else(|err| panic!("{text}\n{err}"));
            assert_eq!(read, profile);
        }
        let steam = profile_for(PluginFingerprint::Pe { size_of_image: 0x1821_C000, link_timestamp: 0x6AE5_65AF })
            .expect("Steam build 26340721");
        let text = profile_text(&steam, &notes);
        assert!(text.starts_with("# FM27 Steam build 1 \"test\"\nname = \"FM27 Steam build 26340721 (27.0.0)\"\n"));
        assert!(text.contains("# 13 August 2027 on the save.\ncurrent_date = 0x56AF378\n"), "{text}");
        assert!(text.contains("# 0x3C80 before the players pair.\ngame_ui = 0x5701B50\n"), "{text}");
        assert!(text.contains("\n[plugin]\nsize_of_image = 0x1821C000\nlink_timestamp = 0x6AE565AF\n"), "{text}");
        assert!(text.ends_with("[arrays]\nplayers = 0x57057D0\nstaff = 0x5705818\nclubs = 0x5705988\n"), "{text}");
    }
}
