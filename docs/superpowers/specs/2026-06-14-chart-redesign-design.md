# 财务趋势图专业化改版 + 全应用柔和红绿语义色

日期：2026-06-14

## 目标

把当前的财务趋势图从「能用但显丑、信息不清晰」升级到「专业、克制、一眼可读」，并把改版确定的柔和红绿（朱砂 / 竹青）作为新的收支语义色**同步到全应用**，保持图表与表格观感一致。

核心回答用户的三个诉求：
- ① Y 轴 / 数值不再裸长数字（`1234567`）→ 智能「万 / 亿」格式
- ④ 累计储蓄从「被淹没的细折线」升级为「渐变面积 + 粗线」的视觉主线
- 支出不画负轴镜像 → 改为正值并列双柱

## 背景

当前实现（`src/components/FinanceChart.vue` + `src/utils/financeChart.ts`，基于 ECharts 组合图）存在以下问题，对应诊断屏标注的 ①~⑤：

- **① Y 轴裸数字**：`yAxis` 无 `axisLabel.formatter`，刻度显示 `200000` / `600000`；tooltip 也无 formatter，悬停弹原始长数字。肉眼难比较量级。
- **③ 双重网格**：左右两个 `yAxis` 都设了 `splitLine`，两套横向网格叠在绘图区，背景花。
- **④ 主线弱**：累计储蓄是 `showSymbol: false` 的细折线，无面积填充，被柱子淹没——而这恰是最该突出的主线。
- 支出镜像负柱：`buildChartData` 把 `expense` 取负画在 0 轴下方，语义上「支出」被呈现为负数，观感像亏损。
- 配色：红 `#dc2626` / 绿 `#15803d` 是鲜艳的 red-600 / green-700，偏生硬。

配色现状：`uno.config.ts` 定义 `positive: red`、`negative: green` 两个语义 alias，是全应用收支红绿的唯一来源；`ComparisonView.vue` / `MonthlyTable.vue` 的 diff 通过 `text-positive-600` / `text-negative-600` 引用；图表 `financeChart.ts` 独立硬编码十六进制。`success: green` / `danger: red` 是操作反馈色（导入成功 / 失败），按既有约定保留标准红绿不柔化。

## 设计决策（已与用户确认）

| 维度 | 决策 |
|---|---|
| 布局 | **方案 A · 同图强化**：保留一张组合图 |
| 主线 ④ | 累计储蓄折线 → **渐变面积图 + 2.5px 粗线**，视觉主角；图表标题区高亮当前值 |
| 收支 | 收入 / 支出 = **正值并列双柱**（圆角），底部当配角，不再镜像负轴 |
| 配色 | **D · 古典中式**：朱砂红 `#c0504d`、竹青绿 `#6b8e7b`、靛蓝 `#4f46e5`（主线不变） |
| 配色范围 | **同步到全应用**（更新 `positive`/`negative` alias） |
| 坐标轴 ① | 左右轴 **「万 / 亿」智能格式化**；单一极淡横向主网格，去掉右轴重复网格 |
| tooltip | **浅色卡片**：收入 / 支出 / **净结余** / 累计，中文标注 + 颜色点 + 万元格式 |
| X 轴 | 60 期标签稀疏显示，避免拥挤 |

**可读性权衡（柱色 vs 文字色）**：朱砂 `#c0504d` 够深，柱与文字通用；竹青 `#6b8e7b` 当柱色柔和好看，但作为表格 diff 文字色对比度不足（白底约 3:1）。因此竹青色阶里**柱用偏柔阶（500）、文字用偏深阶（600）**，二者同色系、观感统一，各自适配载体。朱砂统一用 600。

## 详细设计

### 1. 配色：全应用柔和红绿

在 `uno.config.ts` 新增两个柔和色阶对象，并把 `positive` / `negative` 重映射：

```ts
// 朱砂（柔和红，中式正向）
const zhusha = {
  50: '#fbf3f2', 100: '#f5e3e1', 200: '#e9c9c6', 300: '#d8a7a3',
  400: '#c97976', 500: '#c2605c', 600: '#c0504d',  // 600 = 图表收入柱 + diff 文字主色
  700: '#9f4340', 800: '#7d3433', 900: '#5b2726',
}
// 竹青（柔和绿，中式负向）
const zhuqing = {
  50: '#f3f6f4', 100: '#e3ebe6', 200: '#c9d8cf', 300: '#a5bcb0',
  400: '#82a58e', 500: '#6b8e7b',  // 500 = 图表支出柱（柔和）
  600: '#5e8270',  // 600 = diff 文字主色（可读）
  700: '#4a6b5a', 800: '#3a5447', 900: '#2c3f36',
}

theme: {
  colors: {
    brand: indigo,
    positive: zhusha,   // 原 red → 朱砂
    negative: zhuqing,  // 原 green → 竹青
    success: green,     // 操作反馈：保留标准绿
    danger: red,        // 操作失败/删除：保留标准红
    neutral: slate,
  },
}
```

- 组件层 `text-positive-600` / `text-negative-600` **无需改动 class**，自动变柔和（文字用 600 阶，保证可读）。
- 图表柱色独立指定阶：收入 `#c0504d`（zhusha-600）、支出 `#6b8e7b`（zhuqing-500）。
- 色阶值为实现建议，可在实现阶段微调，约束：zhusha-600 ≈ `#c0504d`、zhuqing-500 ≈ `#6b8e7b`、zhuqing-600 文字对比度达标。

### 2. 图表专业化（`src/utils/financeChart.ts`）

#### 2.1 智能金额格式化纯函数（新增，可单测）

```ts
/** 轴刻度 / 摘要智能缩写：<1万 显示整数，≥1万 X.X万，≥1亿 X.X亿（去尾零）。 */
export function formatAxisAmount(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e8) return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿'
  if (abs >= 1e4) return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万'
  return String(Math.round(v))
}
```

tooltip 内金额更精确，复用 `utils/format.ts` 的 `formatCurrency` 或单独的「万元」格式（保留 1~2 位小数）。

#### 2.2 `buildChartData`：支出不再取负

支出系列改为**正值**（`r.monthlyExpense`，不再 `-`）；年聚合同理（`p.expense` 不取负）。`ChartData.expense` 注释更新为「正值」。

#### 2.3 `buildChartOption`：组合图改造

```ts
{
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1,
    textStyle: { color: '#0f172a' },
    formatter: (params) => {
      // 输出浅色卡片：月份标题 + 收入 / 支出 / 净结余 / 累计
      // 每行：颜色点 + 中文名 + 右对齐金额（万元格式）
      // 净结余 = 收入 - 支出，正用 zhusha、负用 zhuqing
    },
  },
  legend: { data: ['收入', '支出', '累计储蓄'], /* 顶部药丸感，可调 icon/textStyle */ },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category', data,
    axisLine: { lineStyle: { color: COLOR_AXIS } },
    axisLabel: { interval: 'auto' },  // 60 期稀疏显示，避免拥挤
  },
  yAxis: [
    { type: 'value', name: '收支', alignTicks: true,
      axisLabel: { formatter: v => formatAxisAmount(v) },
      splitLine: { lineStyle: { color: COLOR_GRID } } },           // 仅左轴画网格
    { type: 'value', name: '累计', alignTicks: true,
      axisLabel: { formatter: v => formatAxisAmount(v) },
      splitLine: { show: false } },                                 // 右轴不画网格 → 解决 ③
  ],
  series: [
    { name: '收入', type: 'bar', yAxisIndex: 0, data: income,
      itemStyle: { color: COLOR_INCOME, borderRadius: [2,2,0,0] }, barCategoryGap: '40%' },
    { name: '支出', type: 'bar', yAxisIndex: 0, data: expense,     // 正值
      itemStyle: { color: COLOR_EXPENSE, borderRadius: [2,2,0,0] } },
    { name: '累计储蓄', type: 'line', yAxisIndex: 1, data: cumSavings,
      smooth: true, showSymbol: false, lineStyle: { color: COLOR_CUM, width: 2.5 },
      itemStyle: { color: COLOR_CUM },
      areaStyle: { color: { type: 'linear', x:0,y:0,x2:0,y2:1,
        colorStops:[{offset:0,color:'rgba(79,70,229,0.28)'},{offset:1,color:'rgba(79,70,229,0.02)'}] } } },
  ],
}
```

配色常量更新：
- `COLOR_INCOME` = `#c0504d`（zhusha-600）
- `COLOR_EXPENSE` = `#6b8e7b`（zhuqing-500）
- `COLOR_CUM` = `#4f46e5`（不变）
- `COLOR_AXIS` = `#cbd5e1`、`COLOR_GRID` = `#eef2f7`（更淡）

`ChartOption` / `ChartSeries` 类型扩展：`areaStyle`、`axisLabel.formatter`、`tooltip` 富字段、`barCategoryGap`、`itemStyle.borderRadius`。延续既有「字段名遵循 ECharts 规范，组件内 `as any` 桥接第三方类型」约定。

### 3. `FinanceChart.vue`：标题区当前值高亮

在图表上方标题区（现有 `<h2>财务趋势图</h2>` 旁）加「累计储蓄 ¥XXX万」高亮，取 `results` 末项 `cumSavings`（或当前选中月）经 `formatAxisAmount` / 万元格式显示。粒度切换 / 数据变化时自动更新（computed）。靛蓝主色文字 + 较大字号。

### 4. 数据流（不变）

```
props.results + granularity
  → computed chartData = buildChartData(results, granularity)   // 支出改正值
  → watch(chartData) → chart.setOption(buildChartOption(chartData))
容器 resize → ResizeObserver → chart.resize()
卸载 → chart.dispose() + 断开 observer
```

零计算逻辑改动；`aggregateByYear` / `calculate` 不动。

## 组件落点清单

| 文件 | 改动 |
|---|---|
| `uno.config.ts` | 新增 `zhusha` / `zhuqing` 色阶；`positive`→zhusha、`negative`→zhuqing |
| `src/utils/financeChart.ts` | 新增 `formatAxisAmount`；`buildChartData` 支出不取负；`buildChartOption` 面积主线 / 双柱正值 / 单网格 / 轴 formatter / 浅色 tooltip formatter / X 轴稀疏 / 配色常量；类型扩展 |
| `src/components/FinanceChart.vue` | 标题区当前累计值高亮 |
| `tests/utils/financeChart.spec.ts` | 更新配色断言（`#dc2626`→`#c0504d`、`#15803d`→`#6b8e7b`）；新增「支出取正」「`formatAxisAmount`」「累计 series 含 areaStyle」断言 |
| `tests/components/ComparisonView.spec.ts` | 复核 `text-positive-600` class 断言（class 不变，应仍通过） |

组件层的 `text-positive-*` / `text-negative-*` class、scoped 硬编码拖拽线 `#4f46e5`、行 hover 淡绿 `#f0fdf4` 均**不动**（非收支语义或属审美反馈）。

## 范围与不改动（YAGNI）

- 不动：计算逻辑、其他视图结构、数据流、按月/按年切换、多方案对比。
- 不做：目标 / 基准线（用户未优先 ⑤）、dataZoom、暗色模式、多方案折线叠加、图表导出图片、可编辑图表。
- 不做：`success` / `danger` 操作反馈色柔化（保留国际惯例）。

## 边界与错误处理

- **累计储蓄为负**：面积下探到 0 轴以下，Y 轴自适应，formatter 处理负值（`-` 前缀）。
- **全 0 数据**：柱不显示、面积平线，图表不报错。
- **恒定 60 月**：`calculate` 恒返回 60 月；`results` 为空时 `buildChartData` 返回空数组，图表空白（现有行为）。
- **竹青文字可读性**：diff 文字用 zhuqing-600（`#5e8270`），白底对比度优于 zhuqing-500；实现时若仍偏浅，diff 文字改用 700 阶。
- **tooltip formatter 健壮性**：某月 income/expense/cumSavings 缺失（undefined）时显示 `—`，不报错。

## 测试方案（Vitest）

### `tests/utils/financeChart.spec.ts`

- `formatAxisAmount`：`15800`→`1.6万`、`1234567`→`123.5万`、`120000000`→`1.2亿`、`-1500000`→`-150万`（累计为负场景）、`500`→`500`。
- `buildChartData`：支出系列为**正值**（不再取负）；月 / 年粒度正确。
- `buildChartOption`：
  - 累计 series 含 `areaStyle`（渐变）、`lineStyle.width` ≈ 2.5；
  - 收入 / 支出 series `data` 均为正值、`itemStyle.borderRadius` 存在；
  - 仅 `yAxis[0]` 有 `splitLine`、`yAxis[1].splitLine.show === false`；
  - 收入 `itemStyle.color === '#c0504d'`、支出 `=== '#6b8e7b'`、累计 `=== '#4f46e5'`；
  - `yAxis[*].axisLabel.formatter` 存在；`xAxis.axisLabel.interval` 设定。
- 现有「双轴 yAxisIndex 正确」「系列顺序」断言保留。

### 视觉走查（dev server）

- 切到图表视图：主线面积 + 粗线醒目、收支双柱正值并列、轴单位「万」、网格干净、tooltip 浅色含净结余、标题区当前值高亮。
- 切回表格 / 对比：红绿 diff 观感与图表同色系柔和、文字可读、操作反馈（导入成功绿 / 失败红）不变。

## 验收标准

1. 图表 Y 轴 / tooltip 无裸长数字，统一「万 / 亿」智能格式。
2. 累计储蓄为渐变面积 + 粗线，是视觉主线；标题区高亮当前累计值。
3. 收入 / 支出为正值并列双柱（圆角），无负轴镜像。
4. 仅左轴画横向淡网格，右轴无重复网格。
5. tooltip 为浅色卡片，含收入 / 支出 / 净结余 / 累计 + 中文标注 + 万元格式。
6. 全应用红绿为朱砂 / 竹青柔和色，图表柱与表格 diff 同色系；竹青文字色可读。
7. `success`（操作成功）= 绿、`danger`（失败/删除）= 红，不变。
8. `npm run build` 通过、`npm run test` 全绿。
