# 月度流水自适应窗口宽度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让月度流水表在常见笔记本窗口（1280+）下、典型列数（18–22 列）能装下并铺满窗口、随窗口宽度伸缩，与年度汇总一致；列太多装不下时才滚动。

**Architecture:** 纯样式调整。月度流水与年度汇总本就共用同一套「铺满 + 滚动」机制（`min-w-full` + `table-layout: auto` + `overflow-auto`），月度流水之所以常被「卡住不动」，是因为列多、所有列最小宽度之和超过了窗口容器宽度。实测 21 列（8 收支项 + 公积金）最小宽 1242px > 1280 窗口的容器 1201px。把月度流水表格单元格的水平内边距从 `px-1`（4px）收紧到 `px-0.5`（2px），总宽降到 1201px，正好装下。不改任何计算逻辑、数据、交互。

**Tech Stack:** Vue 3 (Composition API) + UnoCSS + Vitest（`@vue/test-utils`）。设计依据见 `docs/superpowers/specs/2026-06-19-monthly-table-responsive-width-design.md`。

**关键约束:**
- jsdom 无真实布局（`offsetWidth`/`scrollWidth` 恒为 0），「装得下/滚动」无法用单测断言。因此单测只锚定「改动已应用」（单元格 class 含 `px-0.5`），真正的「装得下」用浏览器多分辨率实测验证（Task 2）。
- 只动月度流水 `MonthlyTable.vue`；年度汇总 `AnnualTable.vue` 不碰。

---

### Task 1: 收紧月度流水表格单元格水平内边距

**Files:**
- Modify: `src/components/MonthlyTable.vue`（表格 `<table>...</table>` 内所有 `td`/`th`）
- Test: `tests/components/MonthlyTable.spec.ts`

**背景:** `MonthlyTable.vue` 的表格里，所有 `td`/`th` 的水平内边距都是 `px-1 py-0`（UnoCSS：`px-1` = 4px）。工具条里的输入框/按钮用的是 `px-1`（无 `py-0`）、`px-2` 等，不匹配 `px-1 py-0`，故用 `replace_all` 替换 `px-1 py-0` → `px-0.5 py-0` 只会命中表格单元格，不会误伤工具条。

- [ ] **Step 1: 写失败测试**

在 `tests/components/MonthlyTable.spec.ts` 的 `describe('MonthlyTable', () => { ... })` 内，紧接现有的 `it('表格样式正确应用', ...)` 测试之后，新增以下测试：

```ts
  it('表格单元格水平内边距收紧为 px-0.5（列多时降低总宽，便于窗口装下铺满）', async () => {
    const useStore = await loadUseStore()
    useStore()
    const wrapper = mount(MonthlyTable, { props: { results: [createResult()] } })

    const firstRowCells = wrapper.findAll('tbody tr')[0].findAll('td')
    // 月份列单元格收紧
    expect(firstRowCells[0].classes()).toContain('px-0.5')
    expect(firstRowCells[0].classes()).not.toContain('px-1')
    // 末列（存款）单元格同样收紧
    expect(firstRowCells[firstRowCells.length - 1].classes()).toContain('px-0.5')

    // 表头单元格同样收紧
    const headerCells = wrapper.findAll('thead tr')[0].findAll('th')
    expect(headerCells[0].classes()).toContain('px-0.5')
  })
```

- [ ] **Step 2: 运行测试，确认它失败**

Run:
```bash
npx vitest run tests/components/MonthlyTable.spec.ts -t "水平内边距收紧"
```
Expected: FAIL，断言 `toContain('px-0.5')` 失败（当前单元格仍是 `px-1`）。

- [ ] **Step 3: 收紧内边距（两步替换，避免误伤工具条下拉框）**

⚠️ 不能直接 `replace_all "px-1 py-0"`:月度流水顶部「对比快照」下拉框 `<select>` 的 class 是 `px-1 py-0.5`,其中含子串 `px-1 py-0`,会被误伤。因此分两步:

**Step 3a** — 全量替换「带尾随空格」的串(命中所有 `px-1 py-0 ` 开头的 td/th;不匹配下拉框的 `px-1 py-0.5`,因其 `py-0` 后是 `.5` 不是空格):

- `old_string`: `px-1 py-0 `（末尾有一个空格）
- `new_string`: `px-0.5 py-0 `
- `replace_all`: `true`

**Step 3b** — 单独改「添加新列」表头下的空占位 td(它的 class 是 `px-1 py-0` 紧跟引号、没有尾随空格,Step 3a 没命中它):

- `old_string`: `<td class="px-1 py-0"></td>`
- `new_string`: `<td class="px-0.5 py-0"></td>`
- `replace_all`: `false`（全文件仅一处）

两步合起来覆盖表格内全部 `td`/`th`(月份、动态列、添加列占位、专项、理财、收入、支出、结余、存款、公积金专区、对比列);工具条的下拉框(`px-1 py-0.5`)、按钮(`px-2`)、输入框(`px-1 text-...`)均不受影响。年度汇总 `AnnualTable.vue` 不在本文件,不受影响。

- [ ] **Step 4: 运行测试，确认通过**

Run:
```bash
npx vitest run tests/components/MonthlyTable.spec.ts -t "水平内边距收紧"
```
Expected: PASS。

- [ ] **Step 5: 运行 MonthlyTable 全部测试，确认无回归**

Run:
```bash
npx vitest run tests/components/MonthlyTable.spec.ts
```
Expected: 全部 PASS（现有测试不依赖 `px-1`，不受影响）。

- [ ] **Step 6: 提交**

```bash
git add src/components/MonthlyTable.vue tests/components/MonthlyTable.spec.ts
git commit -m "style(ui): 月度流水收紧单元格内边距，窄窗口下铺满自适应"
```

---

### Task 2: 浏览器多分辨率实测验证

> 此任务不改代码，只验证 Task 1 的真实效果。jsdom 测不了布局，这一步是「装得下」的唯一权威验证。

**Files:** 无（仅运行）

- [ ] **Step 1: 启动开发服务器**

Run:
```bash
npm run dev
```
记下输出里的 `Local: http://localhost:<port>/`（5173 被占时会用 5174/5175）。

- [ ] **Step 2: 在浏览器打开应用，写入接近真实的 21 列数据**

用浏览器 DevTools 控制台（或 chrome-devtools `evaluate_script`）在应用页面执行：

```js
(() => {
  const ws = {
    version: 1,
    scenarios: [{
      id: 's1', name: '买房方案',
      plan: {
        version: 2,
        systemParams: { startMonth: 202606, endMonth: 203112, annualRate: 0.025, initialDeposit: 40000, fundRate: 0.015, fundInterestMonth: 7, fundInitialBalance: 50000 },
        columns: [
          { id: 'c1', name: '工资收入', entries: { 202606: 12800, 202607: 12800, 202608: 12800 } },
          { id: 'c2', name: '副业收入', entries: { 202606: 5800 } },
          { id: 'c3', name: '房贷支出', entries: { 202606: -6800 } },
          { id: 'c4', name: '生活费', entries: { 202606: -4800 } },
          { id: 'c5', name: '育儿支出', entries: { 202606: -2800 } },
          { id: 'c6', name: '车贷', entries: { 202606: -3500 } },
          { id: 'c7', name: '保险费', entries: { 202606: -1200 } },
          { id: 'c8', name: '其他杂项', entries: { 202606: -900 } }
        ],
        anchors: [], snapshots: [], events: [],
        fund: {
          mortgage: { id: 'fm', name: '房贷月供', entries: { 202606: -5800 } },
          contribution: { id: 'fc', name: '公积金缴存', entries: { 202606: 3800 } },
          monthlyOffset: { id: 'fo', name: '公积金月冲', entries: {} },
          withdrawals: [], anchors: []
        }
      }
    }],
    activeId: 's1'
  }
  localStorage.setItem('family-finance-plan', JSON.stringify(ws))
  location.reload()
})()
```

刷新后确认月度流水表头出现 21 列（月份 + 8 收支项 + 添加列占位 + 专项 + 理财 + 收入 + 支出 + 结余 + 存款 + 公积金 5 列）。

- [ ] **Step 3: 在 1280 宽度下验证「装得下、无滚动条」**

把窗口调成 1280×800（浏览器 DevTools 设备工具栏，或 chrome-devtools `resize_page` width=1280 height=800；若物理屏幕不够宽，用 `emulate` viewport `1280x800x1`）。

执行测量脚本：

```js
(() => {
  const t = document.querySelectorAll('table')[1] // [0]=年度汇总 [1]=月度流水
  let s = t.parentElement
  while (s && !['auto', 'scroll'].includes(getComputedStyle(s).overflowX)) {
    s = s.parentElement
    if (!s || s === document.body) break
  }
  return {
    window: window.innerWidth,
    cols: t.querySelector('tr').children.length,
    tableScrollWidth: t.scrollWidth,
    containerClientWidth: s.clientWidth,
    fits: t.scrollWidth <= s.clientWidth
  }
})()
```

Expected: `cols: 21`，`fits: true`，`tableScrollWidth <= containerClientWidth`（约 1201 ≤ 1201）。底部**无**横向滚动条。

> 门槛说明：这是改动成功的硬指标。若 `fits: false`，说明收紧力度不够——把 Task 1 的 `px-0.5` 进一步改为 `px-[2px]`、再不行 `px-[1px]`，重跑本步直到 `fits: true`，然后把最终值回填到 Task 1 Step 3 与单测断言。

- [ ] **Step 4: 在更宽窗口下验证「随窗口伸缩铺满」**

把窗口逐步拉宽到 1536、1920（或 `emulate`），每次执行 Step 3 的测量脚本。

Expected: `tableScrollWidth` 随 `containerClientWidth` 同步增大（表格铺满窗口、跟着变宽），始终 `fits: true`。年度汇总表同样随窗口变宽。

- [ ] **Step 5: 验证「装不下时仍能滚动、不破版」**

把窗口收到 1024 或更窄，执行测量脚本。

Expected: `fits: false`（出现横向滚动条，符合「装不下才滚动」）；表格不溢出、不破版，表头 sticky 正常。

- [ ] **Step 6: 截图对比，供用户确认紧凑度可接受**

在 1280 宽度下截图月度流水区域，与改动前（或年度汇总）对比，确认数字两侧留白变窄但清晰可读、整体更紧凑。把截图结论汇报给用户。

---

### Task 3: 全量回归与收尾

**Files:** 无

- [ ] **Step 1: 运行全量测试**

Run:
```bash
npm run test
```
Expected: 全部 PASS（`passWithNoTests: false`，应有全绿）。

- [ ] **Step 2: 确认工作区干净**

Run:
```bash
git status
```
Expected: Task 1 的改动已提交，无遗漏的未跟踪文件（临时截图等已删除）。

- [ ] **Step 3: 汇报结果**

把「单测全绿 + 1280/1536/1920 装得下铺满 + 极窄窗口滚动正常 + 截图」汇报给用户，按 `docs/superpowers/specs/2026-06-19-monthly-table-responsive-width-design.md` 的验收口径收尾。
