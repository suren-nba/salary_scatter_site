import { state } from "./state.js?v=20260728-6";
import {
  escapeHtml,
  formatMoney,
  formatSurplusHtml,
  teamDisplayName,
} from "./format.js?v=20260728-6";

let table = null;
let visibleRowsTimer = null;
let scopeFilterTimer = null;
let syncingScopeFilters = false;
let lastScopeFilters = { team: "ALL", position: "ALL" };
const metricFields = new Set([
  "epm_expected_salary_m",
  "darko_expected_salary_m",
  "average_expected_salary_m",
  "actual_salary_m",
  "expected_minus_actual_m",
  "last_season_value_salary_m",
  "last_season_actual_salary_m",
  "last_season_expected_minus_actual_m",
]);

function teamFilterValues() {
  const teams = [...new Set(
    state.data
      .map((row) => row.team_abbreviation)
      .filter(Boolean),
  )].sort((a, b) => {
    if (a === "NA") return 1;
    if (b === "NA") return -1;
    return a.localeCompare(b);
  });
  return Object.fromEntries(teams.map((team) => [team, teamDisplayName(team)]));
}

function positionFilterValues() {
  const preferredOrder = ["控卫", "分卫", "小前锋", "大前锋", "中锋"];
  const available = new Set(state.data.map((row) => row.position).filter(Boolean));
  const positions = [
    ...preferredOrder.filter((position) => available.delete(position)),
    ...[...available].sort((a, b) => a.localeCompare(b, "zh-CN")),
  ];
  return Object.fromEntries(positions.map((position) => [position, position]));
}

function categoryHeaderFilter(values) {
  return {
    headerFilter: "list",
    headerFilterFunc: "=",
    headerFilterPlaceholder: "搜索/选择",
    headerFilterParams: {
      values,
      autocomplete: true,
      listOnEmpty: true,
      clearable: true,
      placeholder: "搜索或选择",
    },
  };
}

function filterableColumnTitle(title, field) {
  return `
    <span class="table-filter-title">
      <span>${title}</span>
      <button
        class="table-filter-toggle"
        type="button"
        data-table-filter="${field}"
        aria-label="筛选${title}"
        aria-expanded="false"
        title="筛选${title}"
      ></button>
    </span>
  `;
}

function closeHeaderFilters(root, except = null) {
  root.querySelectorAll(".table-filter-column.table-filter-open").forEach((column) => {
    if (column === except) return;
    column.classList.remove("table-filter-open");
    column.querySelector(".table-filter-toggle")?.setAttribute("aria-expanded", "false");
  });
}

function setupHeaderFilterToggles(selector) {
  const root = document.querySelector(selector);
  if (!root) return;

  root.addEventListener("click", (event) => {
    const button = event.target.closest(".table-filter-toggle");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const column = button.closest(".table-filter-column");
    if (!column) return;
    const shouldOpen = !column.classList.contains("table-filter-open");
    closeHeaderFilters(root, shouldOpen ? column : null);
    column.classList.toggle("table-filter-open", shouldOpen);
    button.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) {
      window.requestAnimationFrame(() => {
        column.querySelector(".tabulator-header-filter input")?.focus();
      });
    }
  }, true);

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".table-filter-column.table-filter-open, .tabulator-edit-list")) return;
    closeHeaderFilters(root);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openColumn = root.querySelector(".table-filter-column.table-filter-open");
    if (!openColumn) return;
    const button = openColumn.querySelector(".table-filter-toggle");
    closeHeaderFilters(root);
    button?.focus();
  });
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
      download: false,
      responsive: 1,
      formatter: (cell) => cell.getValue()
        ? `<img class="avatar" src="${cell.getValue()}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" style="width:38px;height:38px">`
        : "<span>--</span>",
    },
    {
      title: "球员",
      field: "player_name",
      minWidth: 180,
      responsive: 0,
      cssClass: "table-filter-column",
      titleFormatter: () => filterableColumnTitle("球员", "player_name"),
      headerFilter: "input",
      headerFilterFunc: "like",
      headerFilterPlaceholder: "搜索球员",
      formatter: (cell) => {
        const player = cell.getRow().getData();
        return `<a class="player-link" href="./player.html?id=${encodeURIComponent(player.player_id)}">${escapeHtml(cell.getValue())}</a>`;
      },
    },
    {
      title: "球队",
      field: "team_abbreviation",
      width: 112,
      responsive: 0,
      cssClass: "table-filter-column",
      titleFormatter: () => filterableColumnTitle("球队", "team_abbreviation"),
      ...categoryHeaderFilter(teamFilterValues()),
      formatter: (cell) => escapeHtml(teamDisplayName(cell.getValue())),
    },
    {
      title: "位置",
      field: "position",
      width: 106,
      responsive: 1,
      cssClass: "table-filter-column",
      titleFormatter: () => filterableColumnTitle("位置", "position"),
      ...categoryHeaderFilter(positionFilterValues()),
    },
    { title: "EPM预测薪水", field: "epm_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 110, responsive: 2, formatter: moneyFormatter },
    { title: "DARKO预测薪水", field: "darko_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 120, responsive: 3, formatter: moneyFormatter },
    { title: "综合预测薪水", field: "average_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 130, responsive: 0, formatter: moneyFormatter },
    { title: "新赛季实际薪水", field: "actual_salary_m", sorter: "number", hozAlign: "right", minWidth: 125, responsive: 0, formatter: moneyFormatter },
    { title: "新赛季合同价值差", field: "expected_minus_actual_m", sorter: "number", hozAlign: "right", minWidth: 130, responsive: 0, formatter: surplusFormatter },
    { title: "上赛季表现薪水", field: "last_season_value_salary_m", sorter: "number", hozAlign: "right", minWidth: 120, responsive: 4, formatter: moneyFormatter },
    { title: "上赛季实际薪水", field: "last_season_actual_salary_m", sorter: "number", hozAlign: "right", minWidth: 120, responsive: 4, formatter: moneyFormatter },
    { title: "上赛季合同价值差", field: "last_season_expected_minus_actual_m", sorter: "number", hozAlign: "right", minWidth: 130, responsive: 4, formatter: surplusFormatter },
  ];
}

function activePlayerIds() {
  if (!table) return [];
  return table.getRows("active").map((row) => row.getData().player_id);
}

function scheduleVisibleRowsChange(callback) {
  if (!callback) return;
  window.clearTimeout(visibleRowsTimer);
  visibleRowsTimer = window.setTimeout(() => callback(activePlayerIds()), 0);
}

function normalizeScopeFilter(value) {
  return String(value ?? "").trim() || "ALL";
}

function currentScopeFilters() {
  const filters = new Map(
    table.getHeaderFilters().map((filter) => [filter.field, filter.value]),
  );
  return {
    team: normalizeScopeFilter(filters.get("team_abbreviation")),
    position: normalizeScopeFilter(filters.get("position")),
  };
}

function notifyScopeFilterChange(callback) {
  if (!callback || syncingScopeFilters) return;
  const next = currentScopeFilters();
  if (
    next.team === lastScopeFilters.team
    && next.position === lastScopeFilters.position
  ) return;
  lastScopeFilters = next;
  window.clearTimeout(scopeFilterTimer);
  scopeFilterTimer = window.setTimeout(() => callback(next), 0);
}

export function setupTable(selector, {
  onRowClick,
  onRowHover,
  onMetricSelect,
  onVisibleRowsChange,
  onScopeFilterChange,
} = {}) {
  table = new Tabulator(selector, {
    data: state.filtered,
    index: "player_id",
    layout: "fitDataStretch",
    columnDefaults: { vertAlign: "middle" },
    height: "min(620px, 75vh)",
    responsiveLayout: false,
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
  setupHeaderFilterToggles(selector);

  table.on("rowClick", (event, row) => {
    if (event.target.closest(".player-link")) return;
    if (onRowClick) onRowClick(row.getData().player_id);
  });

  table.on("rowMouseEnter", (_event, row) => {
    if (onRowHover) onRowHover(row.getData().player_id);
  });

  table.on("rowMouseLeave", () => {
    if (onRowHover) onRowHover(null);
  });

  table.on("headerClick", (_event, column) => {
    const field = column.getField();
    if (metricFields.has(field) && onMetricSelect) onMetricSelect(field);
  });

  table.on("tableBuilt", () => {
    syncBeeswarmMetricHeader(state.beeswarmMetric);
    scheduleVisibleRowsChange(onVisibleRowsChange);
  });
  table.on("dataProcessed", () => scheduleVisibleRowsChange(onVisibleRowsChange));
  table.on("dataFiltered", () => {
    notifyScopeFilterChange(onScopeFilterChange);
    scheduleVisibleRowsChange(onVisibleRowsChange);
  });
  table.on("dataSorted", () => scheduleVisibleRowsChange(onVisibleRowsChange));
  table.on("pageLoaded", () => scheduleVisibleRowsChange(onVisibleRowsChange));

  return table;
}

export function syncTableScopeFilters(team, position) {
  if (!table) return;
  const next = {
    team: normalizeScopeFilter(team),
    position: normalizeScopeFilter(position),
  };
  if (
    next.team === lastScopeFilters.team
    && next.position === lastScopeFilters.position
  ) return;

  const previous = lastScopeFilters;
  lastScopeFilters = next;
  syncingScopeFilters = true;
  try {
    if (next.team !== previous.team) {
      table.setHeaderFilterValue(
        "team_abbreviation",
        next.team === "ALL" ? "" : next.team,
      );
    }
    if (next.position !== previous.position) {
      table.setHeaderFilterValue(
        "position",
        next.position === "ALL" ? "" : next.position,
      );
    }
  } finally {
    syncingScopeFilters = false;
  }
}

export function syncBeeswarmMetricHeader(field) {
  if (!table) return;
  table.getColumns().forEach((column) => {
    const element = column.getElement();
    const isMetric = metricFields.has(column.getField());
    const isSelected = column.getField() === field;
    element.classList.toggle("beeswarm-metric-column", isMetric);
    element.classList.toggle("beeswarm-metric-selected", isSelected);
    if (isMetric) {
      element.setAttribute("aria-pressed", String(isSelected));
      element.title = isSelected ? "当前蜂群分布指标" : "点击切换蜂群分布指标";
    }
  });
}

export function updateTable(selectedPlayerId) {
  if (!table) return;
  table.setData(state.filtered).then(() => {
    syncBeeswarmMetricHeader(state.beeswarmMetric);
    if (selectedPlayerId) {
      syncTableSelection(selectedPlayerId);
    }
  });
}

export function downloadTableData() {
  if (!table) return;
  table.download(
    "csv",
    "NBA球员薪资数据.csv",
    { bom: true },
    "active",
  );
}

export function syncTableSelection(playerId) {
  if (!table) return;
  table.deselectRow();
  if (!playerId) return;
  const activeRows = table.getRows("active");
  const rowIndex = activeRows.findIndex((row) => row.getData().player_id === playerId);
  const pageSize = table.getPageSize();
  const targetPage = rowIndex >= 0 ? Math.floor(rowIndex / pageSize) + 1 : 1;
  table.setPage(targetPage).then(() => {
    table.selectRow(playerId);
    table.scrollToRow(playerId, "center", false).catch(() => {});
  }).catch(() => {});
}
