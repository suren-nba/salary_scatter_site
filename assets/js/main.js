import {
  metricLabels,
  metricOrder,
  aggregate,
  formatMoney,
  formatSurplusHtml,
  isDifferenceMetric,
  isLastSeasonMetric,
  teamLogoPath,
  ordinal,
  teamDisplayName,
  teamHasLogo,
} from "./format.js?v=20260728-6";
import { state, applyFilters, teamScopeRows, extremePlayer, teamRank } from "./state.js?v=20260728-6";
import {
  setupTeamPicker,
  updateTeamPicker,
  setTeamPickerOpen,
  moveActiveOption,
  setActiveOptionEdge,
  getActiveOption,
} from "./teamPicker.js?v=20260807-1";
import {
  initChart,
  resizeChart,
  updateChart,
  createChartShareBlob,
  getChartShareTitle,
} from "./chart.js?v=20260730-2";
import {
  setupTable,
  updateTable,
  syncTableSelection,
  syncBeeswarmMetricHeader,
  syncTableScopeFilters,
  downloadTableData,
} from "./table.js?v=20260731-3";
import {
  initBeeswarm,
  resizeBeeswarm,
  updateBeeswarm,
} from "./beeswarm.js?v=20260728-8";
import { initTheme, setThemeByIndex, getTheme, getThemeIndex, getThemeLabel } from "./theme.js?v=20260728-6";
import { applyUrlState, writeUrlState } from "./urlState.js?v=20260728-6";

const els = {
  statTeam: document.getElementById("statTeam"),
  statTeamLogo: document.getElementById("statTeamLogo"),
  statTeamLabel: document.getElementById("statTeamLabel"),
  statBestValueLabel: document.getElementById("statBestValueLabel"),
  statBestValueHeadshot: document.getElementById("statBestValueHeadshot"),
  statBestValueName: document.getElementById("statBestValueName"),
  statMostOverpaidLabel: document.getElementById("statMostOverpaidLabel"),
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
  cardRankingMode: document.getElementById("cardRankingMode"),
  xMetric: document.getElementById("xMetric"),
  yMetric: document.getElementById("yMetric"),
  avatarToggle: document.getElementById("avatarToggle"),
  resetBtn: document.getElementById("resetBtn"),
  downloadDataButton: document.getElementById("downloadDataButton"),
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
let hoverFrame;
let shareBlob = null;
let sharePrepareToken = 0;
const shareActionResetTimers = new Map();
const rankingModeLabels = {
  average: "平均",
  median: "中位数",
  total: "总数",
};

function scheduleUrlWrite() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(writeUrlState, 200);
}

function teamRankHtml(field) {
  const rank = teamRank(
    field,
    state.selectedTeam,
    state.cardRankingMode,
    state.selectedPosition,
  );
  if (!rank) return "";
  const greenPercent = ((30 - rank) / 29) * 100;
  const modeLabel = rankingModeLabels[state.cardRankingMode];
  return `<span class="team-rank" style="--rank-color:color-mix(in srgb,var(--positive) ${greenPercent.toFixed(1)}%,var(--negative))" title="30 支球队中按${modeLabel}从高到低排名">${ordinal(rank)}</span>`;
}

function updatePlayerStat(player, headshot, name) {
  headshot.hidden = !player?.headshot_file;
  name.textContent = player ? player.player_name : "--";
  if (player) {
    name.href = `./player.html?id=${encodeURIComponent(player.player_id)}`;
    name.title = `查看 ${player.player_name} 的球员页面`;
  } else {
    name.removeAttribute("href");
    name.removeAttribute("title");
  }
  if (player?.headshot_file) {
    headshot.src = player.headshot_file;
    headshot.alt = player.player_name;
  } else {
    headshot.removeAttribute("src");
    headshot.alt = "";
  }
}

function metricAggregateHtml(rows, field) {
  const value = aggregate(rows, field, state.cardRankingMode);
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
  const useLastSeason = state.selectedTeam === "NA" || isLastSeasonMetric(state.beeswarmMetric);
  const seasonLabel = useLastSeason ? "上赛季" : "新赛季";
  const valueDifferenceField = useLastSeason
    ? "last_season_expected_minus_actual_m"
    : "expected_minus_actual_m";
  els.statBestValueLabel.textContent = `${seasonLabel}最超值球员`;
  els.statMostOverpaidLabel.textContent = `${seasonLabel}最溢价球员`;
  updatePlayerStat(
    extremePlayer(teamRows, "max", valueDifferenceField),
    els.statBestValueHeadshot,
    els.statBestValueName,
  );
  updatePlayerStat(
    extremePlayer(teamRows, "min", valueDifferenceField),
    els.statMostOverpaidHeadshot,
    els.statMostOverpaidName,
  );
  els.statXMetricLabel.textContent = `X轴指标 · ${metricLabels[state.xMetric]}`;
  els.statYMetricLabel.textContent = `Y轴指标 · ${metricLabels[state.yMetric]}`;
  els.statActual.innerHTML = metricAggregateHtml(rows, state.xMetric);
  els.statExpected.innerHTML = metricAggregateHtml(rows, state.yMetric);
  const activeMetric = state.beeswarmMetric;
  els.statMetricLabel.textContent = `表格列指标 · ${metricLabels[activeMetric]}`;
  els.statSurplus.innerHTML = metricAggregateHtml(rows, activeMetric);
}

function setShareActionsDisabled(disabled) {
  els.chartShareMenu.querySelectorAll("[data-share-action]").forEach((button) => {
    button.disabled = disabled;
  });
}

function resetShareActionState(button) {
  window.clearTimeout(shareActionResetTimers.get(button));
  shareActionResetTimers.delete(button);
  button.dataset.state = "idle";
  button.removeAttribute("aria-label");
}

function resetShareActionStates() {
  els.chartShareMenu.querySelectorAll("[data-share-action]").forEach(resetShareActionState);
}

function setShareActionState(button, status, message, { autoReset = true } = {}) {
  window.clearTimeout(shareActionResetTimers.get(button));
  button.dataset.state = status;
  const label = button.querySelector(".share-action__label")?.textContent || "分享操作";
  button.setAttribute("aria-label", `${label}：${message}`);
  els.chartShareFeedback.textContent = message;
  if (!autoReset || (status !== "success" && status !== "error")) return;
  const timer = window.setTimeout(() => resetShareActionState(button), 3000);
  shareActionResetTimers.set(button, timer);
}

function setShareMenuOpen(open) {
  els.chartShareButton.setAttribute("aria-expanded", String(open));
  els.chartShareMenu.hidden = !open;
  if (!open) return;
  shareBlob = null;
  resetShareActionStates();
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
      els.chartShareMenu.querySelectorAll("[data-share-action]").forEach((button) => {
        setShareActionState(button, "error", "图片生成失败，请重新打开分享菜单重试", { autoReset: false });
      });
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
  if (!shareBlob) throw new Error("图片尚未准备完成，请稍后重试");
  if (action === "download") {
    const url = URL.createObjectURL(shareBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "salary-scatter.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { status: "success", message: "图片已下载" };
  }
  if (action === "copy") {
    await copyShareImage();
    return { status: "success", message: "图片已复制，可直接粘贴" };
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
        return { status: "success", message: "分享已完成" };
      } catch (error) {
        if (error?.name !== "AbortError") throw error;
        return { status: "error", message: "已取消分享" };
      }
    }
    await copyShareImage();
    return { status: "success", message: "设备不支持系统分享，图片已复制" };
  }
  throw new Error("未知分享操作");
}

function syncSelectedPlayerLabel() {
  const player = state.data.find((row) => row.player_id === state.selectedPlayerId);
  els.selectedPlayer.textContent = player
    ? `${player.player_name} · ${teamDisplayName(player.team_abbreviation)} · ${player.position}`
    : "未选中球员";
}

function selectPlayer(playerId) {
  window.cancelAnimationFrame(hoverFrame);
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
  window.cancelAnimationFrame(hoverFrame);
  hoverFrame = window.requestAnimationFrame(updateBeeswarm);
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

function setSharedScope({
  team = state.selectedTeam,
  position = state.selectedPosition,
  closeTeamPicker = false,
} = {}) {
  const enteringNoTeam = team === "NA" && state.selectedTeam !== "NA";
  state.selectedTeam = team;
  state.selectedPosition = position;
  if (enteringNoTeam) {
    state.xMetric = "last_season_actual_salary_m";
    state.yMetric = "last_season_expected_minus_actual_m";
    els.xMetric.value = state.xMetric;
    els.yMetric.value = state.yMetric;
    syncChartAxisSummary();
  }
  updateTeamPicker(els);
  els.positionFilter.value = state.selectedPosition;
  syncTableScopeFilters(state.selectedTeam, state.selectedPosition);
  if (closeTeamPicker) setTeamPickerOpen(els, false);
  refresh();
}

function chooseTeam(team) {
  setSharedScope({ team, closeTeamPicker: true });
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
    const pendingMessages = {
      social: "正在打开系统分享…",
      copy: "正在复制图片…",
      download: "正在下载图片…",
    };
    setShareActionState(actionButton, "pending", pendingMessages[actionButton.dataset.shareAction]);
    setShareActionsDisabled(true);
    runShareAction(actionButton.dataset.shareAction)
      .then(({ status, message }) => {
        setShareActionState(actionButton, status, message);
      })
      .catch((error) => {
        setShareActionState(actionButton, "error", error.message || "操作失败，请重试");
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
    setSharedScope({ position: els.positionFilter.value });
  });
  els.cardRankingMode.addEventListener("change", () => {
    state.cardRankingMode = els.cardRankingMode.value;
    updateStats();
    updateBeeswarm();
    scheduleUrlWrite();
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
  els.downloadDataButton.addEventListener("click", downloadTableData);
  els.resetBtn.addEventListener("click", () => {
    state.selectedTeam = "ALL";
    state.selectedPosition = "ALL";
    state.cardRankingMode = "average";
    state.xMetric = "actual_salary_m";
    state.yMetric = "expected_minus_actual_m";
    state.beeswarmMetric = "average_expected_salary_m";
    state.showAvatars = true;
    state.selectedPlayerId = null;
    state.hoveredPlayerId = null;
    state.tableVisiblePlayerIds = null;
    updateTeamPicker(els);
    setTeamPickerOpen(els, false);
    els.positionFilter.value = state.selectedPosition;
    syncTableScopeFilters(state.selectedTeam, state.selectedPosition);
    els.cardRankingMode.value = state.cardRankingMode;
    els.xMetric.value = state.xMetric;
    els.yMetric.value = state.yMetric;
    syncChartAxisSummary();
    els.avatarToggle.checked = true;
    els.selectedPlayer.textContent = "未选中球员";
    syncBeeswarmMetricHeader(state.beeswarmMetric);
    refresh();
  });
  els.themeSlider.addEventListener("input", () => {
    setThemeByIndex(Number(els.themeSlider.value));
    syncThemeSlider();
    updateChart();
    updateBeeswarm();
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeChart();
      resizeBeeswarm();
    }, 120);
  });
}

async function fetchJson() {
  const response = await fetch(
    document.getElementById("salaryDataPreload").href,
    { cache: "force-cache" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load salary data: HTTP ${response.status}`);
  }
  return response.json();
}

async function init() {
  if (!window.echarts || !window.Tabulator) {
    throw new Error("ECharts or Tabulator did not load.");
  }
  initTheme(() => {
    syncThemeSlider();
    updateChart();
    updateBeeswarm();
  });
  syncThemeSlider();

  const data = await fetchJson();
  state.data = data;

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
    onScopeFilterChange: ({ team, position }) => {
      setSharedScope({ team, position });
    },
  });
  tableInstance.on("tableBuilt", () => {
    syncTableScopeFilters(state.selectedTeam, state.selectedPosition);
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
