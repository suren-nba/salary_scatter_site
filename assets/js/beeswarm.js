import { state } from "./state.js?v=20260722-4";
import {
  escapeHtml,
  formatMoney,
  isNumber,
  metricLabels,
  numberFontFamily,
} from "./format.js?v=20260722-4";
import { getTheme } from "./theme.js?v=20260722-4";

let chart = null;
let chartEl = null;
let emptyEl = null;
let titleEl = null;
let statusEl = null;
let onSelect = null;

const GRID = { left: 62, right: 96, top: 24, bottom: 44 };

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function palette() {
  return {
    ink: cssColor("--ink", "#2c3e50"),
    muted: cssColor("--muted", "#6b7785"),
    positive: cssColor("--positive", "#176a43"),
    negative: cssColor("--negative", "#9d2e2a"),
    panel: cssColor("--panel", "#ffffff"),
    line: cssColor("--line", "rgba(44, 62, 80, 0.14)"),
    accent: cssColor("--accent", "#d9534f"),
  };
}

function metricRows() {
  return state.filtered.filter((row) => isNumber(row[state.beeswarmMetric]));
}

function axisBounds(values) {
  if (!values.length) return { min: 0, max: 1 };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, 1);
  const padding = span * 0.05;
  return {
    min: Math.floor((rawMin - padding) * 10) / 10,
    max: Math.ceil((rawMax + padding) * 10) / 10,
  };
}

function offsetCandidates(plotWidth, pointDiameter) {
  const laneCount = Math.max(7, Math.floor(plotWidth / pointDiameter));
  const step = 1.8 / Math.max(1, laneCount - 1);
  const candidates = [0];
  for (let lane = 1; lane < laneCount; lane += 1) {
    const magnitude = Math.ceil(lane / 2) * step;
    candidates.push(lane % 2 ? magnitude : -magnitude);
  }
  return candidates.filter((value) => Math.abs(value) <= 0.92);
}

function fallbackOffset(playerId) {
  const hash = Math.abs(Number(playerId) * 2654435761) % 1000;
  return (hash / 999) * 1.8 - 0.9;
}

function buildSwarm(rows) {
  const field = state.beeswarmMetric;
  const sorted = rows.slice().sort((a, b) => (
    b[field] - a[field]
    || a.player_name.localeCompare(b.player_name)
    || Number(a.player_id) - Number(b.player_id)
  ));
  const values = sorted.map((row) => row[field]);
  const bounds = axisBounds(values);
  const range = Math.max(bounds.max - bounds.min, 1);
  const plotWidth = Math.max(120, (chartEl?.clientWidth || 360) - GRID.left - GRID.right);
  const plotHeight = Math.max(280, (chartEl?.clientHeight || 560) - GRID.top - GRID.bottom);
  const pointRadius = rows.length > 350 ? 4 : rows.length > 120 ? 5 : 6;
  const minDistance = pointRadius * 2 + 1;
  const candidates = offsetCandidates(plotWidth, minDistance);
  const placed = [];
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawRange = Math.max(rawMax - rawMin, 1);

  sorted.forEach((row) => {
    const value = row[field];
    const yPx = ((bounds.max - value) / range) * plotHeight;
    let x = null;

    for (const candidate of candidates) {
      const xPx = ((candidate + 1) / 2) * plotWidth;
      let overlaps = false;
      for (let index = placed.length - 1; index >= 0; index -= 1) {
        const other = placed[index];
        const yDistance = yPx - other.yPx;
        if (yDistance >= minDistance) break;
        const xDistance = xPx - other.xPx;
        if ((xDistance * xDistance) + (yDistance * yDistance) < minDistance * minDistance) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        x = candidate;
        break;
      }
    }

    if (x === null) x = fallbackOffset(row.player_id);
    const xPx = ((x + 1) / 2) * plotWidth;
    const colorRank = (value - rawMin) / rawRange;
    const point = { value: [x, value, colorRank], row, xPx, yPx, colorRank };
    placed.push(point);
  });

  return { points: placed, bounds, pointRadius };
}

function leagueRank(row) {
  const field = state.beeswarmMetric;
  const value = row[field];
  const leagueRows = state.data.filter((item) => isNumber(item[field]));
  return {
    rank: 1 + leagueRows.filter((item) => item[field] > value).length,
    total: leagueRows.length,
  };
}

function tooltipHtml(row) {
  const field = state.beeswarmMetric;
  const signed = field === "expected_minus_actual_m";
  const ranking = leagueRank(row);
  return `
    <div class="chart-tooltip beeswarm-tooltip">
      <div class="chart-tooltip__top">
        <img class="avatar" src="${escapeHtml(row.headshot_file)}" alt="${escapeHtml(row.player_name)}" loading="lazy" onerror="this.style.display='none'">
        <div>
          <h3>${escapeHtml(row.player_name)}</h3>
          <p>${escapeHtml(row.team_abbreviation)} · ${escapeHtml(row.team_name)}</p>
        </div>
      </div>
      <div class="tooltip-metrics">
        <div><span>${escapeHtml(metricLabels[field])}</span><strong>${formatMoney(row[field], signed)}</strong></div>
        <div><span>联盟排名</span><strong>#${ranking.rank} / ${ranking.total}</strong></div>
      </div>
    </div>
  `;
}

export function initBeeswarm(el, emptyElement, {
  titleElement,
  statusElement,
  onSelect: onSelectCallback,
} = {}) {
  chartEl = el;
  emptyEl = emptyElement;
  titleEl = titleElement;
  statusEl = statusElement;
  onSelect = onSelectCallback;
  chart = echarts.init(chartEl, getTheme() === "dark" ? "dark" : null, { renderer: "canvas" });
  if (emptyEl && !chartEl.contains(emptyEl)) chartEl.appendChild(emptyEl);
  chart.on("click", (params) => {
    if (params.data?.row && onSelect) onSelect(params.data.row.player_id);
  });
  return chart;
}

export function rebuildBeeswarm() {
  if (!chartEl) return;
  if (chart) chart.dispose();
  initBeeswarm(chartEl, emptyEl, {
    titleElement: titleEl,
    statusElement: statusEl,
    onSelect,
  });
  updateBeeswarm();
}

export function resizeBeeswarm() {
  if (!chart) return;
  chart.resize();
  updateBeeswarm();
}

export function updateBeeswarm() {
  if (!chart || !chartEl) return;
  const colors = palette();
  const rows = metricRows();
  const field = state.beeswarmMetric;
  const label = metricLabels[field];
  const signed = field === "expected_minus_actual_m";

  if (titleEl) titleEl.textContent = `${label}分布`;
  if (statusEl) statusEl.textContent = `${rows.length} 名球员`;
  chartEl.setAttribute("aria-label", `${label}蜂群分布图，共 ${rows.length} 名球员`);

  if (emptyEl) {
    emptyEl.hidden = rows.length > 0;
    if (!rows.length) emptyEl.textContent = "当前筛选没有可用于该指标的球员";
  }
  if (!rows.length) {
    chart.clear();
    return;
  }

  const { points, bounds, pointRadius } = buildSwarm(rows);
  const selected = points.find((point) => point.row.player_id === state.selectedPlayerId) || null;
  const baseData = points
    .filter((point) => point !== selected)
    .map((point) => ({
      value: point.value,
      row: point.row,
      itemStyle: { opacity: selected ? 0.38 : 0.78 },
    }));
  const selectedData = selected ? [{ value: selected.value, row: selected.row }] : [];
  const labelPosition = selected && selected.value[0] > 0 ? "left" : "right";

  chart.setOption({
    animationDuration: 260,
    animationDurationUpdate: 220,
    backgroundColor: "transparent",
    textStyle: { color: colors.ink, fontFamily: numberFontFamily },
    grid: GRID,
    tooltip: {
      trigger: "item",
      confine: true,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 12,
      backgroundColor: colors.panel,
      textStyle: { color: colors.ink },
      extraCssText: "box-shadow:0 14px 38px rgba(0,0,0,.18);border-radius:8px;",
      formatter: (params) => tooltipHtml(params.data.row),
    },
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      dimension: 2,
      seriesIndex: [0, 2],
      inRange: { color: [colors.negative, colors.muted, colors.positive] },
    },
    xAxis: {
      type: "value",
      min: -1,
      max: 1,
      show: false,
    },
    yAxis: {
      type: "value",
      min: bounds.min,
      max: bounds.max,
      axisLabel: {
        color: colors.muted,
        formatter: (value) => formatMoney(value, signed),
      },
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { lineStyle: { color: colors.line } },
      splitLine: { lineStyle: { color: colors.line, type: "dashed" } },
    },
    series: [
      {
        name: label,
        type: "scatter",
        data: baseData,
        symbolSize: pointRadius * 2,
        clip: false,
        emphasis: { focus: "self", scale: 1.35 },
      },
      {
        name: "选中外圈",
        type: "scatter",
        data: selectedData,
        symbolSize: pointRadius * 4.8,
        silent: true,
        clip: false,
        itemStyle: {
          color: "rgba(0,0,0,0)",
          borderColor: colors.accent,
          borderWidth: 2,
          shadowBlur: 12,
          shadowColor: colors.accent,
        },
      },
      {
        name: "选中球员",
        type: "scatter",
        data: selectedData,
        symbolSize: pointRadius * 2.8,
        z: 4,
        clip: false,
        itemStyle: {
          borderColor: colors.panel,
          borderWidth: 3,
          opacity: 1,
        },
        label: {
          show: Boolean(selected),
          position: labelPosition,
          distance: 10,
          color: colors.ink,
          backgroundColor: colors.panel,
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: 4,
          padding: [4, 7],
          width: 92,
          overflow: "break",
          lineHeight: 15,
          fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--body-font").trim(),
          fontSize: 12,
          formatter: (params) => params.data.row.player_name,
        },
      },
    ],
  }, true);
}
