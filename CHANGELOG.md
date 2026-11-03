# Changelog

## Unreleased - profile navigation and editing enhancements

### Added

- Click player, staff and club links to open separate, closable profile tabs. Open profiles are reused and the tab strip scrolls; there is no fixed tab limit.
- Links from search results, employer names, club squads, trained-at-club ties, the comparison tray and the change log where a supported entity UID is available.
- Estimated recommended current ability (RCA) beside CA/PA while editing a player. Pending attribute, position and foot edits update the estimate before Apply.
- Optional **Keep CA matched to estimated RCA**, off by default. Its CA change appears in the existing review/Apply flow; typing CA manually turns matching off. PA is never automatically changed.
- Key and preferred attribute highlights selected by position, role, and in/out-of-possession phase, with a switch to hide them.
- Portable frontend checks for RCA, draft matching and profile navigation, including fourteen open profiles and unsaved-edit protection.

### Notes

- RCA is an estimate, not a verified reproduction of the complete FM27 calculation. Positional preparation, multi-position familiarity and age-related adjustments remain incomplete. Role highlights do not determine RCA weights.
- Open tabs last for the current connection/session; they are not restored after restarting.
- Existing guarded writes and change history are used. No game offsets or native write code were changed.
