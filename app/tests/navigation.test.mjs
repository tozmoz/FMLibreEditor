import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
const dom = new JSDOM('<div id="root"></div>', {
  url: "http://localhost",
  pretendToBeVisual: true,
});
for (const k of [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "MutationObserver",
  "localStorage",
])
  globalThis[k] = k === "window" ? dom.window : dom.window[k];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const { Harness, React, act, createRoot, fixtures } = await import(
  "../node_modules/.cache/feature-tests/navigation/navigation.js"
);
const f = await fixtures();
const root = createRoot(document.getElementById("root"));
await act(async () => root.render(React.createElement(Harness, f)));
const settle = () => new Promise((r) => setTimeout(r, 400));
async function click(button) {
  assert.ok(button, "button exists");
  await act(async () => {
    button.click();
    await settle();
  });
  await act(async () => {
    await settle();
  });
}
const tabButtons = () => [
  ...document.querySelectorAll(".entity-tab > button:first-child"),
];
async function browser() {
  await click(document.querySelector(".entity-tabs > button"));
}
for (let i = 0; i < 12; i++) {
  if (i) await browser();
  await click(
    document.querySelectorAll('[data-testid="test-browser"] .entity-link')[i],
  );
  assert.equal(tabButtons().length, i + 1);
}
await browser();
await click(
  document.querySelector('[data-testid="test-browser"] .entity-link'),
);
assert.equal(tabButtons().length, 12, "deduplicate player tab");
await browser();
await click(
  [...document.querySelectorAll('[data-testid="test-browser"] button')].find(
    (b) => b.textContent === "Test staff",
  ),
);
assert.equal(tabButtons().length, 13);
await browser();
await click(
  [...document.querySelectorAll('[data-testid="test-browser"] button')].find(
    (b) => b.textContent === "Test club",
  ),
);
assert.equal(tabButtons().length, 14);
await act(async () => {
  window.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape" }),
  );
  await settle();
});
assert.equal(tabButtons().length, 13, "Escape closes only the visible profile");
assert.equal(
  document.querySelectorAll(".entity-tab-panel:not([hidden])").length,
  1,
);
await click(tabButtons()[0]);
await click(
  document.querySelector(".entity-tab-panel:not([hidden]) .edit-toggle"),
);
const input = document.querySelector(
  '.entity-tab-panel:not([hidden]) [data-field="current_ability"]',
);
assert.ok(input, "editable CA input");
await act(async () => {
  Object.getOwnPropertyDescriptor(
    dom.window.HTMLInputElement.prototype,
    "value",
  ).set.call(input, "120");
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
});
await browser();
assert.equal(
  document.querySelector(".browser-workspace").hidden,
  true,
  "unsaved draft prevents tab switch",
);
assert.ok(
  document.querySelector(
    ".entity-tab-panel:not([hidden]) .edit-footer .danger",
  ),
  "discard confirmation visible",
);
await click(
  document.querySelector(
    ".entity-tab-panel:not([hidden]) .edit-footer .danger",
  ),
);
assert.equal(
  document.querySelector(".browser-workspace").hidden,
  false,
  "confirmed discard returns to browser",
);
await act(async () => root.unmount());
console.log(
  "Navigation integration passed: 12 player tabs + staff + club, deduplication, close fallback and browser return.",
);

process.exit(0);
