# 家庭财务规划应用

## 项目概述

单页家庭财务规划工具，用于模拟收入/支出/投资收益随时间变化的累计储蓄情况。

## 技术栈

- Vue 3 (Composition API + TypeScript) + Vite
- UnoCSS (原子化 CSS)
- Vitest 测试框架
- 数据持久化：localStorage

## 常用命令

```bash
npm run dev       # 启动开发服务器
npm run build     # 构建生产版本
npm run test      # 运行测试
npm run preview   # 预览生产构建
```

## 项目结构

```
src/
├── components/       # Vue 组件（ParamPanel, MonthlyTable, AnnualTable 等）
├── composables/      # 组合式函数（useStore 状态管理, useCalculation 计算逻辑）
├── utils/            # 工具函数（format 格式化, month 月份解析）
├── types.ts          # 核心类型定义
├── App.vue           # 主组件
└── main.ts           # 入口
tests/                # 测试文件
docs/                 # 需求/方案/计划文档
```

## 核心数据模型

- **PlanData**: 顶层数据结构，含系统参数和现金流项目
- **CashFlowItem**: 收入/支出项，含金额分段（AmountSegment）
- **MonthResult**: 月度计算结果（收入、支出、投资收益、净储蓄、累计）
- **MonthlyCorrection**: 实际存款修正，用于校验预期储蓄

## 开发约定

- Git 提交信息使用中文
- 分支：feature/family-finance-webapp
- 月份格式：YYYYMM（如 202601）
- 金额单位：元，显示时用 `format.ts` 格式化
- 不需要兼容旧数据

## 沟通风格（向用户汇报/解释时遵守）

- 项目负责人是软件研发，但**不是前端方向，对本项目技术栈不熟**（Vue / TypeScript / UnoCSS / ECharts / 测试框架等）。
- 向用户汇报、解释、总结时，**少用技术术语**：不要甩函数名、文件/模块名、CSS 类名、框架专有词（例如 `watch(fundEnabled)`、`MonthlyTable`、`text-amber-600 → text-warning-600` 这类）。
- **多用直观语言**：说清楚「这影响了哪个功能」「用户会看到什么界面变化」「交互怎么变」，可举具体使用场景。
- 对照示例：
  - ❌「移除冗余 `watch(fundEnabled)`」→ ✅「开关公积金后图表本来就会自动刷新，去掉了一段重复的刷新逻辑」
  - ❌「`setFundInterestMonth` 加 1-12 clamp」→ ✅「结息月份现在只能填 1-12，填多了会自动限制，避免填错导致结息失效」
  - ❌「`text-amber-600` 改 `text-warning-600`」→ ✅「公积金提取被截断时的提示颜色，改用项目统一的告警色，不再用一个单独的临时色」
- **代码本身**（实现、注释、提交信息）照常用准确的标识符和术语——这条只约束**给用户看的解释性文字**，不影响代码质量。
- 必须用术语才能讲清楚时，先一句话点明它对应的「用户能看到/能感受到的效果」，再补术语。

