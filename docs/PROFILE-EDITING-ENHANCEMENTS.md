# Profile navigation and editing enhancements

## Use

Click a linked player, member of staff or club to open a profile tab. Click an existing tab to return to it, its close button to remove it, or Browser to return to the lists. Unsaved changes ask for confirmation before navigation. Names without a supported entity UID stay plain text.

In a player profile, use Attribute highlights to select a position, phase and role. Key and preferred attributes have text markers as well as colour; numeric attribute colours remain unchanged.

Press Edit to see Estimated RCA. Changing attributes updates the estimate. Keep CA matched to estimated RCA is opt-in and adds CA to the normal pending changes; review and Apply are still required. Manually entering CA disables matching. Discarding or ending the edit resets matching. PA is not raised automatically when an estimate exceeds it.

## Estimation and reference-data provenance

The conversion arithmetic is independently transcribed from offline inspection of FM27's native conversion stage. This change includes no native game binary, disassembly, third-party executable or third-party implementation code.

The positional weight tables in `app/src/rcaWeights.json` and role/key/preferred attribute mappings in `app/src/roleHighlights.json` were normalized from local FMRTE reference JSON files. These are reference data, not FMRTE calculator code. Their origin is stated explicitly for maintainer review; they have not been independently established as the complete FM27 positional preparation algorithm or as a separately licensed upstream dataset.

The estimator selects the highest-familiarity position with a stable tie order, uses its flat positional weights and the weaker-foot rating, then applies the conversion and clamps to 1-200. Complete multi-position preparation and age/cutoff handling are not implemented. Highlighted tactical roles are presentation guidance and do not change the estimate.

Six observed player baselines and eight controlled pace values are regression cases against the observed FMRTE recommendations. Those observations are not proof of FM27's own complete RCA result. Offline conversion-stage comparisons and a successful local live edit were also performed during development; long-term simulation effects and live navigation across all platforms remain unverified.

## Verification

From `app/`, run `npm ci`, `npm run test:features` and `npm run build`. Tests use browser fixtures, never a running game. The navigation test opens twelve players, one staff member and one club, checks duplicate reuse, close fallback, Browser return and confirmation before discarding an edit. RCA tests check reference observations, invalid/missing input, PA warnings, draft immutability and opt-in CA matching.

Run the repository's Rust format, clippy and test checks as described in CONTRIBUTING.md. This contribution changes frontend code only and adds no memory offsets or write targets.
