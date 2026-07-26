# Design QA

- Source visual: `/var/folders/pp/f0k6gtn1465fm99f6psvc9140000gn/T/codex-clipboard-c5073c7b-f243-4c0e-bdc2-949522345a80.png`
- Source pixels: 570 × 880
- Desktop implementation: `/private/tmp/salary-filter-desktop-1280x900.png`
- Desktop viewport / capture: 1280 × 720 CSS px at 1× density
- Mobile implementation: `/private/tmp/salary-filter-mobile-390x844.png`
- Mobile viewport / capture: 390 × 844 CSS px at 1× density
- Focused comparison: `/private/tmp/salary-filter-source-vs-mobile.png`
- Focused comparison pixels: 608 × 622
- Mobile notes capture: `/private/tmp/salary-notes-mobile-viewport.png`
- State: 球队筛选菜单展开；数据指标说明位于页面底部。

## Comparison scope

参考图用于核对球队筛选菜单的列数、间距、字重、徽标槽位和选中态。按用户的最新要求，`全联盟` 与 `无球队` 不使用徽标，并固定在菜单第一行；桌面和手机均保持两列。参考图中的当前球队为 GSW，而最终页面默认选择全联盟，这是产品状态差异。

## Full-view comparison evidence

- 桌面 1280 × 720：菜单为两列，`全联盟 / 无球队` 同行，30 支球队按两列继续排列；菜单内部滚动且页面无横向溢出。
- 手机 390 × 844：菜单仍为两列，第一行与后续球队对齐；菜单宽度限制在视口内，页面无横向溢出。
- 手机数据指标说明：九张说明卡按单列堆叠，标题、正文和外链均可读，无截断或遮挡。

## Focused region comparison evidence

- 参考图与实现截图已并排检查。
- 球队徽标尺寸、三字母队名、列间距、圆角、边框和选中态延续现有视觉系统。
- `全联盟 / 无球队` 同行且无徽标是用户在暂停图像生成后的明确选择，不属于视觉缺失。

## Required fidelity surfaces

- Typography: 沿用网站现有中文系统字体和球队代码字重，长中文说明保持舒适行高。
- Layout rhythm: 桌面和手机菜单均为两列；说明卡在宽屏按逻辑分组，在窄屏回落为单列。
- Colors and tokens: 筛选菜单、选中态、卡片边框与主题变量一致。
- Image fidelity: 30 支球队继续使用真实徽标资产；两个特殊选项按要求不新增伪造图形资产。
- Copy and content: 标题更新为“数据指标说明”，字段名称与数据源统一，三处来源链接可直接跳转。

## Findings

- 未发现 P0、P1 或 P2 问题。
- 用户从“生成两枚徽标”改为“不使用徽标但保持首行两列”，实现已按最新需求收敛。
- 上赛季合同价值差说明使用与数据一致的公式：上赛季表现薪水 − 上赛季实际薪水。

## Comparison history

- Pass 1: 桌面筛选菜单通过，32 个类型按两列排列。
- Pass 2: 手机筛选菜单与说明卡通过，无横向溢出。
- Pass 3: 无球队轴指标自动切换及离开无球队后的指标保留通过。

## Interaction and console checks

- 选择无球队后，X 轴自动切换为“上赛季实际薪水”，Y 轴自动切换为“上赛季合同价值差”。
- 从无球队切换至 ATL 后，X/Y 轴保持不变；普通球队之间切换不会改写轴指标。
- 数据指标说明包含 9 张卡片和 3 个可点击外链。
- 浏览器控制台警告和错误：0。

final result: passed
