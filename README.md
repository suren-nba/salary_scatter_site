# salary.surennba.com

这是一个纯静态的 NBA 球员薪资价值可视化网站，用于展示球员实际薪资、模型预期薪资，以及二者之间的合同价值差。

网站地址：

- https://salary.surennba.com/

主站地址：

- https://www.surennba.com/

## 项目由来

这个小网站的起点来自微博篮球博主 [库昊](https://weibo.com/u/1894121447) 提供的一组球员薪资估值数据。

库昊老师在今年休赛期基于预测性数据，使用预测 EPM 和 DARKO 等指标替代传统单赛季数据，制作了一版球员预估薪水数据，用来观察球员新合同是否溢价。之后很多朋友希望可以查询具体球员的估值，于是这组数据被做成了独立网页，放入我的网站体系中。

这套页面没有直接并入 `surennba.com` 主站，而是单独放在 `salary.surennba.com`。原因是主站存在服务器实时计算、Cloudflare、Nginx 等链路，访问性能和稳定性受影响更大；而薪资页面本身数据量较小，本质上只需要读取一个 JSON 文件，所以更适合做成独立的纯静态前端网站。

也就是说，这个项目是一个轻量子站点：数据来自库昊，只是页面和可视化由我提供，代码以 JavaScript、CSS 和静态资源形式开源维护。

## 数据来源与算法说明

- 数据来源：微博博主 [库昊](https://weibo.com/u/1894121447)
- 算法说明：[2026 年自由市场梳理总结（1）谁最赚谁最亏？球员值多少钱是怎么算的](https://weibo.com/ttarticle/p/show?id=2309405316644200644649)
- 页面入口：https://salary.surennba.com/

数据仅供可视化研究，模型估值不代表真实交易价值或正式薪资建议。休赛期期间球员所处球队以及具体薪资或有错误，敬请谅解。

## 功能

- 球员薪资散点图
- EPM、DARKO、平均预期薪资、上赛季表现薪资等指标切换
- 球队筛选（支持键盘操作）、球员搜索、球员选中联动
- 球员薪资数据表
- 球队 Logo 筛选
- 当前球队、最超值球员、最溢价球员与球队薪资排名摘要
- 深色模式（跟随系统，可手动切换并记忆）
- 筛选与选中状态同步到 URL，可分享链接
- 本地头像、球队 Logo 和前端依赖资源，无需后端服务

## 技术实现

该项目是无构建静态站点：

- `index.html`：页面结构
- `assets/css/style.css`：页面样式（含深色模式变量）
- `assets/js/`：原生 ES modules，无构建
  - `main.js`：入口、事件绑定、统计卡与选中联动
  - `state.js`：共享状态与筛选
  - `format.js`：指标常量与格式化工具
  - `chart.js`：ECharts 散点图配置与 Tooltip
  - `table.js`：Tabulator 表格配置
  - `teamPicker.js`：球队筛选下拉（含键盘导航）
  - `theme.js`：深色模式切换与记忆
  - `urlState.js`：URL hash 状态同步
- `data/salary_scatter_web.json`：网站使用的球员薪资数据
- `assets/headshots/`：球员头像 WebP
- `assets/team-logos/`：球队 Logo WebP
- `assets/vendor/`：本地 ECharts、Tabulator 等前端依赖

页面直接通过 `fetch()` 读取本地 JSON，不使用 Shiny、数据库、后端 API、登录或 SSR。

## 本地运行

不要通过双击 `index.html` 测试页面。浏览器打开 `file://` 页面时，会限制本地 JSON 读取，导致数据加载失败。

在项目目录运行本地服务器：

```bash
python3 -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

Windows 环境也可以使用：

```powershell
py -m http.server 8080
```

## 数据处理

数据准备脚本位于 `scripts/`：

- `scripts/prepare_site_data.py`
- `scripts/convert_headshots.py`

原始数据和头像资源在本地处理后，会生成网站直接读取的静态资源：

- `data/salary_scatter_web.json`
- `data/metadata.json`
- `excluded_players.csv`
- `headshot_conversion_report.csv`
- `assets/headshots/{player_id}.webp`

头像转换使用 Pillow 输出 WebP，保留透明通道，不放大、不裁切、不增加背景。

## 更新数据流程

1. 更新源 JSON 数据。
2. 更新或补充球员头像。
3. 运行 `scripts/prepare_site_data.py`。
4. 检查 `data/salary_scatter_web.json`、头像和转换报告。
5. 本地启动 HTTP server，验证筛选、搜索、散点图、Tooltip、表格和球队摘要。
6. 提交到 GitHub。
7. 部署到静态托管平台。

## 目录结构

```text
salary_scatter_site
├─ index.html
├─ assets
│  ├─ brand
│  ├─ css
│  ├─ headshots
│  ├─ js
│  ├─ team-logos
│  └─ vendor
├─ data
├─ scripts
├─ README.md
└─ .gitignore
```

## 部署说明

该项目可以直接将仓库根目录作为静态站点目录部署，无需构建命令、环境变量、后端 API 或数据库。

部署前确认：

- 所有资源路径均为相对路径。
- `data/salary_scatter_web.json` 已更新。
- `assets/headshots/` 已包含所需球员头像。
- `assets/team-logos/` 已包含球队 Logo。
- `assets/vendor/` 已包含页面依赖的本地前端库。

## 已知限制

- 模型估值只适合可视化比较，不代表真实交易价值或正式薪资建议。
- 球队归属和薪资数据以当前 JSON 为准，不在前端推断交易、买断或自由市场变化。
- 无头像或头像转换失败的球员不会正常显示头像。
- 普通散点默认使用圆点；仅在搜索、选中或少量筛选结果中突出头像，以避免一次加载大量图片。
