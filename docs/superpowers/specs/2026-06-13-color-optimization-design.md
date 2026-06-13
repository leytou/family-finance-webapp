# 配色优化设计（清爽专业 · 靛蓝 · 中式红绿）

日期：2026-06-13

## 1. 背景与目标

当前应用配色存在两类问题：

- **视觉偏老气**：语义色用 Tailwind 默认 `green/red/blue-600`，饱和度高、生硬，像传统报表。
- **颜色无统一管理**：组件里写 utility class、图表里写十六进制（`utils/financeChart.ts` 的 `#16a34a/#dc2626/#2563eb`），还散落硬编码（行 hover `#f0fdf4`、拖拽线 `#3b82f6`）；`uno.config.ts` 仅有 `presetUno()`、无主题扩展；无全局底色/文字色（依赖 reset 默认）。

本次目标：

1. **视觉焕新**——换成更现代、柔和、有质感的色板。
2. **信息更清晰**——收入/支出/增减/优劣等语义层次分明，关键数据一眼可读。

**明确不做**：暗色模式（聚焦浅色主题）、结构/布局/逻辑改动、token 治理的大重构。

## 2. 设计约束（已与用户确认）

- **气质**：清爽专业（蓝灰骨架、克制干净、数据优先）。
- **收支配色**：中式——收入=红、支出=绿（红涨绿跌）。
- **中式语义全局贯彻**：红=正向（收入/增长/更优），绿=负向（支出/下降/更劣），应用于 `diffClass`、对比 diff，而非仅收支两项。
- **色板**：方案 A「靛蓝·沉稳」。
- **落地**：薄 token 层（语义别名包裹 presetUno 内置色阶）。

## 3. 语义色角色系统（4 角色）

### 3.1 角色定义

| 角色 | 别名 → 内置色阶 | 关键色值 | 用于 |
|---|---|---|---|
| 主色·交互 | `brand` → `indigo` | `#4f46e5`(600) / `#eef2ff`(50) / `#c7d2fe`(200) | 链接、激活/选中、累计折线、锚点行、拖拽线 |
| 正向·红 | `positive` → `red` | `#dc2626`(600) | 收入、净储蓄增长、对比更优 |
| 负向·绿 | `negative` → `green` | `#15803d`(700) | 支出、净储蓄下降、对比更劣 |
| 中性·slate | `neutral` → `slate` | 底 `#fff`；文字 `#0f172a`/`#475569`/`#94a3b8`；分区底 `#f8fafc`；边框 `#e2e8f0` | 全局底、文字、边框、表头、斑马纹 |

### 3.2 关键语义规则

- **中式全局**：`positive`=红、`negative`=绿，贯穿收支项与增减/优劣 diff。
- **操作反馈色不反转**：`ToolsMenu` 的导入成功/失败（success/error）属 UI 操作反馈，**保留国际惯例**（成功=绿 ✓、失败=红 ✗），不跟财务中式语义混淆——"导入成功却显红"会误导。
- **锚点行**：并入主色淡底（`brand-50`），不单独占色。
- **行 hover**：保持淡绿 `#f0fdf4`（green-50），带温感（走查反馈：纯中性灰偏冷）。hover 属审美反馈而非财务语义，淡绿背景不与深色支出文字混淆。
- **金额单元格不着色**：`getValueClass` 仅给负数加斜体、不着色，金额保持中性深色；红绿只用于「快照对比差额」「对比视图 diff」「图表」与「操作反馈」。

## 4. 落地策略

### 4.1 薄 token 层

在 `uno.config.ts` 的 `theme.colors` 增加语义别名，映射到 presetUno 内置色阶：

- `brand` → `indigo`
- `positive` → `red`
- `negative` → `green`
- `neutral` → `slate`

各组件改用语义 class（如 `bg-brand-50`、`text-positive-600`、`border-neutral-200`）；现有 `gray-*` 一律换为同阶 `slate-*`（更冷净）。未来换肤/微调只改别名映射，不必逐处改动。

### 4.2 图表同步

`utils/financeChart.ts`：

- `COLOR_INCOME` → `#dc2626`（red-600，收入红）
- `COLOR_EXPENSE` → `#15803d`（green-700，支出绿）
- `COLOR_CUM` → `#4f46e5`（indigo-600，累计靛蓝）
- 坐标轴/网格线用 `slate`（与表格中性一致）。

### 4.3 全局底/文字

`App.vue` 顶层容器加白底 + `neutral-900` 文字，摆脱依赖 reset 默认。

### 4.4 scoped 样式

`MonthlyTable.vue` / `AnnualTable.vue` 的 `<style scoped>`：

- 行 hover：保持 `#f0fdf4`（淡绿，走查反馈）
- 拖拽线 `#3b82f6` → `#4f46e5`

## 5. 组件落点清单

| 文件 | 改动 |
|---|---|
| `uno.config.ts` | `theme.colors` 增 `brand/positive/negative/neutral` 别名 |
| `App.vue` | 顶层 bg/text；按钮激活 `blue-*`→`brand`；hover `gray`→`neutral` |
| `ScenarioTabs.vue` | 激活 `blue`→`brand`；链接 `blue`→`brand`；删除红保留（负向动作） |
| `MonthlyTable.vue` | `diffClass` 反转（正红负绿）；锚点 `blue-100`→`brand-50`；链接/标记 `blue`→`brand`；scoped hover/拖拽线；红绿语义反转 |
| `AnnualTable.vue` | scoped hover 保持 `#f0fdf4`（淡绿） |
| `ComparisonView.vue` | diff>0→`positive`(red)、<0→`negative`(green)；`gray`→`neutral` |
| `FinanceChart.vue` | 粒度激活 `blue`→`brand` |
| `utils/financeChart.ts` | `COLOR_INCOME/EXPENSE/CUM` + 轴线 |
| `MonthPicker.vue` | 当前月 `blue`→`brand`；hover `gray`→`neutral` |
| `ToolsMenu.vue` | `gray`→`neutral`；success/error **保留**绿红 |
| `ContextMenu.vue` | `gray`→`neutral` |
| `EventEditor.vue` | 删除红保留；添加链接 `blue`→`brand` |
| `EventDetailPopover.vue` | `gray`→`neutral` |
| `FormulaPopover.vue` | `gray`→`neutral` |

## 6. 范围与不改动

- 不动：组件结构、布局、交互逻辑、计算逻辑。
- 不做：暗色模式、CSS-in-JS 重构、动效。

## 7. 测试影响

现有测试对部分 class 有断言（如 `bg-blue-100`、`bg-gray-50`、`text-green-600`），收敛与中式反转后须同步更新这些断言（见实现计划 Task 3–7）。不新增颜色单测（对 class/色值写断言脆弱且无价值）。

## 8. 验收标准

1. utility class 层无残留 `green-600`/`red-600`/`blue-*`/`gray-*` 等直写语义色（已收敛为 `brand/positive/negative/neutral` 别名）；中性色统一 `slate`。注：scoped `<style>` 与 ECharts option 无法用 class，写与别名同源的十六进制（如 `#4f46e5`、`#f0fdf4`）。
2. 收入=红、支出=绿，净储蓄增长=红、下降=绿，对比更优=红、更劣=绿（中式全局）。
3. 导入成功=绿、失败=红（操作反馈保留）。
4. 图表柱/线与表格语义色一致（同一十六进制来源）。
5. 视觉：靛蓝主色 + slate 冷中性 + 墨绿正红，无刺眼饱和色，长时间看不累。
6. `npm run build` 通过、`npm run test` 全绿。
