# 月度表年份分隔线设计

## 背景

月度表（MonthlyTable）展示 60 个月（5 年）的数据，每月一行，所有行外观一致。用户在阅读时难以快速区分不同年份的边界，需要增加视觉分隔。

## 目标

在每年 12 月行底部添加更粗的分隔线，便于区分不同年份。

## 方案

在 `<tr>` 标签上根据月份动态添加不同的底部边框样式：

- **12 月行**：`border-b-2 border-gray-400`（2px 深灰色）
- **其他月份**：`border-b`（保持原有 1px 默认灰色）

## 改动范围

仅修改 1 个文件：`src/components/MonthlyTable.vue`

### 代码变更

位置：`<tbody>` 内的 `<tr>` 标签（第 269 行附近）

```html
<!-- 改前 -->
<tr v-for="result in results" :key="result.month" class="border-b hover:bg-gray-50">

<!-- 改后 -->
<tr
  v-for="result in results"
  :key="result.month"
  class="hover:bg-gray-50"
  :class="result.month % 100 === 12 ? 'border-b-2 border-gray-400' : 'border-b'"
>
```

## 不涉及

- 无数据逻辑变更
- 无新增组件/文件
- 无样式文件变更（纯 UnoCSS 原子类）

## 测试

- 视觉验证：启动 dev server 确认每年 12 月行底部有明显分隔线
- 确认非 12 月行样式不变
