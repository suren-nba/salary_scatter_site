export const metricLabels = {
  epm_expected_salary_m: "EPM预测薪水",
  darko_expected_salary_m: "DARKO预测薪水",
  average_expected_salary_m: "综合预测薪水",
  actual_salary_m: "新赛季薪水",
  expected_minus_actual_m: "新赛季合同价值差",
  last_season_value_salary_m: "上赛季表现薪水",
  last_season_actual_salary_m: "上赛季实际薪水",
  last_season_expected_minus_actual_m: "上赛季合同价值差",
};

export const metricOrder = Object.keys(metricLabels);
export const numberFontFamily = "Consolas, SFMono-Regular, Menlo, Monaco, monospace";
const differenceMetrics = new Set([
  "expected_minus_actual_m",
  "last_season_expected_minus_actual_m",
]);

export function isDifferenceMetric(field) {
  return differenceMetrics.has(field);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatMoney(value, signed = false) {
  if (!isNumber(value)) return "--";
  const abs = Math.abs(value).toFixed(1);
  if (signed) {
    if (value > 0) return `+$${abs}M`;
    if (value < 0) return `−$${abs}M`;
    return "$0.0M";
  }
  return value < 0 ? `−$${abs}M` : `$${abs}M`;
}

export function formatSurplusHtml(value) {
  const label = formatMoney(value, true);
  const kind = !isNumber(value) || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";
  return `<span class="surplus-value ${kind}">${label}</span>`;
}

export function average(rows, field) {
  const values = rows.map((row) => row[field]).filter(isNumber);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function teamLogoPath(team) {
  return `./assets/team-logos/${team}.webp`;
}

export function teamHasLogo(team) {
  return team !== "ALL" && team !== "NA";
}

export function teamDisplayName(team) {
  if (team === "ALL") return "全联盟";
  if (team === "NA") return "无球队";
  return team;
}

export function ordinal(rank) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th";
  return `${rank}${suffix}`;
}
