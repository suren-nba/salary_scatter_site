import { aggregate, isNumber } from "./format.js?v=20260728-6";

export const state = {
  data: [],
  filtered: [],
  selectedTeam: "ALL",
  selectedPosition: "ALL",
  cardRankingMode: "average",
  xMetric: "actual_salary_m",
  yMetric: "expected_minus_actual_m",
  beeswarmMetric: "average_expected_salary_m",
  showAvatars: true,
  selectedPlayerId: null,
  hoveredPlayerId: null,
  tableVisiblePlayerIds: null,
};

export function applyFilters() {
  state.filtered = state.data.filter((row) => {
    const teamOk = state.selectedTeam === "ALL" || row.team_abbreviation === state.selectedTeam;
    const positionOk = state.selectedPosition === "ALL" || row.position === state.selectedPosition;
    return teamOk && positionOk;
  });
}

export function teamScopeRows() {
  if (state.selectedTeam === "ALL") return state.data;
  return state.data.filter((row) => row.team_abbreviation === state.selectedTeam);
}

export function extremePlayer(rows, direction, field = "expected_minus_actual_m") {
  const candidates = rows.filter((row) => isNumber(row[field]));
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => {
    const difference = direction === "max"
      ? b[field] - a[field]
      : a[field] - b[field];
    return difference || a.player_name.localeCompare(b.player_name);
  })[0];
}

export function teamRank(field, team, mode = "average", position = "ALL") {
  if (team === "ALL" || team === "NA") return null;
  const teams = [...new Set(
    state.data
      .map((row) => row.team_abbreviation)
      .filter((teamCode) => teamCode && teamCode !== "NA"),
  )];
  const ranked = teams
    .map((teamCode) => ({
      team: teamCode,
      value: aggregate(
        state.data.filter((row) => (
          row.team_abbreviation === teamCode
          && (position === "ALL" || row.position === position)
        )),
        field,
        mode,
      ),
    }))
    .filter((item) => isNumber(item.value))
    .sort((a, b) => b.value - a.value || a.team.localeCompare(b.team));
  const target = ranked.find((item) => item.team === team);
  if (!target) return null;
  return 1 + ranked.filter((item) => item.value > target.value).length;
}
