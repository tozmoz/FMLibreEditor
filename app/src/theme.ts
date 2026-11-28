// An optional theme override. With "system", CSS follows the operating system.
export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "fmlibre.theme";

function readTheme(): Theme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Storage can be disabled; default to the operating-system preference.
  }
  return "system";
}

export let theme: Theme = readTheme();

function applyTheme(): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

applyTheme();

/** Apply a visual preference without reloading or changing pending edits. */
export function setTheme(next: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // A usable in-memory preference is still better than ignoring the click.
  }
  theme = next;
  applyTheme();
}
