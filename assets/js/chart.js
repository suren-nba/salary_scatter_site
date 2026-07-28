import { state } from "./state.js?v=20260728-6";
import {
  metricLabels,
  numberFontFamily,
  isNumber,
  isDifferenceMetric,
  formatMoney,
  escapeHtml,
  teamDisplayName,
} from "./format.js?v=20260728-6";
let chart = null;
let chartEl = null;
let emptyEl = null;
let onSelect = null;
const SHARE_CHART_WIDTH = 672;
const SHARE_CHART_HEIGHT = 418;
const SHARE_PIXEL_RATIO = 2;

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

function leagueStanding(row, field) {
  const value = row[field];
  const leagueRows = state.data.filter((item) => isNumber(item[field]));
  const rank = 1 + leagueRows.filter((item) => item[field] > value).length;
  const below = leagueRows.filter((item) => item[field] < value).length;
  return {
    rank,
    total: leagueRows.length,
    percentile: leagueRows.length <= 1 ? 100 : (below / (leagueRows.length - 1)) * 100,
  };
}

function tooltipMetricHtml(row, field) {
  const standing = leagueStanding(row, field);
  const value = formatMoney(row[field], isDifferenceMetric(field));
  return `
    <div class="tooltip-metric">
      <span>${escapeHtml(metricLabels[field])}</span>
      <span class="tooltip-metric__value">
        <strong class="tooltip-metric__percentile" style="--metric-percentile:${standing.percentile.toFixed(1)}%" title="联盟百分位 ${Math.round(standing.percentile)}%">${value}</strong>
        <small class="tooltip-metric__rank">${standing.rank}/${standing.total}</small>
      </span>
    </div>
  `;
}

function tooltipHtml(row) {
  const metrics = [
    tooltipMetricHtml(row, state.xMetric),
    tooltipMetricHtml(row, state.yMetric),
  ].join("");
  const team = teamDisplayName(row.team_abbreviation);
  const avatar = row.headshot_file
    ? `<img class="avatar" src="${escapeHtml(row.headshot_file)}" alt="${escapeHtml(row.player_name)}" loading="lazy" onerror="this.style.display='none'">`
    : "";
  return `
    <div class="chart-tooltip">
      <div class="chart-tooltip__top">
        ${avatar}
        <div>
          <h3>${escapeHtml(row.player_name)}</h3>
          <p>${escapeHtml(team)} · ${escapeHtml(row.position)}</p>
        </div>
      </div>
      <div class="tooltip-metrics">${metrics}</div>
    </div>
  `;
}

function chartRows() {
  return state.filtered.filter((row) => isNumber(row[state.xMetric]) && isNumber(row[state.yMetric]));
}

function normalizedValue(value, min, max) {
  return max === min ? 0.5 : (value - min) / (max - min);
}

function avatarRows(rows) {
  const eligible = rows.filter((row) => row.headshot_file);
  const selected = eligible.find((row) => row.player_id === state.selectedPlayerId);
  if (!state.showAvatars) return selected ? [selected] : [];
  if (eligible.length <= 30) return eligible;

  const xValues = eligible.map((row) => row[state.xMetric]);
  const yValues = eligible.map((row) => row[state.yMetric]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const ranked = eligible
    .map((row) => {
      const x = normalizedValue(row[state.xMetric], xMin, xMax);
      const y = normalizedValue(row[state.yMetric], yMin, yMax);
      return { row, score: x + y, x, y };
    })
    .sort((a, b) => (
      a.score - b.score
      || a.x - b.x
      || a.y - b.y
      || String(a.row.player_id).localeCompare(String(b.row.player_id))
    ));

  const bottomLeft = ranked.slice(0, 15);
  const topRight = ranked.slice(-15);
  const selectedRank = ranked.find((item) => item.row.player_id === state.selectedPlayerId);
  if (selectedRank && !bottomLeft.includes(selectedRank) && !topRight.includes(selectedRank)) {
    if (selectedRank.score >= 1) topRight[0] = selectedRank;
    else bottomLeft[bottomLeft.length - 1] = selectedRank;
  }

  return [...bottomLeft, ...topRight].map((item) => item.row);
}

export function initChart(el, emptyElement, { onSelect: onSelectCallback } = {}) {
  chartEl = el;
  emptyEl = emptyElement;
  onSelect = onSelectCallback;
  chart = echarts.init(chartEl, null, { renderer: "canvas" });
  chart.on("click", (params) => {
    if (params.data && params.data.row && onSelect) onSelect(params.data.row.player_id);
  });
  chart.getZr().on("click", (event) => {
    if (!event.target && onSelect) onSelect(null);
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

export function getChartShareTitle() {
  return `X 轴: ${metricLabels[state.xMetric]} VS Y 轴: ${metricLabels[state.yMetric]}`;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("散点图图片生成失败"));
    image.src = source;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("散点图图片生成失败"));
    }, "image/png");
  });
}

export async function createChartShareBlob() {
  if (!chart) throw new Error("散点图尚未加载");
  const colors = palette();
  const originalSize = {
    width: chart.getWidth(),
    height: chart.getHeight(),
  };
  let chartImageSource;
  try {
    chart.resize({
      width: SHARE_CHART_WIDTH,
      height: SHARE_CHART_HEIGHT,
      silent: true,
    });
    chartImageSource = chart.getDataURL({
      type: "png",
      pixelRatio: SHARE_PIXEL_RATIO,
      backgroundColor: colors.panel,
    });
  } finally {
    chart.resize({
      width: originalSize.width,
      height: originalSize.height,
      silent: true,
    });
  }
  const chartImage = await loadImage(chartImageSource);
  const padding = 72;
  const headerHeight = 172;
  const bottomPadding = 48;
  const canvas = document.createElement("canvas");
  canvas.width = chartImage.width + padding * 2;
  canvas.height = chartImage.height + headerHeight + bottomPadding;
  const context = canvas.getContext("2d");
  const title = getChartShareTitle();
  const titleSize = Math.max(28, Math.min(44, (canvas.width - padding * 2) / Math.max(16, title.length * 0.62)));

  context.fillStyle = colors.panel;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.ink;
  context.font = `800 ${titleSize}px ${numberFontFamily}`;
  context.textBaseline = "top";
  context.fillText(title, padding, 46, canvas.width - padding * 2);
  context.fillStyle = colors.muted;
  context.font = `600 ${Math.max(20, titleSize * 0.58)}px ${numberFontFamily}`;
  context.fillText("数据by库昊&via salary.surennba.com", padding, 108, canvas.width - padding * 2);
  context.drawImage(chartImage, padding, headerHeight);

  return canvasToBlob(canvas);
}

export function updateChart() {
  if (!chart) return;
  const colors = palette();
  const rows = chartRows();
  const xValues = rows.map((row) => row[state.xMetric]);
  const yValues = rows.map((row) => row[state.yMetric]);
  const minLine = Math.min(axisMin(state.xMetric, xValues), axisMin(state.yMetric, yValues));
  const maxLine = Math.max(axisMax(xValues), axisMax(yValues));
  const highlighted = avatarRows(rows);
  const selectedVisible = rows.some((row) => row.player_id === state.selectedPlayerId);

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
      color: !isNumber(row.expected_minus_actual_m)
        ? colors.muted
        : row.expected_minus_actual_m >= 0
          ? colors.positive
          : colors.negative,
      opacity: selectedVisible && row.player_id !== state.selectedPlayerId ? 0.8 : 0.9,
    },
  }));

  const avatarData = highlighted.map((row) => ({
    value: [row[state.xMetric], row[state.yMetric]],
    row,
    symbol: `image://${row.headshot_file}`,
    symbolSize: row.player_id === state.selectedPlayerId ? 46 : 34,
    itemStyle: { opacity: 1 },
  }));

  chart.setOption({
    animationDuration: 300,
    backgroundColor: "transparent",
    textStyle: { color: colors.ink, fontFamily: numberFontFamily },
    grid: { left: 20, right: 20, top: 36, bottom: 44, containLabel: true },
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
        blur: { itemStyle: { opacity: 0.8 } },
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
        itemStyle: { opacity: 1 },
        emphasis: { focus: "self", scale: 1.18, itemStyle: { opacity: 1 } },
        blur: { itemStyle: { opacity: 1 } },
        select: { itemStyle: { opacity: 1 } },
      },
    ],
  }, true);
}
