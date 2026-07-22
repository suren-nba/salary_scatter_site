const STORAGE_KEY = "salary-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");
const THEMES = ["light", "gray", "taupe", "green", "dark"];
const THEME_LABELS = {
  light: "珊瑚浅色",
  gray: "灰色",
  taupe: "暖棕色",
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

export function initTheme(onSystemChange) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (THEMES.includes(saved)) {
    followsSystem = false;
    document.documentElement.dataset.theme = saved;
  } else {
    followsSystem = true;
    document.documentElement.dataset.theme = systemTheme();
  }
  media.addEventListener("change", () => {
    if (!followsSystem) return;
    document.documentElement.dataset.theme = systemTheme();
    if (onSystemChange) onSystemChange(getTheme());
  });
  return getTheme();
}

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return getTheme();
  followsSystem = false;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
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
