export const metricLabels = {
  epm_expected_salary_m: "EPM 预期薪资",
  darko_expected_salary_m: "DARKO 预测薪资",
  average_expected_salary_m: "平均预期薪资",
  last_season_value_salary_m: "上赛季表现薪资",
  actual_salary_m: "实际薪资",
  expected_minus_actual_m: "合同价值差",
};

export const metricOrder = Object.keys(metricLabels);
export const numberFontFamily = "Consolas, SFMono-Regular, Menlo, Monaco, monospace";

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
  if (!isNumber(value)) return "—";
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

export function ordinal(rank) {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th";
  return `${rank}${suffix}`;
}
