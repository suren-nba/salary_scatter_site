import { state } from "./state.js";
import {
  metricLabels,
  metricOrder,
  numberFontFamily,
  isNumber,
  formatMoney,
  escapeHtml,
} from "./format.js";
import { getTheme } from "./theme.js";

let chart = null;
let chartEl = null;
let emptyEl = null;
let onSelect = null;

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function palette() {
  return {
    positive: cssColor("--positive", "#176a43"),
    negative: cssColor("--negative", "#9d2e2a"),
    ink: cssColor("--ink", "#2c3e50"),
    muted: cssColor("--muted", "#6b7785"),
    panel: cssColor("--panel", "#ffffff"),
    line: cssColor("--line", "rgba(44, 62, 80, 0.14)"),
  };
}

function axisMin(field, values) {
  const finite = values.filter(isNumber);
  if (!finite.length) return 0;
  const min = Math.min(...finite);
  if (field === "expected_minus_actual_m" || min < 0) {
    return Math.floor((min - 4) / 5) * 5;
  }
  return 0;
}

function axisMax(values) {
  const finite = values.filter(isNumber);
  if (!finite.length) return 10;
  const max = Math.max(...finite);
  return Math.ceil((max + 4) / 5) * 5;
}

function tooltipHtml(row) {
  const metrics = metricOrder
    .map((field) => {
      const signed = field === "expected_minus_actual_m";
      return `<div><span>${metricLabels[field]}</span><strong>${formatMoney(row[field], signed)}</strong></div>`;
    })
    .join("");
  return `
    <div class="chart-tooltip">
      <div class="chart-tooltip__top">
        <img class="avatar" src="${escapeHtml(row.headshot_file)}" alt="${escapeHtml(row.player_name)}" loading="lazy" onerror="this.style.display='none'">
        <div>
          <h3>${escapeHtml(row.player_name)}</h3>
          <p>${escapeHtml(row.team_abbreviation)} · ${escapeHtml(row.team_name)}</p>
        </div>
      </div>
      <div class="tooltip-metrics">${metrics}</div>
    </div>
  `;
}

function chartRows() {
  return state.filtered.filter((row) => isNumber(row[state.xMetric]) && isNumber(row[state.yMetric]));
}

export function initChart(el, emptyElement, { onSelect: onSelectCallback } = {}) {
  chartEl = el;
  emptyEl = emptyElement;
  onSelect = onSelectCallback;
  chart = echarts.init(chartEl, getTheme() === "dark" ? "dark" : null, { renderer: "canvas" });
  chart.on("click", (params) => {
    if (params.data && params.data.row && onSelect) onSelect(params.data.row.player_id);
  });
  return chart;
}

export function rebuildChart() {
  if (!chartEl) return;
  if (chart) chart.dispose();
  initChart(chartEl, emptyEl, { onSelect });
  updateChart();
}

export function resizeChart() {
  if (chart) chart.resize();
}

export function updateChart() {
  if (!chart) return;
  const colors = palette();
  const rows = chartRows();
  const xValues = rows.map((row) => row[state.xMetric]);
  const yValues = rows.map((row) => row[state.yMetric]);
  const minLine = Math.min(axisMin(state.xMetric, xValues), axisMin(state.yMetric, yValues));
  const maxLine = Math.max(axisMax(xValues), axisMax(yValues));
  const term = state.searchTerm.trim().toLowerCase();
  const highlighted = rows.filter((row) => {
    const matchesSearch = term && row.player_name.toLowerCase().includes(term);
    const selected = state.selectedPlayerId && row.player_id === state.selectedPlayerId;
    const smallTeamAvatar = state.showAvatars && rows.length <= 80;
    return matchesSearch || selected || smallTeamAvatar;
  });

  chartEl.setAttribute(
    "aria-label",
    `NBA 球员薪资价值散点图，X 轴为${metricLabels[state.xMetric]}，Y 轴为${metricLabels[state.yMetric]}`,
  );

  if (emptyEl) {
    emptyEl.hidden = rows.length > 0;
    if (rows.length === 0) emptyEl.textContent = "没有符合当前筛选条件的球员";
  }

  const baseData = rows.map((row) => ({
    value: [row[state.xMetric], row[state.yMetric]],
    row,
    itemStyle: {
      color: row.expected_minus_actual_m >= 0 ? colors.positive : colors.negative,
      opacity: state.selectedPlayerId && row.player_id !== state.selectedPlayerId ? 0.45 : 0.84,
    },
  }));

  const avatarData = highlighted.map((row) => ({
    value: [row[state.xMetric], row[state.yMetric]],
    row,
    symbol: `image://${row.headshot_file}`,
    symbolSize: row.player_id === state.selectedPlayerId ? 46 : 34,
  }));

  chart.setOption({
    animationDuration: 300,
    backgroundColor: "transparent",
    textStyle: { color: colors.ink, fontFamily: numberFontFamily },
    grid: { left: 20, right: 20, top: 36, bottom: 88, containLabel: true },
    tooltip: {
      trigger: "item",
      borderWidth: 1,
      borderColor: colors.line,
      padding: 12,
      backgroundColor: colors.panel,
      textStyle: { color: colors.ink },
      extraCssText: "box-shadow:0 14px 38px rgba(0,0,0,.18);border-radius:8px;",
      formatter: (params) => tooltipHtml(params.data.row),
    },
    toolbox: {
      right: 8,
      feature: {
        dataZoom: { yAxisIndex: "none" },
        restore: {},
      },
    },
    dataZoom: [
      { type: "inside", throttle: 80 },
      { type: "slider", height: 24, bottom: 24 },
    ],
    xAxis: {
      min: axisMin(state.xMetric, xValues),
      max: axisMax(xValues),
      axisLabel: { color: colors.muted, formatter: (value) => `$${value}M` },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { lineStyle: { color: colors.line } },
      splitLine: { lineStyle: { color: colors.line } },
    },
    yAxis: {
      min: axisMin(state.yMetric, yValues),
      max: axisMax(yValues),
      axisLabel: { color: colors.muted, formatter: (value) => `$${value}M` },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { lineStyle: { color: colors.line } },
      splitLine: { lineStyle: { color: colors.line } },
    },
    series: [
      {
        name: "球员",
        type: "scatter",
        data: baseData,
        symbolSize: 12,
        emphasis: { focus: "self", scale: 1.5 },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: colors.ink, opacity: 0.42 },
          label: { formatter: "y = x", color: colors.ink },
          data: [[{ coord: [minLine, minLine] }, { coord: [maxLine, maxLine] }]],
        },
      },
      {
        name: "头像高亮",
        type: "scatter",
        data: avatarData,
        z: 3,
        tooltip: { show: true },
        emphasis: { scale: 1.18 },
      },
    ],
  }, true);
}
