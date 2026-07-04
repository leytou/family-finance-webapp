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
