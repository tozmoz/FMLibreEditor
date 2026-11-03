import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.document = { documentElement: {} };
globalThis.window = { navigator: { languages: ["en"], language: "en" } };
const { estimateRca, matchedRcaDraft } = await import(
  "../node_modules/.cache/feature-tests/rca/rca.js"
);
const fixtures = JSON.parse(
  fs.readFileSync(new URL("./frontend-rca-fixtures.json", import.meta.url)),
);
let checks = 0;
for (const f of fixtures) {
  assert.equal(estimateRca(f.fields, f.start, {}).value, f.expected);
  checks++;
}
const h = fixtures.find((f) => f.uid === 29179241);
for (const [pace, expected] of [
  [10, 178],
  [11, 180],
  [12, 181],
  [13, 183],
  [14, 184],
  [15, 185],
  [16, 185],
  [19, 189],
]) {
  assert.equal(
    estimateRca(h.fields, h.start, { "attribute.pace": String(pace) }).value,
    expected,
  );
  checks++;
}
assert.equal(estimateRca(h.fields, h.start, { "attribute.pace": "" }), null);
checks++;
assert.equal(estimateRca(h.fields, h.start, { "attribute.pace": "99" }), null);
checks++;
assert.equal(
  estimateRca(h.fields, h.start, { potential_ability: "100" }).exceedsPa,
  true,
);
checks++;
assert.equal(h.start.potential_ability, 195);
checks++;
const original = JSON.stringify(h.start);
estimateRca(h.fields, h.start, { "attribute.pace": "10" });
assert.equal(JSON.stringify(h.start), original);
checks++;
const missing = { ...h.start };
delete missing["attribute.right_foot"];
assert.equal(estimateRca(h.fields, missing, {}), null);
checks++;
const draft = { "attribute.pace": "10", potential_ability: "195" };
assert.equal(
  matchedRcaDraft(draft, true, { value: 178, position: "ST", exceedsPa: false })
    .current_ability,
  "178",
);
checks++;
assert.equal(
  matchedRcaDraft(draft, false, {
    value: 178,
    position: "ST",
    exceedsPa: false,
  }).current_ability,
  undefined,
);
checks++;
assert.equal(matchedRcaDraft(draft, true, null).current_ability, undefined);
checks++;
assert.equal(draft.current_ability, undefined);
checks++;
assert.equal(
  matchedRcaDraft(draft, true, { value: 200, position: "ST", exceedsPa: true })
    .potential_ability,
  "195",
);
checks++;
console.log(`${checks} RCA frontend checks passed`);
