import {
  getTheme,
  getThemeIndex,
  getThemeLabel,
  setThemeByIndex,
} from "./theme.js?v=20260728-6";

const panel = document.querySelector(".site-dock__panel");
const items = panel ? [...panel.querySelectorAll("[data-dock-item]")] : [];
const themeButton = panel?.querySelector("[data-dock-theme]");
const themeSlider = document.getElementById("themeSlider");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function resetMagnification() {
  items.forEach((item) => {
    item.style.removeProperty("--dock-scale");
    item.style.removeProperty("--dock-lift");
  });
}

function updateMagnification(event) {
  if (reduceMotion.matches) return;
  const influenceDistance = 112;

  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const influence = Math.max(0, 1 - Math.abs(event.clientX - center) / influenceDistance);
    item.style.setProperty("--dock-scale", (1 + influence * 0.34).toFixed(3));
    item.style.setProperty("--dock-lift", `${(-influence * 7).toFixed(2)}px`);
  });
}

function syncThemeButton() {
  if (!themeButton) return;
  const label = getThemeLabel(getTheme());
  themeButton.setAttribute("aria-label", `切换配色主题，当前为${label}`);
  themeButton.title = `当前主题：${label}`;
}

if (panel) {
  panel.addEventListener("pointermove", updateMagnification);
  panel.addEventListener("pointerleave", resetMagnification);
}

if (themeButton) {
  themeButton.addEventListener("click", () => {
    const nextIndex = (getThemeIndex() + 1) % 5;
    setThemeByIndex(nextIndex);

    if (themeSlider) {
      themeSlider.value = String(nextIndex);
      themeSlider.dispatchEvent(new Event("input", { bubbles: true }));
    }

    syncThemeButton();
  });
}

new MutationObserver(syncThemeButton).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

syncThemeButton();
