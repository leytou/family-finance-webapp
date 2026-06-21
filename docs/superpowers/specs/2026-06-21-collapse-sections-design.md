# 折叠区块功能设计

> 日期：2026-06-21
> 状态：待评审

## 背景

当前界面的四个区块——**参数**、**指标**、**年度汇总**、**月度流水**——始终全部展开，纵向占用空间大。用户希望在屏幕空间有限时能收起部分区块，把月度流水等核心内容放大查看。四个区块目前都没有折叠能力，本设计从零新增。

## 目标

- 参数、指标、年度汇总、月度流水四个区块**各自可独立折叠/展开**。
- 折叠状态**记住**，刷新或重开页面后保持；首次打开（尚无记忆）默认**全部展开**。
- 四个区块采用**统一的折叠入口**（标题条 + 箭头），交互一致。

## 非目标

- **不做**「一键全部收起 / 一键全部展开」快捷按钮（各区块独立折叠即可）。
- 折叠状态**不进入财务数据**，不随导出/导入文件带走。
- **不做**折叠/展开动画，保持简单可靠。
- 不改变各区块**展开时**的内容与功能。

## 四个区块

| 区块 | 当前位置 | 内容 | 折叠边界 |
|---|---|---|---|
| 参数 | header 第二行 `param-row` | 起止月份、年化收益率、初始存款、公积金（开关 + 利率/结息月/初始余额） | 整个 `param-row`，公积金子行随之隐藏 |
| 指标 | header 第三行 `KeyMetricsBar` | 期末存款、期间最低存款、累计收入/支出/理财收益、公积金期末余额 | 整个 `KeyMetricsBar` |
| 年度汇总 | main 上区 | 标题「01 年度汇总」+ `AnnualTable` | 标题条 + 表格 |
| 月度流水 | main 下区 | 标题「02 月度流水」+ `MonthlyTable` | 标题条 + 表格 |

## 交互

- 每个区块顶部一条折叠头：`[箭头] [序号?] 标题`，整条可点击。
- 展开：箭头朝下（▾）；收起：箭头朝右（▸）。
- 点击折叠头切换展开/收起。
- 键盘可达：折叠头为 `<button>`，Enter / Space 触发，`aria-expanded` 反映当前状态。
- hover 反馈沿用项目现有风格（`hover:bg-surface-2`）。

## 视觉（统一标题条）

四个折叠头视觉完全统一，沿用现有「01 年度汇总」标题条样式：

```
font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 bg-surface
```

- **序号**：年度汇总 = `01`、月度流水 = `02`（朱砂红 `text-brand-600 font-bold`）；参数、指标无序号。
- **标题**：参数折叠头为「参数」，指标折叠头为「指标」（两者均为新增）。
- 原 `param-row` 内的「参数」文字标签（`data-testid="param-row-label"`）与新折叠头标题重复，**移除该内联标签**；相关测试中依赖该 testid 的断言需同步更新。
- 折叠头下方各自保留原内容样式（参数行的 `bg-surface-2` 输入行、指标条的网格、各表格）。

## 布局行为（折叠后）

- **参数折叠**：隐藏整个 `param-row`（含公积金子行），header 收矮。
- **指标折叠**：隐藏 `KeyMetricsBar`。
- **年度汇总折叠**：该区只显示折叠头；月度流水（`flex-1`）自动撑满剩余空间。
- **月度流水折叠**：该区只显示折叠头；年度汇总保持其 `max-h-[35%]` 高度，下方留白（可接受，非核心场景）。
- 折叠头**始终保留显示**（否则无法再展开）。

## 状态与持久化

四个布尔状态：`collapsed.params / metrics / annual / monthly`（`true` = 收起）。

- **存储位置**：独立 localStorage key `family-finance-ui-prefs`。
  - 结构：`{ version: 1, collapsed: { params, metrics, annual, monthly } }`。
  - 与财务数据（key `family-finance-plan`）完全分离，**不参与导出/导入**。
- **读取**：App 初始化时读；JSON 解析失败或字段缺失 → 该项默认 `false`（展开）。
- **写入**：每次切换立即写。
- **首次（无存储）**：四项全 `false`，全部展开。
- 封装为 composable `src/composables/useUiPrefs.ts`（提供四个 ref + toggle + 读写逻辑），便于测试与复用。

## 通用组件

新增 `src/components/CollapsibleSection.vue`：

- props：`collapsed`（`v-model`）、`title`、`index?`（序号）、`sticky?`（月度流水标题吸顶）。
- emits：`update:collapsed`。
- slot：`default`（区块内容）。
- 根元素接收透传 class（如 `flex-none` / `max-h-[35%]` / `overflow-auto` / `flex-1`），承担布局容器角色。
- 折叠头：`<button :aria-expanded="!collapsed">`，含 chevron 图标 + 可选序号 + 标题。
- 内容区：`v-show="!collapsed"`（用 `v-show` 保留 DOM，避免输入框重挂导致失焦/丢值）。

四个区块均用此组件包裹。

## 数据流

- App.vue 经 `useUiPrefs()` 持有四个 `collapsed` ref（初始化自 localStorage）。
- 传给各 `<CollapsibleSection v-model="prefs.collapsed.xxx">`。
- 用户切换 → composable 写 localStorage。

## 视图影响（边界）

- 折叠状态为**全局**，与视图无关：在表格视图收起参数 → 切到计算器再切回 → 仍保持收起。
- 计算器视图：参数行、指标条本就不渲染（现有 `v-if`），折叠状态对其无影响。
- 对比视图：指标条本就不渲染。
- 图表视图：参数行、指标条正常渲染，折叠同样生效；年度汇总/月度流水仅表格视图存在。

## 测试策略

- `CollapsibleSection.spec.ts`：默认展开内容可见；点击收起 → 内容隐藏（`v-show`）；箭头方向随状态；`aria-expanded` 正确；`v-model` 更新；`index` 可选渲染；`sticky` class。
- `useUiPrefs` 测试（或 App 集成）：初始读 localStorage；toggle 写入；坏 JSON → 默认展开；首次无存储 → 全展开。
- `App.spec.ts` 回归：四区块默认展开；收起对应区块后内容隐藏；收起年度汇总后月度流水容器撑满；同步原 `param-row-label` 等 testid 变更。
- 不新增折叠/展开动画相关测试（无动画）。

## 已确认决策

1. 主要目的：**腾出空间**。
2. 折叠状态：**记住上次**（独立持久化，不进导出/导入），首次默认全展开。
3. **不做**一键全收起/全展开快捷按钮，各区块独立折叠。
4. 呈现方式：**方案 A 统一标题条**（四个折叠头视觉一致）。
