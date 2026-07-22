import {
  metricLabels,
  metricOrder,
  average,
  formatMoney,
  formatSurplusHtml,
  teamLogoPath,
  ordinal,
} from "./format.js?v=20260722-4";
import { state, applyFilters, teamScopeRows, extremePlayer, teamRank } from "./state.js?v=20260722-4";
import {
  setupTeamPicker,
  updateTeamPicker,
  setTeamPickerOpen,
  moveActiveOption,
  setActiveOptionEdge,
  getActiveOption,
} from "./teamPicker.js?v=20260722-4";
import { initChart, rebuildChart, resizeChart, updateChart } from "./chart.js?v=20260722-4";
import {
  setupTable,
  updateTable,
  syncTableSelection,
  syncBeeswarmMetricHeader,
} from "./table.js?v=20260722-4";
import {
  initBeeswarm,
  rebuildBeeswarm,
  resizeBeeswarm,
  updateBeeswarm,
} from "./beeswarm.js?v=20260722-4";
import { initTheme, setThemeByIndex, getTheme, getThemeIndex, getThemeLabel } from "./theme.js?v=20260722-4";
import { applyUrlState, writeUrlState } from "./urlState.js?v=20260722-4";

const DEPLOY_VERSION = "20260722-4";

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
  teamPicker: document.getElementById("teamPicker"),
  teamFilterButton: document.getElementById("teamFilterButton"),
  teamFilterLogo: document.getElementById("teamFilterLogo"),
  teamFilterLabel: document.getElementById("teamFilterLabel"),
  teamFilterMenu: document.getElementById("teamFilterMenu"),
  playerSearch: document.getElementById("playerSearch"),
  xMetric: document.getElementById("xMetric"),
  yMetric: document.getElementById("yMetric"),
  avatarToggle: document.getElementById("avatarToggle"),
  resetBtn: document.getElementById("resetBtn"),
  chart: document.getElementById("chart"),
  chartEmpty: document.getElementById("chartEmpty"),
  chartStatus: document.getElementById("chartStatus"),
  chartXMetricLabel: document.getElementById("chartXMetricLabel"),
  chartYMetricLabel: document.getElementById("chartYMetricLabel"),
  beeswarmChart: document.getElementById("beeswarmChart"),
  beeswarmEmpty: document.getElementById("beeswarmEmpty"),
  beeswarmTitle: document.getElementById("beeswarmTitle"),
  beeswarmStatus: document.getElementById("beeswarmStatus"),
  selectedPlayer: document.getElementById("selectedPlayer"),
  themeSlider: document.getElementById("themeSlider"),
};

let resizeTimer;
let urlTimer;

function scheduleUrlWrite() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrlState, 200);
}

function teamRankHtml(field) {
  if (state.searchTerm.trim()) return "";
  const rank = teamRank(field, state.selectedTeam);
  if (!rank) return "";
  return `<span class="team-rank" title="30 支球队中按平均值从高到低排名">${ordinal(rank)}</span>`;
}

function updatePlayerStat(player, headshot, name) {
  headshot.hidden = !player;
  name.textContent = player ? player.player_name : "—";
  if (player) {
    headshot.src = player.headshot_file;
    headshot.alt = player.player_name;
  }
}

function updateStats() {
  const rows = state.filtered;
  const teamRows = teamScopeRows();
  const isAllTeams = state.selectedTeam === "ALL";
  els.statTeamLogo.hidden = isAllTeams;
  els.statTeamLabel.textContent = isAllTeams ? "全部球队" : state.selectedTeam;
  if (!isAllTeams) {
    els.statTeamLogo.src = teamLogoPath(state.selectedTeam);
    els.statTeamLogo.alt = `${state.selectedTeam} 队徽`;
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
  els.statActual.innerHTML = `<span class="numeric-value">${formatMoney(average(rows, "actual_salary_m"))}</span>${teamRankHtml("actual_salary_m")}`;
  els.statExpected.innerHTML = `<span class="numeric-value">${formatMoney(average(rows, "average_expected_salary_m"))}</span>${teamRankHtml("average_expected_salary_m")}`;
  els.statSurplus.innerHTML = `${formatSurplusHtml(average(rows, "expected_minus_actual_m"))}${teamRankHtml("expected_minus_actual_m")}`;
  els.chartStatus.textContent = `${rows.length} 名球员`;
}

function syncSelectedPlayerLabel() {
  const player = state.data.find((row) => row.player_id === state.selectedPlayerId);
  els.selectedPlayer.textContent = player ? `${player.player_name} · ${player.team_abbreviation}` : "未选中球员";
}

function selectPlayer(playerId) {
  const player = state.data.find((row) => row.player_id === playerId);
  state.selectedPlayerId = player ? playerId : null;
  syncSelectedPlayerLabel();
  if (player) syncTableSelection(playerId);
  updateChart();
  updateBeeswarm();
  scheduleUrlWrite();
}

function selectBeeswarmMetric(field) {
  if (!metricLabels[field]) return;
  state.beeswarmMetric = field;
  syncBeeswarmMetricHeader(field);
  updateBeeswarm();
  scheduleUrlWrite();
}

function refresh() {
  applyFilters();
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
  state.selectedTeam = team;
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
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || els.teamFilterButton.getAttribute("aria-expanded") !== "true") return;
    setTeamPickerOpen(els, false);
    els.teamFilterButton.focus();
  });
  els.playerSearch.addEventListener("input", () => {
    window.clearTimeout(els.playerSearch._timer);
    els.playerSearch._timer = window.setTimeout(() => {
      state.searchTerm = els.playerSearch.value;
      refresh();
    }, 140);
  });
  els.xMetric.addEventListener("change", () => {
    state.xMetric = els.xMetric.value;
    syncChartAxisSummary();
    updateChart();
    scheduleUrlWrite();
  });
  els.yMetric.addEventListener("change", () => {
    state.yMetric = els.yMetric.value;
    syncChartAxisSummary();
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
    state.searchTerm = "";
    state.xMetric = "actual_salary_m";
    state.yMetric = "expected_minus_actual_m";
    state.beeswarmMetric = "average_expected_salary_m";
    state.showAvatars = false;
    state.selectedPlayerId = null;
    updateTeamPicker(els);
    setTeamPickerOpen(els, false);
    els.playerSearch.value = "";
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
    onMetricSelect: selectBeeswarmMetric,
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
  els.chartStatus.textContent = "加载失败";
  els.chartEmpty.textContent = message;
  els.chartEmpty.hidden = false;
  els.beeswarmStatus.textContent = "加载失败";
  els.beeswarmEmpty.textContent = message;
  els.beeswarmEmpty.hidden = false;
});
