import { state } from "./state.js?v=20260728-3";
import { metricLabels } from "./format.js?v=20260728-3";

export function applyUrlState(els) {
  const params = new URLSearchParams(window.location.hash.slice(1));

  const team = params.get("team");
  if (team === "ALL" || (team && state.data.some((row) => row.team_abbreviation === team))) {
    state.selectedTeam = team;
  }

  const position = params.get("position");
  if (position && (position === "ALL" || state.data.some((row) => row.position === position))) {
    state.selectedPosition = position;
    els.positionFilter.value = position;
  }

  const card = params.get("card");
  if (["average", "median", "total"].includes(card)) {
    state.cardRankingMode = card;
    els.cardRankingMode.value = card;
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

  const beeswarm = params.get("beeswarm");
  if (beeswarm && metricLabels[beeswarm]) {
    state.beeswarmMetric = beeswarm;
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
  if (state.selectedPosition !== "ALL") params.set("position", state.selectedPosition);
  if (state.cardRankingMode !== "average") params.set("card", state.cardRankingMode);
  if (state.xMetric !== "actual_salary_m") params.set("x", state.xMetric);
  if (state.yMetric !== "expected_minus_actual_m") params.set("y", state.yMetric);
  if (state.beeswarmMetric !== "average_expected_salary_m") params.set("beeswarm", state.beeswarmMetric);
  if (state.showAvatars) params.set("avatars", "1");
  if (state.selectedPlayerId) params.set("sel", String(state.selectedPlayerId));

  const hash = params.toString();
  if (hash) {
    history.replaceState(null, "", `#${hash}`);
  } else {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}
