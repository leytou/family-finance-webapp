# 累计列可编辑设计

## 概述

将月度表中的累计储蓄列（cumSavings）从只读改为可编辑，用户直接在表格中点击修改累计值。移除参数面板中的月度锚点管理 UI。

## 需求

1. 点击累计值 → 单元格变为 input 输入框，预填当前值
2. 回车或失焦确认编辑；值有变化时写入 anchors，清空时移除该月锚点
3. 编辑过的月份保留蓝色背景（现有 isAnchor 标记）
4. 公式弹窗改为 hover 触发（原 click 触发让给编辑）
5. 移除 ParamPanel 中的锚点管理区域

## 不变的部分

- `MonthlyAnchor` 类型定义
- `PlanData.anchors[]` 数据结构
- `useStore` 中的 `addAnchor`/`removeAnchor` 方法
- 计算引擎中的锚点逻辑（anchor 覆盖递推值，后续月份从 anchor 值重新递推）
- localStorage 自动持久化

## 交互细节

### 累计列编辑

- **触发**：点击单元格
- **编辑态**：input[type=number]，预填当前 cumSavings 值，自动 focus 并全选
- **确认**：回车或失焦
  - 值与当前不同 → 调用 `addAnchor(month, newValue)` 写入锚点
  - 值清空 → 调用 `removeAnchor(month)` 恢复自动计算
  - 值未变 → 无操作，退出编辑态
- **取消**：Escape 退出编辑态，不做任何修改

### 公式弹窗

- 触发方式从 click 改为 hover（mouseenter 显示，mouseleave 隐藏）
- 编辑态时不显示弹窗

### 视觉标记

- 编辑过的月份（isAnchor=true）保留蓝色背景，与现有行为一致

## 移除内容

- `ParamPanel.vue` 中锚点管理区域（第 112-160 行附近）：锚点列表、添加表单、删除按钮

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/components/MonthlyTable.vue` | 累计列改为可编辑 input，公式弹窗改 hover 触发 |
| `src/components/ParamPanel.vue` | 移除锚点管理 UI 区域 |
| `src/components/FormulaPopover.vue` | 触发方式适配 hover（如需调整） |
