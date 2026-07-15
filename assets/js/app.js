(function () {
  "use strict";

  const metricLabels = {
    epm_expected_salary_m: "EPM 预期薪资",
    darko_expected_salary_m: "DARKO 预测薪资",
    average_expected_salary_m: "平均预期薪资",
    last_season_value_salary_m: "上赛季表现薪资",
    actual_salary_m: "实际薪资",
    expected_minus_actual_m: "合同价值差",
  };

  const metricOrder = Object.keys(metricLabels);
  const numberFontFamily = "Consolas, SFMono-Regular, Menlo, Monaco, monospace";
  const state = {
    data: [],
    metadata: {},
    filtered: [],
    selectedTeam: "ALL",
    searchTerm: "",
    xMetric: "actual_salary_m",
    yMetric: "average_expected_salary_m",
    showAvatars: false,
    selectedPlayerId: null,
  };

  let chart;
  let table;
  let resizeTimer;

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
    chartStatus: document.getElementById("chartStatus"),
    selectedPlayer: document.getElementById("selectedPlayer"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function formatMoney(value, signed = false) {
    if (!isNumber(value)) return "—";
    const abs = Math.abs(value).toFixed(1);
    if (signed) {
      if (value > 0) return `+$${abs}M`;
      if (value < 0) return `−$${abs}M`;
      return "$0.0M";
    }
    return `$${value.toFixed(1)}M`;
  }

  function formatSurplusHtml(value) {
    const label = formatMoney(value, true);
    const kind = !isNumber(value) || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";
    return `<span class="surplus-value ${kind}">${label}</span>`;
  }

  function average(rows, field) {
    const values = rows.map((row) => row[field]).filter(isNumber);
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function teamLogoPath(team) {
    return `./assets/team-logos/${team}.webp`;
  }

  function ordinal(rank) {
    const mod100 = rank % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
    const suffix = { 1: "st", 2: "nd", 3: "rd" }[rank % 10] || "th";
    return `${rank}${suffix}`;
  }

  function teamRank(field, team) {
    if (team === "ALL") return null;
    const teams = [...new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean))];
    const ranked = teams
      .map((teamCode) => ({
        team: teamCode,
        value: average(state.data.filter((row) => row.team_abbreviation === teamCode), field),
      }))
      .filter((item) => isNumber(item.value))
      .sort((a, b) => b.value - a.value || a.team.localeCompare(b.team));
    const target = ranked.find((item) => item.team === team);
    if (!target) return null;
    return 1 + ranked.filter((item) => item.value > target.value).length;
  }

  function teamRankHtml(field) {
    if (state.searchTerm.trim()) return "";
    const rank = teamRank(field, state.selectedTeam);
    if (!rank) return "";
    return `<span class="team-rank" title="30 支球队中按平均值从高到低排名">${ordinal(rank)}</span>`;
  }

  function teamScopeRows() {
    if (state.selectedTeam === "ALL") return state.data;
    return state.data.filter((row) => row.team_abbreviation === state.selectedTeam);
  }

  function extremePlayer(rows, direction) {
    const candidates = rows.filter((row) => isNumber(row.expected_minus_actual_m));
    if (!candidates.length) return null;
    return candidates.slice().sort((a, b) => {
      const difference = direction === "max"
        ? b.expected_minus_actual_m - a.expected_minus_actual_m
        : a.expected_minus_actual_m - b.expected_minus_actual_m;
      return difference || a.player_name.localeCompare(b.player_name);
    })[0];
  }

  function updatePlayerStat(player, headshot, name) {
    headshot.hidden = !player;
    name.textContent = player ? player.player_name : "—";
    if (player) {
      headshot.src = player.headshot_file;
      headshot.alt = player.player_name;
    }
  }

  function setTeamPickerOpen(open) {
    els.teamFilterButton.setAttribute("aria-expanded", String(open));
    els.teamFilterMenu.hidden = !open;
  }

  function updateTeamPicker() {
    const isAll = state.selectedTeam === "ALL";
    els.teamFilterLogo.hidden = isAll;
    els.teamFilterLabel.textContent = isAll ? "全部球队" : state.selectedTeam;
    if (!isAll) {
      els.teamFilterLogo.src = teamLogoPath(state.selectedTeam);
      els.teamFilterLogo.alt = `${state.selectedTeam} 队徽`;
    }
    els.teamFilterMenu.querySelectorAll(".team-picker__option").forEach((option) => {
      option.setAttribute("aria-selected", String(option.dataset.team === state.selectedTeam));
    });
  }

  function makeTeamOption(team) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "team-picker__option";
    option.dataset.team = team;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    if (team === "ALL") {
      option.classList.add("team-picker__option--all");
    } else {
      const logo = document.createElement("img");
      logo.src = teamLogoPath(team);
      logo.alt = "";
      logo.loading = "lazy";
      option.appendChild(logo);
    }

    const label = document.createElement("span");
    label.textContent = team === "ALL" ? "全部球队" : team;
    option.appendChild(label);
    return option;
  }

  function setupTeamPicker() {
    els.teamFilterMenu.appendChild(makeTeamOption("ALL"));
    const teams = [...new Set(state.data.map((row) => row.team_abbreviation).filter(Boolean))].sort();
    teams.forEach((team) => els.teamFilterMenu.appendChild(makeTeamOption(team)));
    updateTeamPicker();
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
    setupTeamPicker();
  }

  function applyFilters() {
    const term = state.searchTerm.trim().toLowerCase();
    state.filtered = state.data.filter((row) => {
      const teamOk = state.selectedTeam === "ALL" || row.team_abbreviation === state.selectedTeam;
      const searchOk = !term || row.player_name.toLowerCase().includes(term);
      return teamOk && searchOk;
    });
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
          <img src="${escapeHtml(row.headshot_file)}" alt="${escapeHtml(row.player_name)}" loading="lazy" onerror="this.style.display='none'">
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

  function updateChart() {
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

    const baseData = rows.map((row) => ({
      value: [row[state.xMetric], row[state.yMetric]],
      row,
      itemStyle: {
        color: row.expected_minus_actual_m >= 0 ? "#176A43" : "#D9534F",
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
      textStyle: { fontFamily: numberFontFamily },
      grid: { left: 64, right: 28, top: 36, bottom: 84 },
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        padding: 12,
        backgroundColor: "rgba(255,255,255,0.97)",
        extraCssText: "box-shadow:0 14px 38px rgba(43,43,45,.18);border-radius:8px;",
        formatter: (params) => tooltipHtml(params.data.row),
      },
      toolbox: {
        right: 8,
        feature: {
          dataZoom: { yAxisIndex: "none" },
          restore: {},
          saveAsImage: { pixelRatio: 2 },
        },
      },
      dataZoom: [
        { type: "inside", throttle: 80 },
        { type: "slider", height: 24, bottom: 24 },
      ],
      xAxis: {
        name: `${metricLabels[state.xMetric]}（百万美元）`,
        min: axisMin(state.xMetric, xValues),
        max: axisMax(xValues),
        axisLabel: { formatter: (value) => `$${value}M` },
        splitLine: { lineStyle: { color: "rgba(44,62,80,.10)" } },
      },
      yAxis: {
        name: `${metricLabels[state.yMetric]}（百万美元）`,
        min: axisMin(state.yMetric, yValues),
        max: axisMax(yValues),
        axisLabel: { formatter: (value) => `$${value}M` },
        splitLine: { lineStyle: { color: "rgba(44,62,80,.10)" } },
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
            lineStyle: { type: "dashed", color: "#2B2B2D", opacity: 0.42 },
            label: { formatter: "y = x", color: "#2B2B2D" },
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

  function tableColumns() {
    const moneyFormatter = (cell) => `<span class="numeric-value">${formatMoney(cell.getValue())}</span>`;
    const surplusFormatter = (cell) => formatSurplusHtml(cell.getValue());
    return [
      {
        title: "头像",
        field: "headshot_file",
        width: 74,
        hozAlign: "center",
        headerSort: false,
        formatter: (cell) => `<img src="${cell.getValue()}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" style="width:38px;height:38px;object-fit:contain;border-radius:50%;background:rgba(44,62,80,.06)">`,
      },
      {
        title: "球员",
        field: "player_name",
        minWidth: 180,
        formatter: (cell) => `<strong>${escapeHtml(cell.getValue())}</strong>`,
      },
      { title: "球队", field: "team_abbreviation", width: 86 },
      { title: "EPM 预期薪资", field: "epm_expected_salary_m", sorter: "number", hozAlign: "right", formatter: moneyFormatter },
      { title: "DARKO 预测薪资", field: "darko_expected_salary_m", sorter: "number", hozAlign: "right", formatter: moneyFormatter },
      { title: "平均预期薪资", field: "average_expected_salary_m", sorter: "number", hozAlign: "right", formatter: moneyFormatter },
      { title: "上赛季表现薪资", field: "last_season_value_salary_m", sorter: "number", hozAlign: "right", formatter: moneyFormatter },
      { title: "实际薪资", field: "actual_salary_m", sorter: "number", hozAlign: "right", formatter: moneyFormatter },
      { title: "合同价值差", field: "expected_minus_actual_m", sorter: "number", hozAlign: "right", formatter: surplusFormatter },
    ];
  }

  function setupTable() {
    table = new Tabulator("#salaryTable", {
      data: state.filtered,
      index: "player_id",
      layout: "fitDataStretch",
      columnDefaults: { vertAlign: "middle" },
      height: "620px",
      pagination: true,
      paginationSize: 25,
      paginationSizeSelector: [10, 20, 25, 50, 100],
      locale: "zh-cn",
      langs: {
        "zh-cn": {
          pagination: {
            page_size: "每页数量",
            page_title: "查看第",
            first: "首页",
            first_title: "首页",
            last: "末页",
            last_title: "末页",
            prev: "上一页",
            prev_title: "上一页",
            next: "下一页",
            next_title: "下一页",
            all: "全部",
          },
        },
      },
      movableColumns: false,
      placeholder: "没有符合当前筛选条件的球员",
      initialSort: [{ column: "average_expected_salary_m", dir: "desc" }],
      columns: tableColumns(),
    });

    table.on("rowClick", (_event, row) => {
      selectPlayer(row.getData().player_id, true);
    });
  }

  function updateTable() {
    if (!table) return;
    table.setData(state.filtered).then(() => {
      if (state.selectedPlayerId) {
        selectPlayer(state.selectedPlayerId, false);
      }
    });
  }

  function selectPlayer(playerId, fromTable) {
    const player = state.data.find((row) => row.player_id === playerId);
    state.selectedPlayerId = player ? playerId : null;
    els.selectedPlayer.textContent = player ? `${player.player_name} · ${player.team_abbreviation}` : "未选中球员";
    if (table && player) {
      table.deselectRow();
      const rowIndex = state.filtered.findIndex((row) => row.player_id === playerId);
      const pageSize = table.getPageSize();
      const targetPage = rowIndex >= 0 ? Math.floor(rowIndex / pageSize) + 1 : 1;
      table.setPage(targetPage).then(() => {
        table.selectRow(playerId);
        table.scrollToRow(playerId, "center", false).catch(() => {});
      }).catch(() => {});
    }
    if (!fromTable) {
      updateChart();
    } else {
      updateChart();
    }
  }

  function refresh() {
    applyFilters();
    if (state.selectedPlayerId && !state.filtered.some((row) => row.player_id === state.selectedPlayerId)) {
      state.selectedPlayerId = null;
      els.selectedPlayer.textContent = "未选中球员";
    }
    updateStats();
    updateChart();
    updateTable();
  }

  function bindEvents() {
    els.teamFilterButton.addEventListener("click", () => {
      setTeamPickerOpen(els.teamFilterButton.getAttribute("aria-expanded") !== "true");
    });
    els.teamFilterMenu.addEventListener("click", (event) => {
      const option = event.target.closest(".team-picker__option");
      if (!option) return;
      state.selectedTeam = option.dataset.team;
      updateTeamPicker();
      setTeamPickerOpen(false);
      refresh();
    });
    document.addEventListener("click", (event) => {
      if (!els.teamPicker.contains(event.target)) setTeamPickerOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || els.teamFilterButton.getAttribute("aria-expanded") !== "true") return;
      setTeamPickerOpen(false);
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
      updateChart();
    });
    els.yMetric.addEventListener("change", () => {
      state.yMetric = els.yMetric.value;
      updateChart();
    });
    els.avatarToggle.addEventListener("change", () => {
      state.showAvatars = els.avatarToggle.checked;
      updateChart();
    });
    els.resetBtn.addEventListener("click", () => {
      state.selectedTeam = "ALL";
      state.searchTerm = "";
      state.xMetric = "actual_salary_m";
      state.yMetric = "average_expected_salary_m";
      state.showAvatars = false;
      state.selectedPlayerId = null;
      updateTeamPicker();
      setTeamPickerOpen(false);
      els.playerSearch.value = "";
      els.xMetric.value = state.xMetric;
      els.yMetric.value = state.yMetric;
      els.avatarToggle.checked = false;
      els.selectedPlayer.textContent = "未选中球员";
      refresh();
    });
    chart.on("click", (params) => {
      if (params.data && params.data.row) {
        selectPlayer(params.data.row.player_id, false);
      }
    });
    chart.getZr().on("click", (event) => {
      const point = [event.offsetX, event.offsetY];
      if (!chart.containPixel("grid", point)) return;
      const rows = chartRows();
      let bestRow = null;
      let bestDistance = Infinity;
      rows.forEach((row) => {
        const pixel = chart.convertToPixel({ seriesIndex: 0 }, [row[state.xMetric], row[state.yMetric]]);
        if (!pixel) return;
        const distance = Math.hypot(pixel[0] - point[0], pixel[1] - point[1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRow = row;
        }
      });
      if (bestRow && bestDistance <= 18) {
        selectPlayer(bestRow.player_id, false);
      }
    });
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => chart.resize(), 120);
    });
  }

  async function init() {
    if (!window.echarts || !window.Tabulator) {
      throw new Error("ECharts or Tabulator did not load.");
    }
    const [data, metadata] = await Promise.all([
      fetch("./data/salary_scatter_web.json").then((response) => response.json()),
      fetch("./data/metadata.json").then((response) => response.json()),
    ]);
    state.data = data;
    state.metadata = metadata;
    setupSelects();
    chart = echarts.init(els.chart, null, { renderer: "canvas" });
    applyFilters();
    setupTable();
    updateStats();
    updateChart();
    bindEvents();
  }

  init().catch((error) => {
    console.error(error);
    els.chartStatus.textContent = "加载失败";
    els.chart.innerHTML = "<p>数据加载失败，请检查本地服务器和 data 目录。</p>";
  });
})();
