import {
  metricLabels,
  metricOrder,
  average,
  formatMoney,
  formatSurplusHtml,
  isDifferenceMetric,
  teamLogoPath,
  ordinal,
  teamDisplayName,
  teamHasLogo,
} from "./format.js?v=20260727-8";
import { state, applyFilters, teamScopeRows, extremePlayer, teamRank } from "./state.js?v=20260727-8";
import {
  setupTeamPicker,
  updateTeamPicker,
  setTeamPickerOpen,
  moveActiveOption,
  setActiveOptionEdge,
  getActiveOption,
} from "./teamPicker.js?v=20260727-8";
import {
  initChart,
  rebuildChart,
  resizeChart,
  updateChart,
  createChartShareBlob,
  getChartShareTitle,
} from "./chart.js?v=20260727-8";
import {
  setupTable,
  updateTable,
  syncTableSelection,
  syncBeeswarmMetricHeader,
} from "./table.js?v=20260727-8";
import {
  initBeeswarm,
  rebuildBeeswarm,
  resizeBeeswarm,
  updateBeeswarm,
} from "./beeswarm.js?v=20260727-8";
import { initTheme, setThemeByIndex, getTheme, getThemeIndex, getThemeLabel } from "./theme.js?v=20260727-8";
import { applyUrlState, writeUrlState } from "./urlState.js?v=20260727-8";

const DEPLOY_VERSION = "20260727-8";

const els = {
  statTeam: document.getElementById("statTeam"),
  statTeamLogo: document.getElementById("statTeamLogo"),
  statTeamLabel: document.getElementById("statTeamLabel"),
  statBestValueHeadshot: document.getElementById("statBestValueHeadshot"),
  statBestValueName: document.getElementById("statBestValueName"),
  statMostOverpaidHeadshot: document.getElementById("statMostOverpaidHeadshot"),
  statMostOverpaidName: document.getElementById("statMostOverpaidName"),
  statActual: document.getElementById("statActual"),
  statExpected: document.getElementById("statExpected"),
  statSurplus: document.getElementById("statSurplus"),
  statXMetricLabel: document.getElementById("statXMetricLabel"),
  statYMetricLabel: document.getElementById("statYMetricLabel"),
  statMetricLabel: document.getElementById("statMetricLabel"),
  teamPicker: document.getElementById("teamPicker"),
  teamFilterButton: document.getElementById("teamFilterButton"),
  teamFilterLogo: document.getElementById("teamFilterLogo"),
  teamFilterLabel: document.getElementById("teamFilterLabel"),
  teamFilterMenu: document.getElementById("teamFilterMenu"),
  positionFilter: document.getElementById("positionFilter"),
  xMetric: document.getElementById("xMetric"),
  yMetric: document.getElementById("yMetric"),
  avatarToggle: document.getElementById("avatarToggle"),
  resetBtn: document.getElementById("resetBtn"),
  chart: document.getElementById("chart"),
  chartEmpty: document.getElementById("chartEmpty"),
  chartXMetricLabel: document.getElementById("chartXMetricLabel"),
  chartYMetricLabel: document.getElementById("chartYMetricLabel"),
  chartShare: document.getElementById("chartShare"),
  chartShareButton: document.getElementById("chartShareButton"),
  chartShareMenu: document.getElementById("chartShareMenu"),
  chartShareFeedback: document.getElementById("chartShareFeedback"),
  beeswarmChart: document.getElementById("beeswarmChart"),
  beeswarmEmpty: document.getElementById("beeswarmEmpty"),
  beeswarmTitle: document.getElementById("beeswarmTitle"),
  beeswarmStatus: document.getElementById("beeswarmStatus"),
  selectedPlayer: document.getElementById("selectedPlayer"),
  themeSlider: document.getElementById("themeSlider"),
};

let resizeTimer;
let urlTimer;
let shareBlob = null;
let sharePrepareToken = 0;

function scheduleUrlWrite() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrlState, 200);
}

function teamRankHtml(field) {
  const rank = teamRank(field, state.selectedTeam);
  if (!rank) return "";
  const greenPercent = ((30 - rank) / 29) * 100;
  return `<span class="team-rank" style="--rank-color:color-mix(in srgb,var(--positive) ${greenPercent.toFixed(1)}%,var(--negative))" title="30 支球队中按平均值从高到低排名">${ordinal(rank)}</span>`;
}

function updatePlayerStat(player, headshot, name) {
  headshot.hidden = !player?.headshot_file;
  name.textContent = player ? player.player_name : "--";
  if (player?.headshot_file) {
    headshot.src = player.headshot_file;
    headshot.alt = player.player_name;
  } else {
    headshot.removeAttribute("src");
    headshot.alt = "";
  }
}

function metricAverageHtml(rows, field) {
  const value = average(rows, field);
  return `${
    isDifferenceMetric(field)
      ? formatSurplusHtml(value)
      : `<span class="numeric-value">${formatMoney(value)}</span>`
  }${teamRankHtml(field)}`;
}

function updateStats() {
  const rows = state.filtered;
  const teamRows = teamScopeRows();
  const hasTeamLogo = teamHasLogo(state.selectedTeam);
  els.statTeamLogo.hidden = !hasTeamLogo;
  els.statTeamLabel.textContent = teamDisplayName(state.selectedTeam);
  if (hasTeamLogo) {
    els.statTeamLogo.src = teamLogoPath(state.selectedTeam);
    els.statTeamLogo.alt = `${state.selectedTeam} 队徽`;
  } else {
    els.statTeamLogo.removeAttribute("src");
    els.statTeamLogo.alt = "";
  }
  updatePlayerStat(
    extremePlayer(teamRows, "max"),
    els.statBestValueHeadshot,
    els.statBestValueName,
  );
  updatePlayerStat(
    extremePlayer(teamRows, "min"),
    els.statMostOverpaidHeadshot,
    els.statMostOverpaidName,
  );
  els.statXMetricLabel.textContent = `X轴指标 · ${metricLabels[state.xMetric]}`;
  els.statYMetricLabel.textContent = `Y轴指标 · ${metricLabels[state.yMetric]}`;
  els.statActual.innerHTML = metricAverageHtml(rows, state.xMetric);
  els.statExpected.innerHTML = metricAverageHtml(rows, state.yMetric);
  const activeMetric = state.beeswarmMetric;
  els.statMetricLabel.textContent = `表格列指标 · ${metricLabels[activeMetric]}`;
  els.statSurplus.innerHTML = metricAverageHtml(rows, activeMetric);
}

function setShareActionsDisabled(disabled) {
  els.chartShareMenu.querySelectorAll("[data-share-action]").forEach((button) => {
    button.disabled = disabled;
  });
}

function setShareMenuOpen(open) {
  els.chartShareButton.setAttribute("aria-expanded", String(open));
  els.chartShareMenu.hidden = !open;
  if (!open) return;
  shareBlob = null;
  const token = ++sharePrepareToken;
  setShareActionsDisabled(true);
  els.chartShareFeedback.textContent = "正在准备图片…";
  createChartShareBlob()
    .then((blob) => {
      if (token !== sharePrepareToken) return;
      shareBlob = blob;
      setShareActionsDisabled(false);
      els.chartShareFeedback.textContent = "图片已准备";
    })
    .catch(() => {
      if (token !== sharePrepareToken) return;
      els.chartShareFeedback.textContent = "图片生成失败，请重试";
    });
}

function shareFile() {
  return new File([shareBlob], "salary-scatter.png", { type: "image/png" });
}

async function copyShareImage() {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("当前浏览器不支持复制图片，请使用下载本地");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": shareBlob }),
  ]);
}

async function runShareAction(action) {
  if (!shareBlob) return;
  if (action === "download") {
    const url = URL.createObjectURL(shareBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "salary-scatter.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    els.chartShareFeedback.textContent = "图片已下载";
    return;
  }
  if (action === "copy") {
    await copyShareImage();
    els.chartShareFeedback.textContent = "图片已复制，可直接粘贴";
    return;
  }
  if (action === "social") {
    const file = shareFile();
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title: getChartShareTitle(),
          text: "数据by库昊&via salary.surennba.com",
          files: [file],
        });
        els.chartShareFeedback.textContent = "分享已完成";
      } catch (error) {
        if (error?.name !== "AbortError") throw error;
        els.chartShareFeedback.textContent = "已取消分享";
      }
      return;
    }
    await copyShareImage();
    els.chartShareFeedback.textContent = "设备不支持系统分享，图片已复制";
  }
}

function syncSelectedPlayerLabel() {
  const player = state.data.find((row) => row.player_id === state.selectedPlayerId);
  els.selectedPlayer.textContent = player
    ? `${player.player_name} · ${teamDisplayName(player.team_abbreviation)} · ${player.position}`
    : "未选中球员";
}

function selectPlayer(playerId) {
  const player = state.data.find((row) => row.player_id === playerId);
  state.selectedPlayerId = player ? playerId : null;
  state.hoveredPlayerId = null;
  syncSelectedPlayerLabel();
  syncTableSelection(state.selectedPlayerId);
  updateChart();
  updateBeeswarm();
  scheduleUrlWrite();
}

function hoverPlayer(playerId) {
  const player = state.filtered.find((row) => row.player_id === playerId);
  state.hoveredPlayerId = player ? playerId : null;
  updateBeeswarm();
}

function selectBeeswarmMetric(field) {
  if (!metricLabels[field]) return;
  state.beeswarmMetric = field;
  syncBeeswarmMetricHeader(field);
  updateStats();
  updateBeeswarm();
  scheduleUrlWrite();
}

function setTableVisiblePlayers(playerIds) {
  state.tableVisiblePlayerIds = playerIds;
  if (state.hoveredPlayerId && !playerIds.includes(state.hoveredPlayerId)) {
    state.hoveredPlayerId = null;
  }
  updateBeeswarm();
}

function refresh() {
  applyFilters();
  state.tableVisiblePlayerIds = null;
  state.hoveredPlayerId = null;
  if (state.selectedPlayerId && !state.filtered.some((row) => row.player_id === state.selectedPlayerId)) {
    state.selectedPlayerId = null;
    els.selectedPlayer.textContent = "未选中球员";
  }
  updateStats();
  updateChart();
  updateBeeswarm();
  updateTable(state.selectedPlayerId);
  scheduleUrlWrite();
}

function chooseTeam(team) {
  const enteringNoTeam = team === "NA" && state.selectedTeam !== "NA";
  state.selectedTeam = team;
  if (enteringNoTeam) {
    state.xMetric = "last_season_actual_salary_m";
    state.yMetric = "last_season_expected_minus_actual_m";
    els.xMetric.value = state.xMetric;
    els.yMetric.value = state.yMetric;
    syncChartAxisSummary();
  }
  updateTeamPicker(els);
  setTeamPickerOpen(els, false);
  refresh();
}

function syncThemeSlider() {
  const theme = getTheme();
  const label = getThemeLabel(theme);
  els.themeSlider.value = getThemeIndex(theme);
  els.themeSlider.setAttribute("aria-valuetext", label);
  els.themeSlider.closest(".theme-control").title = `配色主题：${label}`;
}

function syncChartAxisSummary() {
  els.chartXMetricLabel.textContent = metricLabels[state.xMetric];
  els.chartYMetricLabel.textContent = metricLabels[state.yMetric];
}

function setupSelects() {
  metricOrder.forEach((field) => {
    const xOption = new Option(metricLabels[field], field);
    const yOption = new Option(metricLabels[field], field);
    els.xMetric.appendChild(xOption);
    els.yMetric.appendChild(yOption);
  });
  els.xMetric.value = state.xMetric;
  els.yMetric.value = state.yMetric;
  setupTeamPicker(els);
}

function bindEvents() {
  els.chartShareButton.addEventListener("click", () => {
    setShareMenuOpen(els.chartShareButton.getAttribute("aria-expanded") !== "true");
  });
  els.chartShareMenu.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-share-action]");
    if (!actionButton || actionButton.disabled) return;
    setShareActionsDisabled(true);
    runShareAction(actionButton.dataset.shareAction)
      .catch((error) => {
        els.chartShareFeedback.textContent = error.message || "操作失败，请重试";
      })
      .finally(() => setShareActionsDisabled(false));
  });
  els.teamFilterButton.addEventListener("click", () => {
    setTeamPickerOpen(els, els.teamFilterButton.getAttribute("aria-expanded") !== "true");
  });
  els.teamFilterButton.addEventListener("keydown", (event) => {
    const open = els.teamFilterButton.getAttribute("aria-expanded") === "true";
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setTeamPickerOpen(els, true);
      if (event.key === "ArrowDown") moveActiveOption(els, 0);
      else setActiveOptionEdge(els, "last");
      return;
    }
    if (!open) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActiveOption(els, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActiveOption(els, -1);
        break;
      case "Home":
        event.preventDefault();
        setActiveOptionEdge(els, "first");
        break;
      case "End":
        event.preventDefault();
        setActiveOptionEdge(els, "last");
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const active = getActiveOption(els);
        if (active) chooseTeam(active.dataset.team);
        break;
      }
    }
  });
  els.teamFilterMenu.addEventListener("click", (event) => {
    const option = event.target.closest(".team-picker__option");
    if (!option) return;
    chooseTeam(option.dataset.team);
  });
  document.addEventListener("click", (event) => {
    if (!els.teamPicker.contains(event.target)) setTeamPickerOpen(els, false);
    if (!els.chartShare.contains(event.target)) setShareMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (els.teamFilterButton.getAttribute("aria-expanded") === "true") {
      setTeamPickerOpen(els, false);
      els.teamFilterButton.focus();
    }
    if (els.chartShareButton.getAttribute("aria-expanded") === "true") {
      setShareMenuOpen(false);
      els.chartShareButton.focus();
    }
  });
  els.positionFilter.addEventListener("change", () => {
    state.selectedPosition = els.positionFilter.value;
    refresh();
  });
  els.xMetric.addEventListener("change", () => {
    state.xMetric = els.xMetric.value;
    syncChartAxisSummary();
    updateStats();
    updateChart();
    scheduleUrlWrite();
  });
  els.yMetric.addEventListener("change", () => {
    state.yMetric = els.yMetric.value;
    syncChartAxisSummary();
    updateStats();
    updateChart();
    scheduleUrlWrite();
  });
  els.avatarToggle.addEventListener("change", () => {
    state.showAvatars = els.avatarToggle.checked;
    updateChart();
    scheduleUrlWrite();
  });
  els.resetBtn.addEventListener("click", () => {
    state.selectedTeam = "ALL";
    state.selectedPosition = "ALL";
    state.xMetric = "actual_salary_m";
    state.yMetric = "expected_minus_actual_m";
    state.beeswarmMetric = "average_expected_salary_m";
    state.showAvatars = false;
    state.selectedPlayerId = null;
    state.hoveredPlayerId = null;
    state.tableVisiblePlayerIds = null;
    updateTeamPicker(els);
    setTeamPickerOpen(els, false);
    els.positionFilter.value = state.selectedPosition;
    els.xMetric.value = state.xMetric;
    els.yMetric.value = state.yMetric;
    syncChartAxisSummary();
    els.avatarToggle.checked = false;
    els.selectedPlayer.textContent = "未选中球员";
    syncBeeswarmMetricHeader(state.beeswarmMetric);
    refresh();
  });
  els.themeSlider.addEventListener("input", () => {
    setThemeByIndex(Number(els.themeSlider.value));
    syncThemeSlider();
    rebuildChart();
    rebuildBeeswarm();
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeChart();
      resizeBeeswarm();
    }, 120);
  });
}

async function fetchJson(path) {
  const response = await fetch(`${path}?v=${DEPLOY_VERSION}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json();
}

async function init() {
  if (!window.echarts || !window.Tabulator) {
    throw new Error("ECharts or Tabulator did not load.");
  }
  initTheme(() => {
    syncThemeSlider();
    rebuildChart();
    rebuildBeeswarm();
  });
  syncThemeSlider();

  const [data, metadata] = await Promise.all([
    fetchJson("./data/salary_scatter_web.json"),
    fetchJson("./data/metadata.json"),
  ]);
  state.data = data;
  state.metadata = metadata;

  setupSelects();
  initChart(els.chart, els.chartEmpty, { onSelect: selectPlayer });
  initBeeswarm(els.beeswarmChart, els.beeswarmEmpty, {
    titleElement: els.beeswarmTitle,
    statusElement: els.beeswarmStatus,
    onSelect: selectPlayer,
  });
  applyUrlState(els);
  syncChartAxisSummary();
  updateTeamPicker(els);
  syncSelectedPlayerLabel();
  applyFilters();
  const tableInstance = setupTable("#salaryTable", {
    onRowClick: (playerId) => selectPlayer(playerId),
    onRowHover: hoverPlayer,
    onMetricSelect: selectBeeswarmMetric,
    onVisibleRowsChange: setTableVisiblePlayers,
  });
  tableInstance.on("tableBuilt", () => {
    if (state.selectedPlayerId) syncTableSelection(state.selectedPlayerId);
  });
  updateStats();
  updateChart();
  updateBeeswarm();
  bindEvents();
  scheduleUrlWrite();
}

init().catch((error) => {
  console.error(error);
  const message = "数据加载失败，请检查网络连接或稍后刷新。";
  els.chartEmpty.textContent = message;
  els.chartEmpty.hidden = false;
  els.beeswarmStatus.textContent = "加载失败";
  els.beeswarmEmpty.textContent = message;
  els.beeswarmEmpty.hidden = false;
});
