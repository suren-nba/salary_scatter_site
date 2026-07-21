import { state } from "./state.js";
import { escapeHtml, formatMoney, formatSurplusHtml } from "./format.js";

let table = null;

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
      responsive: 1,
      formatter: (cell) => `<img class="avatar" src="${cell.getValue()}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" style="width:38px;height:38px">`,
    },
    {
      title: "球员",
      field: "player_name",
      minWidth: 180,
      responsive: 0,
      formatter: (cell) => `<strong>${escapeHtml(cell.getValue())}</strong>`,
    },
    { title: "球队", field: "team_abbreviation", width: 86, responsive: 0 },
    { title: "EPM 预期薪资", field: "epm_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 110, responsive: 2, formatter: moneyFormatter },
    { title: "DARKO 预测薪资", field: "darko_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 120, responsive: 3, formatter: moneyFormatter },
    { title: "平均预期薪资", field: "average_expected_salary_m", sorter: "number", hozAlign: "right", minWidth: 110, responsive: 0, formatter: moneyFormatter },
    { title: "上赛季表现薪资", field: "last_season_value_salary_m", sorter: "number", hozAlign: "right", minWidth: 120, responsive: 4, formatter: moneyFormatter },
    { title: "实际薪资", field: "actual_salary_m", sorter: "number", hozAlign: "right", minWidth: 100, responsive: 0, formatter: moneyFormatter },
    { title: "合同价值差", field: "expected_minus_actual_m", sorter: "number", hozAlign: "right", minWidth: 110, responsive: 0, formatter: surplusFormatter },
  ];
}

export function setupTable(selector, { onRowClick } = {}) {
  table = new Tabulator(selector, {
    data: state.filtered,
    index: "player_id",
    layout: "fitDataStretch",
    columnDefaults: { vertAlign: "middle" },
    height: "min(620px, 75vh)",
    responsiveLayout: "hide",
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
    if (onRowClick) onRowClick(row.getData().player_id);
  });

  return table;
}

export function updateTable(selectedPlayerId) {
  if (!table) return;
  table.setData(state.filtered).then(() => {
    if (selectedPlayerId) {
      syncTableSelection(selectedPlayerId);
    }
  });
}

export function syncTableSelection(playerId) {
  if (!table) return;
  table.deselectRow();
  const rowIndex = state.filtered.findIndex((row) => row.player_id === playerId);
  const pageSize = table.getPageSize();
  const targetPage = rowIndex >= 0 ? Math.floor(rowIndex / pageSize) + 1 : 1;
  table.setPage(targetPage).then(() => {
    table.selectRow(playerId);
    table.scrollToRow(playerId, "center", false).catch(() => {});
  }).catch(() => {});
}
