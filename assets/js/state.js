import { average, isNumber } from "./format.js";

export const state = {
  data: [],
  metadata: {},
  filtered: [],
  selectedTeam: "ALL",
  searchTerm: "",
  xMetric: "actual_salary_m",
  yMetric: "expected_minus_actual_m",
  beeswarmMetric: "average_expected_salary_m",
  showAvatars: false,
  selectedPlayerId: null,
};

export function applyFilters() {
  const term = state.searchTerm.trim().toLowerCase();
  state.filtered = state.data.filter((row) => {
    const teamOk = state.selectedTeam === "ALL" || row.team_abbreviation === state.selectedTeam;
    const searchOk = !term || row.player_name.toLowerCase().includes(term);
    return teamOk && searchOk;
  });
}

export function teamScopeRows() {
  if (state.selectedTeam === "ALL") return state.data;
  return state.data.filter((row) => row.team_abbreviation === state.selectedTeam);
}

export function extremePlayer(rows, direction) {
  const candidates = rows.filter((row) => isNumber(row.expected_minus_actual_m));
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => {
    const difference = direction === "max"
      ? b.expected_minus_actual_m - a.expected_minus_actual_m
      : a.expected_minus_actual_m - b.expected_minus_actual_m;
    return difference || a.player_name.localeCompare(b.player_name);
  })[0];
}

export function teamRank(field, team) {
  if (team === "ALL") return null;
  const teams = [...new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean))];
  const ranked = teams
    .map((teamCode) => ({
      team: teamCode,
      value: average(state.data.filter((row) => row.team_abbreviation === teamCode), field),
    }))
    .filter((item) => isNumber(item.value))
    .sort((a, b) => b.value - a.value || a.team.localeCompare(b.team));
  const target = ranked.find((item) => item.team === team);
  if (!target) return null;
  return 1 + ranked.filter((item) => item.value > target.value).length;
}
