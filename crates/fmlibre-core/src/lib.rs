//! Football Manager specific logic shared by the probe and the app: recognising a
//! running game, locating its entity arrays, decoding what they hold and changing it.

#![cfg(any(windows, target_os = "macos"))]

mod arranged;
#[cfg(target_os = "macos")]
pub mod bridge_setup;
mod calibrate;
mod clauses;
mod clubs;
mod coded;
mod cohesion;
mod concerns;
mod date;
mod details;
mod diagnostics;
mod edit;
mod export;
mod familiarity;
mod filter;
mod game;
mod graphics;
mod health;
mod heap;
mod index;
mod loans;
mod locate;
mod mass;
mod medical;
mod names;
mod national;
mod object_pool;
mod own_memory;
mod players;
mod prize_money;
mod profile;
mod recipes;
mod records;
mod relations;
mod retirement;
pub mod rtti;
mod rules;
mod scan;
mod scout_lists;
mod scouting;
mod selection;
mod session;
mod signing;
mod sponsorship;
mod squad;
mod squad_report;
mod stadium_name;
mod staff;
mod staff_move;
mod tactical_areas;
mod text;
mod timeline;
mod transfer;
mod tree;
mod youth_intake;

pub use arranged::{Arranged, ArrangedPlan, LoanDeal, season_loan_end};
pub use calibrate::{ArrayRef, EntityArrays, calibrate};
pub use clauses::{
    ClausePlan, ClauseSet, MOST_CLAUSE_AMOUNT, MOST_CLAUSE_CONDITION, RELEASE_CLAUSE, RELEASE_CLAUSES,
    release_clause_expiry, release_clause_never_expires,
};
pub use clubs::{
    ClubDetails, ClubIndex, ClubSummary, Finances, League, SUPPORTER_MIX, SUPPORTER_TRAITS, leagues, read_club_details,
    read_clubs,
};
pub use coded::Coded;
pub use cohesion::{COHESION_RANGE, CohesionPlan, CohesionSet};
pub use concerns::{ABOUT_A_TEAMMATE, People};
pub use date::FmDate;
pub use details::{
    ATTRIBUTE_GROUPS, Attribute, Clause, Concern, ConcernSubject, Contract, International, PERSONALITY, POSITIONS,
    PlayerDetails, Reputation, read_player_details,
};
pub use diagnostics::{date_line, diagnostics_report, layout_line, manager_line, retirement_line, saves_loaded_line};
pub use edit::{
    Change, EditError, Entity, Field, Kind, LOAN_EXPIRES, LOAN_OPTION_FEE, Scale, Target, YOUTH_RATING, fields,
};
pub use export::{ChangeRow, ExportFormat, ExportHeader, Exported, export_changes};
pub use familiarity::{Familiarity, TacticsPlan, TacticsSet, TrainingHistory};
pub use filter::{
    AttributeBound, ClubFilter, PlayerFilter, PlayerOrder, PlayerSort, StaffFilter, StaffOrder, StaffSort,
    sort_players, sort_staff,
};
pub use game::{GAME_EXE, GAME_PLUGIN, GameInfo, Storefront};
pub use graphics::{GraphicsCounts, GraphicsIndex, Picture};
pub use health::{Check, CheckResult, DateEvidence, DateFit, Health, Lock, STRUCTURE};
pub use index::{Listed, SearchIndex};
pub use loans::{LoanDetails, LoanEnd, LoanTerms};
pub use locate::{
    DatePlace, Found, Manager, NEAR_GUESS, Place, date_candidates, date_guesses, game_ui_guesses, holds_game_ui,
    holds_manager, holds_retirement_manager, manager_guesses, retirement_guesses, search_game_ui, search_manager,
    search_retirement_manager,
};
pub use mass::{Operation, Plan, Planned, Skipped};
pub use medical::{Ban, HealPlan, Healed, Injury, LiftPlan, Lifted};
pub use names::{LONGEST_PERSON_NAME, NameChange, NameKind, PersonNames};
pub use national::{
    FederationMember, NationDetails, NationalIndex, NationalSide, NationalTeamSummary, NationalUnavailable,
    OTHER_KINDS, SENIOR_KIND,
};
pub use object_pool::ObjectPool;
pub use players::{Nation, PLAYABLE_RATING, PlayerIndex, PlayerSummary, is_woman, nations, read_players};
pub use prize_money::{
    Competition, CompetitionPrizes, MOST_PRIZE, PrizeAmount, PrizeChange, PrizeEdit, PrizeError, PrizeMoney,
    PrizeReadError, PrizeStage, PrizeUnavailable, StagePrizes, competition_prizes,
};
pub use profile::{
    ArrayRvas, BuildProfile, ContractLayout, GameLayout, Layout, LayoutOverrides, PlayerLayout, PluginFingerprint,
    ProfileNotes, SelectionLayout, StaffLayout, TacticLayout, TacticsLayout, built_in_profiles, layout_for,
    layout_lender, layout_of, profile_for, profile_text,
};
pub use recipes::{Kept, LeftOut, RECIPES, Recipe, RecipeError, RecipePlan, Subject, recipe};
pub use relations::{HOMEGROWN_RULES, Relation, RelationPlan, RelationSet, Tie, TieTarget};
pub use retirement::{PlannedRetirement, RetirementPlan, RetirementSet};
pub use rules::{
    CompetitionRules, MOST_RULE_VALUE, RecordedRule, Registration, RuleChange, RuleEdit, RuleError, RulePlaces,
    RuleReadError, RuleRecord, RuleSource, RuleUnavailable, Season, SeasonTurn, SquadRule,
};
pub use scan::{ArrayCandidate, ScanOptions, VtableCount, scan_object_arrays};
pub use scout_lists::{
    KIND_MOST, KindCount, OPPORTUNITY_KINDS, Opportunities, Opportunity, OpportunityKind, OpportunityRequest,
    POOL_MOST, Similar, SimilarPlayer, SimilarRequest, Starter, Why,
};
pub use scouting::{
    Buyer, ClubTactic, Fitting, LIKELY, Line, NOT_FOR_SALE, Phase, Purpose, ROLES, Reason, Role, SCOUT_POSITIONS,
    ScoutError, ScoutOrder, ScoutPosition, ScoutRequest, Scouted, Side, Suggestion, TacticSlot, role, role_of_mask,
    scout_position,
};
pub use session::{ArraySource, IGNORE_PROFILES, SaveVouched, Session, SessionError, find_game, profiles_ignored};
pub use signing::NewContract;
pub use sponsorship::{Sponsorship, SponsorshipReadError, SponsorshipUnavailable, kind_name as sponsorship_kind_name};
pub use squad::{CaptainPlan, CaptainRole, CaptainSet, ClubTeam, LinkedTeam, Loan, SquadMember};
pub use squad_report::{Departure, DepartureAction, DepartureReason, DepthLine, DepthPlayer, DepthStatus, SquadReport};
pub use stadium_name::{StadiumName, StadiumRename};
pub use staff::{
    STAFF_ATTRIBUTE_GROUPS, StaffContract, StaffDetails, StaffIndex, StaffSummary, job_name, read_staff,
    read_staff_details,
};
pub use staff_move::{
    DIRECTOR_OF_FOOTBALL, Department, MANAGER, NewStaffContract, Post, STAFF_JOBS, StaffChange, StaffPlan, post_of,
};
pub use tactical_areas::area_options;
pub use text::{fold, is_name_like, read_fm_string, read_name_entry};
pub use timeline::{Earlier, Progress, RECORD_EVERY_DAYS, Timeline, timeline_fields, timeline_values};
pub use transfer::{Amounts, ClubMoney, ClubMove, FeePlan, MAX_FEE, MoveError, MovePlan, MoveTerms, Paid, RoomMaker};
pub use tree::Tree;
pub use youth_intake::{City, INTAKE_AGE, Intake, IntakePlayer, IntakeTeam, MADE_BY_GAME, YouthIntakes};
