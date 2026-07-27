import {
  escapeHtml,
  formatMoney,
  isDifferenceMetric,
  isNumber,
  metricLabels,
  metricOrder,
  teamDisplayName,
} from "./format.js?v=20260728-3";
import {
  getTheme,
  getThemeIndex,
  getThemeLabel,
  initTheme,
  setThemeByIndex,
} from "./theme.js?v=20260728-3";

const DEPLOY_VERSION = "20260728-4";

const state = {
  data: [],
  selectedTeam: "ALL",
  selectedPlayerId: null,
  scope: "league",
};

const els = {
  teamFilter: document.getElementById("playerTeamFilter"),
  playerFilter: document.getElementById("playerFilter"),
  scopeButtons: [...document.querySelectorAll("[data-scope]")],
  profileHeader: document.getElementById("playerProfileHeader"),
  portraitWrap: document.getElementById("playerPortraitWrap"),
  portrait: document.getElementById("playerPortrait"),
  eyebrow: document.getElementById("playerEyebrow"),
  name: document.getElementById("playerName"),
  meta: document.getElementById("playerMeta"),
  benchmarkLabel: document.getElementById("benchmarkLabel"),
  benchmarkCount: document.getElementById("benchmarkCount"),
  metricGroups: document.getElementById("metricGroups"),
  themeSlider: document.getElementById("themeSlider"),
  share: document.getElementById("playerShare"),
  shareButton: document.getElementById("playerShareButton"),
  shareMenu: document.getElementById("playerShareMenu"),
  shareFeedback: document.getElementById("playerShareFeedback"),
};

let shareBlob = null;
let sharePrepareToken = 0;

const metricGroups = [
  {
    title: "新赛季预测与合同",
    description: "模型预测、实际薪资与合同价值差",
    fields: metricOrder.slice(0, 5),
  },
  {
    title: "上赛季表现与合同",
    description: "表现折算薪资、实际薪资与合同价值差",
    fields: metricOrder.slice(5),
  },
];

function selectedPlayer() {
  return state.data.find((row) => row.player_id === state.selectedPlayerId) || null;
}

function playerOptions() {
  return state.data
    .filter((row) => state.selectedTeam === "ALL" || row.team_abbreviation === state.selectedTeam)
    .slice()
    .sort((a, b) => a.player_name.localeCompare(b.player_name));
}

function comparisonRows(player, field) {
  return state.data.filter((row) => (
    isNumber(row[field])
    && (state.scope === "league" || row.position === player.position)
  ));
}

function standing(player, field) {
  if (!isNumber(player[field])) return null;
  const rows = comparisonRows(player, field);
  const value = player[field];
  const rank = 1 + rows.filter((row) => row[field] > value).length;
  const below = rows.filter((row) => row[field] < value).length;
  const percentile = rows.length <= 1 ? 100 : (below / (rows.length - 1)) * 100;
  return { rank, total: rows.length, percentile };
}

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function colorChannels(color) {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [
      Number.parseInt(hex[1].slice(0, 2), 16),
      Number.parseInt(hex[1].slice(2, 4), 16),
      Number.parseInt(hex[1].slice(4, 6), 16),
    ];
  }
  const rgb = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return rgb ? rgb.slice(1, 4).map(Number) : [107, 119, 133];
}

function mixColor(first, second, firstWeight) {
  const a = colorChannels(first);
  const b = colorChannels(second);
  const weight = Math.max(0, Math.min(1, firstWeight));
  const channels = a.map((value, index) => Math.round(value * weight + b[index] * (1 - weight)));
  return `rgb(${channels.join(",")})`;
}

function sharePalette() {
  return {
    ink: cssColor("--ink", "#2c3e50"),
    muted: cssColor("--muted", "#6b7785"),
    panel: cssColor("--panel", "#ffffff"),
    line: cssColor("--line", "rgba(44, 62, 80, 0.14)"),
    topbar: cssColor("--dark", "#CA5C55"),
    positive: cssColor("--positive", "#176a43"),
    negative: cssColor("--negative", "#9d2e2a"),
    track: cssColor("--table-head-bg", "#f5efe4"),
    bodyFont: cssColor("--body-font", "sans-serif"),
    numberFont: cssColor("--number-font", "monospace"),
  };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("球员头像加载失败"));
    image.src = source;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("球员分享图片生成失败"));
    }, "image/png");
  });
}

function drawHeadshot(context, image, x, y, size, colors) {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = colors.track;
  context.fillRect(x, y, size, size);
  const scale = Math.min(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
  context.restore();
  context.strokeStyle = colors.topbar;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2 - 1.5, 0, Math.PI * 2);
  context.stroke();
}

function drawMetricRow(context, player, field, y, colors) {
  const result = standing(player, field);
  const trackX = 390;
  const trackWidth = 800;
  const trackHeight = 26;
  const rawValueX = 1235;

  context.textBaseline = "middle";
  context.textAlign = "right";
  context.fillStyle = colors.ink;
  context.font = `800 24px ${colors.bodyFont}`;
  context.fillText(metricLabels[field], 350, y);

  context.fillStyle = colors.track;
  context.fillRect(trackX, y - trackHeight / 2, trackWidth, trackHeight);
  context.strokeStyle = colors.line;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(trackX + trackWidth / 2, y - 21);
  context.lineTo(trackX + trackWidth / 2, y + 21);
  context.stroke();

  context.textAlign = "left";
  if (!result) {
    context.fillStyle = colors.muted;
    context.font = `800 24px ${colors.numberFont}`;
    context.fillText("--", rawValueX, y);
    return;
  }

  const metricColor = mixColor(colors.positive, colors.negative, result.percentile / 100);
  const fillWidth = trackWidth * result.percentile / 100;
  context.fillStyle = mixColor(metricColor, colors.panel, 0.78);
  context.strokeStyle = metricColor;
  context.lineWidth = 2;
  context.fillRect(trackX, y - trackHeight / 2, fillWidth, trackHeight);
  context.strokeRect(trackX, y - trackHeight / 2, fillWidth, trackHeight);

  const badgeRadius = 24;
  const badgeX = Math.max(
    trackX + badgeRadius,
    Math.min(trackX + trackWidth - badgeRadius, trackX + fillWidth),
  );
  context.fillStyle = mixColor(metricColor, colors.panel, 0.22);
  context.strokeStyle = metricColor;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(badgeX, y, badgeRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = colors.ink;
  context.textAlign = "center";
  context.font = `900 19px ${colors.numberFont}`;
  context.fillText(String(Math.round(result.percentile)), badgeX, y + 1);

  context.textAlign = "left";
  context.fillStyle = colors.ink;
  context.font = `800 24px ${colors.numberFont}`;
  context.fillText(formatMoney(player[field], isDifferenceMetric(field)), rawValueX, y - 8);
  context.fillStyle = colors.muted;
  context.font = `600 15px ${colors.numberFont}`;
  context.fillText(`${result.rank}/${result.total}`, rawValueX, y + 18);
}

async function createPlayerShareBlob() {
  const player = selectedPlayer();
  if (!player) throw new Error("当前没有可分享的球员");
  const colors = sharePalette();
  const canvas = document.createElement("canvas");
  canvas.width = 1500;
  canvas.height = 1160;
  const context = canvas.getContext("2d");
  context.fillStyle = colors.panel;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.topbar;
  context.fillRect(0, 0, canvas.width, 18);

  let titleX = 90;
  if (player.headshot_file) {
    try {
      const image = await loadImage(player.headshot_file);
      drawHeadshot(context, image, 90, 52, 122, colors);
      titleX = 246;
    } catch {
      titleX = 90;
    }
  }

  const titleSize = Math.max(38, Math.min(58, 760 / Math.max(8, player.player_name.length * 0.62)));
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = colors.ink;
  context.font = `900 ${titleSize}px ${colors.bodyFont}`;
  context.fillText(player.player_name, titleX, 56, 800);
  context.fillStyle = colors.muted;
  context.font = `800 22px ${colors.bodyFont}`;
  const scopeLabel = state.scope === "league" ? "全联盟百分位" : `${player.position}百分位`;
  context.fillText(`${teamDisplayName(player.team_abbreviation)} · ${player.position} · ${scopeLabel}`, titleX, 126);
  context.textAlign = "right";
  context.fillStyle = colors.muted;
  context.font = `700 20px ${colors.numberFont}`;
  context.fillText("数据 by 库昊", 1410, 68);
  context.fillStyle = colors.ink;
  context.font = `900 27px ${colors.numberFont}`;
  context.fillText(`${state.scope === "league" ? state.data.length : state.data.filter((row) => row.position === player.position).length} 名球员`, 1410, 112);

  context.strokeStyle = colors.line;
  context.setLineDash([8, 7]);
  context.beginPath();
  context.moveTo(90, 206);
  context.lineTo(1410, 206);
  context.stroke();
  context.setLineDash([]);

  context.textBaseline = "middle";
  context.fillStyle = colors.muted;
  context.font = `800 17px ${colors.bodyFont}`;
  context.textAlign = "left";
  context.fillText("低位", 390, 244);
  context.textAlign = "center";
  context.fillText("中位", 790, 244);
  context.textAlign = "right";
  context.fillText("高位", 1190, 244);

  context.textAlign = "left";
  context.fillStyle = colors.ink;
  context.font = `900 26px ${colors.bodyFont}`;
  context.fillText(metricGroups[0].title, 90, 286);
  context.textAlign = "right";
  context.fillStyle = colors.muted;
  context.font = `600 16px ${colors.bodyFont}`;
  context.fillText(metricGroups[0].description, 1410, 286);
  metricGroups[0].fields.forEach((field, index) => {
    drawMetricRow(context, player, field, 342 + index * 78, colors);
  });

  context.strokeStyle = colors.line;
  context.setLineDash([8, 7]);
  context.beginPath();
  context.moveTo(90, 728);
  context.lineTo(1410, 728);
  context.stroke();
  context.setLineDash([]);
  context.textAlign = "left";
  context.fillStyle = colors.ink;
  context.font = `900 26px ${colors.bodyFont}`;
  context.fillText(metricGroups[1].title, 90, 770);
  context.textAlign = "right";
  context.fillStyle = colors.muted;
  context.font = `600 16px ${colors.bodyFont}`;
  context.fillText(metricGroups[1].description, 1410, 770);
  metricGroups[1].fields.forEach((field, index) => {
    drawMetricRow(context, player, field, 826 + index * 78, colors);
  });

  context.strokeStyle = colors.line;
  context.beginPath();
  context.moveTo(90, 1080);
  context.lineTo(1410, 1080);
  context.stroke();
  context.textAlign = "left";
  context.fillStyle = colors.muted;
  context.font = `600 17px ${colors.bodyFont}`;
  context.fillText("百分位越高代表该项数值在所选范围内越高 · 数据仅供可视化研究", 90, 1120);
  context.textAlign = "right";
  context.fillText("网站:salary.surennba.com", 1410, 1120);

  return canvasToBlob(canvas);
}

function setShareActionsDisabled(disabled) {
  if (!els.shareMenu) return;
  els.shareMenu.querySelectorAll("[data-player-share-action]").forEach((button) => {
    button.disabled = disabled;
  });
}

function setShareMenuOpen(open) {
  if (!els.shareButton || !els.shareMenu || !els.shareFeedback) return;
  els.shareButton.setAttribute("aria-expanded", String(open));
  els.shareMenu.hidden = !open;
  if (!open) {
    shareBlob = null;
    sharePrepareToken += 1;
    els.shareFeedback.textContent = "";
    return;
  }
  const token = ++sharePrepareToken;
  setShareActionsDisabled(true);
  els.shareFeedback.textContent = "正在准备图片…";
  createPlayerShareBlob()
    .then((blob) => {
      if (token !== sharePrepareToken) return;
      shareBlob = blob;
      setShareActionsDisabled(false);
      els.shareFeedback.textContent = "图片已准备";
    })
    .catch(() => {
      if (token !== sharePrepareToken) return;
      els.shareFeedback.textContent = "图片生成失败，请重试";
    });
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
  const player = selectedPlayer();
  if (action === "download") {
    const url = URL.createObjectURL(shareBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${player?.player_name || "player"}-salary-percentile.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    els.shareFeedback.textContent = "图片已下载";
    return;
  }
  if (action === "copy") {
    await copyShareImage();
    els.shareFeedback.textContent = "图片已复制，可直接粘贴";
    return;
  }
  if (action === "social") {
    const file = new File(
      [shareBlob],
      `${player?.player_name || "player"}-salary-percentile.png`,
      { type: "image/png" },
    );
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({
          title: `${player?.player_name || "球员"}薪资价值百分位`,
          text: "数据by库昊&via salary.surennba.com",
          files: [file],
        });
        els.shareFeedback.textContent = "分享已完成";
      } catch (error) {
        if (error?.name !== "AbortError") throw error;
        els.shareFeedback.textContent = "已取消分享";
      }
      return;
    }
    await copyShareImage();
    els.shareFeedback.textContent = "设备不支持系统分享，图片已复制";
  }
}

function metricRowHtml(player, field) {
  const result = standing(player, field);
  const signed = isDifferenceMetric(field);
  if (!result) {
    return `
      <div class="percentile-row percentile-row--missing">
        <span class="percentile-row__label">${escapeHtml(metricLabels[field])}</span>
        <div class="percentile-track" aria-label="${escapeHtml(metricLabels[field])}暂无数据"></div>
        <span class="percentile-row__value">--</span>
      </div>
    `;
  }
  const rounded = Math.round(result.percentile);
  const percent = `${result.percentile.toFixed(1)}%`;
  return `
    <div class="percentile-row" style="--target-percent:${percent}" data-percent="${percent}">
      <span class="percentile-row__label">${escapeHtml(metricLabels[field])}</span>
      <div class="percentile-track" role="img" aria-label="${escapeHtml(metricLabels[field])}，${rounded} 百分位，${result.rank}/${result.total}">
        <span class="percentile-fill"></span>
        <span class="percentile-badge">${rounded}</span>
      </div>
      <span class="percentile-row__value">
        ${formatMoney(player[field], signed)}
        <small class="percentile-row__rank">${result.rank}/${result.total}</small>
      </span>
    </div>
  `;
}

function renderMetrics(player) {
  els.metricGroups.innerHTML = metricGroups.map((group) => `
    <section class="metric-group">
      <div class="metric-group__title">
        <h3>${group.title}</h3>
        <span>${group.description}</span>
      </div>
      ${group.fields.map((field) => metricRowHtml(player, field)).join("")}
    </section>
  `).join("");

  requestAnimationFrame(() => {
    els.metricGroups.querySelectorAll("[data-percent]").forEach((row) => {
      const percent = row.dataset.percent;
      row.style.setProperty("--percent", percent);
      row.style.setProperty(
        "--metric-color",
        `color-mix(in srgb, var(--positive) ${percent}, var(--negative))`,
      );
    });
  });
}

function updateUrl(player) {
  const url = new URL(window.location.href);
  url.searchParams.set("id", String(player.player_id));
  if (state.scope === "position") url.searchParams.set("scope", "position");
  else url.searchParams.delete("scope");
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function renderPlayer() {
  setShareMenuOpen(false);
  const player = selectedPlayer();
  if (!player) {
    els.name.textContent = "没有找到球员";
    els.meta.innerHTML = "";
    els.metricGroups.innerHTML = '<p class="player-empty">当前筛选中没有可显示的球员。</p>';
    els.portrait.hidden = true;
    els.portraitWrap.classList.add("player-portrait--empty");
    els.profileHeader.classList.add("player-profile__header--no-portrait");
    return;
  }

  document.title = `${player.player_name} · 球员薪资价值百分位`;
  els.name.textContent = player.player_name;
  els.eyebrow.textContent = state.scope === "league" ? "全联盟薪资价值百分位" : `${player.position}球员薪资价值百分位`;
  els.meta.innerHTML = `
    <span>${escapeHtml(teamDisplayName(player.team_abbreviation))}</span>
    <span>${escapeHtml(player.position)}</span>
  `;

  if (player.headshot_file) {
    els.portrait.src = player.headshot_file;
    els.portrait.alt = player.player_name;
    els.portrait.hidden = false;
    els.portraitWrap.classList.remove("player-portrait--empty");
    els.profileHeader.classList.remove("player-profile__header--no-portrait");
  } else {
    els.portrait.removeAttribute("src");
    els.portrait.alt = "";
    els.portrait.hidden = true;
    els.portraitWrap.classList.add("player-portrait--empty");
    els.profileHeader.classList.add("player-profile__header--no-portrait");
  }

  const benchmarkRows = state.scope === "league"
    ? state.data
    : state.data.filter((row) => row.position === player.position);
  els.benchmarkLabel.textContent = state.scope === "league" ? "全联盟百分位" : `${player.position}百分位`;
  els.benchmarkCount.textContent = `${benchmarkRows.length} 名球员`;
  els.scopeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.scope === state.scope));
  });
  renderMetrics(player);
  updateUrl(player);
}

function populateTeamFilter() {
  const teams = [...new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean))]
    .sort((a, b) => {
      if (a === "NA") return 1;
      if (b === "NA") return -1;
      return a.localeCompare(b);
    });
  els.teamFilter.replaceChildren(new Option("全联盟", "ALL"));
  teams.forEach((team) => {
    els.teamFilter.appendChild(new Option(teamDisplayName(team), team));
  });
  els.teamFilter.value = state.selectedTeam;
}

function populatePlayerFilter(preferredPlayerId = state.selectedPlayerId) {
  const players = playerOptions();
  els.playerFilter.replaceChildren();
  players.forEach((player) => {
    els.playerFilter.appendChild(new Option(player.player_name, String(player.player_id)));
  });
  const preferred = players.find((player) => player.player_id === preferredPlayerId);
  state.selectedPlayerId = preferred?.player_id ?? players[0]?.player_id ?? null;
  els.playerFilter.value = state.selectedPlayerId ? String(state.selectedPlayerId) : "";
}

function syncThemeSlider() {
  const theme = getTheme();
  const label = getThemeLabel(theme);
  els.themeSlider.value = getThemeIndex(theme);
  els.themeSlider.setAttribute("aria-valuetext", label);
  els.themeSlider.closest(".theme-control").title = `配色主题：${label}`;
}

function bindEvents() {
  if (els.share && els.shareButton && els.shareMenu && els.shareFeedback) {
    els.shareButton.addEventListener("click", () => {
      setShareMenuOpen(els.shareButton.getAttribute("aria-expanded") !== "true");
    });
    els.shareMenu.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-player-share-action]");
      if (!actionButton || actionButton.disabled) return;
      setShareActionsDisabled(true);
      runShareAction(actionButton.dataset.playerShareAction)
        .catch((error) => {
          els.shareFeedback.textContent = error.message || "操作失败，请重试";
        })
        .finally(() => setShareActionsDisabled(false));
    });
    document.addEventListener("click", (event) => {
      if (!els.share.contains(event.target)) setShareMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || els.shareButton.getAttribute("aria-expanded") !== "true") return;
      setShareMenuOpen(false);
      els.shareButton.focus();
    });
  }
  els.teamFilter.addEventListener("change", () => {
    state.selectedTeam = els.teamFilter.value;
    populatePlayerFilter();
    renderPlayer();
  });
  els.playerFilter.addEventListener("change", () => {
    state.selectedPlayerId = Number(els.playerFilter.value) || null;
    renderPlayer();
  });
  els.scopeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.scope = button.dataset.scope;
      renderPlayer();
    });
  });
  els.themeSlider.addEventListener("input", () => {
    setThemeByIndex(Number(els.themeSlider.value));
    syncThemeSlider();
    setShareMenuOpen(false);
  });
  els.portrait.addEventListener("error", () => {
    els.portrait.hidden = true;
    els.portraitWrap.classList.add("player-portrait--empty");
    els.profileHeader.classList.add("player-profile__header--no-portrait");
  });
}

async function init() {
  initTheme(syncThemeSlider);
  syncThemeSlider();
  const response = await fetch(`./data/salary_scatter_web.json?v=${DEPLOY_VERSION}`);
  if (!response.ok) throw new Error(`Failed to load data: HTTP ${response.status}`);
  state.data = await response.json();

  const params = new URLSearchParams(window.location.search);
  const requestedId = Number(params.get("id"));
  const requestedPlayer = state.data.find((row) => row.player_id === requestedId);
  state.selectedPlayerId = requestedPlayer?.player_id ?? state.data[0]?.player_id ?? null;
  state.selectedTeam = requestedPlayer?.team_abbreviation || "ALL";
  state.scope = params.get("scope") === "position" ? "position" : "league";

  populateTeamFilter();
  populatePlayerFilter(state.selectedPlayerId);
  bindEvents();
  renderPlayer();
}

init().catch((error) => {
  console.error(error);
  els.name.textContent = "数据加载失败";
  els.metricGroups.innerHTML = '<p class="player-empty">请检查网络连接或稍后刷新。</p>';
});
