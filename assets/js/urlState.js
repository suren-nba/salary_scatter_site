import { state } from "./state.js";
import { metricLabels } from "./format.js";

export function applyUrlState(els) {
  const params = new URLSearchParams(window.location.hash.slice(1));

  const team = params.get("team");
  if (team === "ALL" || (team && state.data.some((row) => row.team_abbreviation === team))) {
    state.selectedTeam = team;
  }

  const q = params.get("q");
  if (q) {
    state.searchTerm = q;
    els.playerSearch.value = q;
  }

  const x = params.get("x");
  if (x && metricLabels[x]) {
    state.xMetric = x;
    els.xMetric.value = x;
  }

  const y = params.get("y");
  if (y && metricLabels[y]) {
    state.yMetric = y;
    els.yMetric.value = y;
  }

  if (params.get("avatars") === "1") {
    state.showAvatars = true;
    els.avatarToggle.checked = true;
  }

  const sel = Number(params.get("sel"));
  if (sel && state.data.some((row) => row.player_id === sel)) {
    state.selectedPlayerId = sel;
  }
}

export function writeUrlState() {
  const params = new URLSearchParams();
  if (state.selectedTeam !== "ALL") params.set("team", state.selectedTeam);
  const term = state.searchTerm.trim();
  if (term) params.set("q", term);
  if (state.xMetric !== "actual_salary_m") params.set("x", state.xMetric);
  if (state.yMetric !== "average_expected_salary_m") params.set("y", state.yMetric);
  if (state.showAvatars) params.set("avatars", "1");
  if (state.selectedPlayerId) params.set("sel", String(state.selectedPlayerId));

  const hash = params.toString();
  if (hash) {
    history.replaceState(null, "", `#${hash}`);
  } else {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
