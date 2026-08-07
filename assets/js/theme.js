const STORAGE_KEY = "salary-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const THEMES = ["light", "gray", "cream", "green", "dark"];
const THEME_LABELS = {
  light: "珊瑚浅色",
  gray: "灰色",
  cream: "奶油色",
  green: "墨绿色",
  dark: "曜黑色",
};

let followsSystem = true;

function systemTheme() {
  return media.matches ? "dark" : "light";
}

export function getTheme() {
  const explicit = document.documentElement.dataset.theme;
  return THEMES.includes(explicit) ? explicit : systemTheme();
}

function emitThemeChange(theme) {
  window.dispatchEvent(new CustomEvent("salary-theme-change", { detail: { theme } }));
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (THEMES.includes(saved)) {
    followsSystem = false;
    document.documentElement.dataset.theme = saved;
  } else {
    followsSystem = true;
    if (saved !== null) localStorage.removeItem(STORAGE_KEY);
    document.documentElement.dataset.theme = systemTheme();
  }
  media.addEventListener("change", () => {
    if (!followsSystem) return;
    const theme = systemTheme();
    document.documentElement.dataset.theme = theme;
    emitThemeChange(theme);
  });
  return getTheme();
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return getTheme();
  followsSystem = false;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  emitThemeChange(theme);
  return theme;
}

export function setThemeByIndex(index) {
  const safeIndex = Math.max(0, Math.min(THEMES.length - 1, Math.round(index)));
  return setTheme(THEMES[safeIndex]);
}

export function getThemeIndex(theme = getTheme()) {
  const index = THEMES.indexOf(theme);
  return index === -1 ? 0 : index;
}

export function getThemeLabel(theme = getTheme()) {
  return THEME_LABELS[theme] || THEME_LABELS.light;
}
