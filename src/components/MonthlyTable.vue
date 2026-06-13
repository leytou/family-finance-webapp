<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import FormulaPopover from './FormulaPopover.vue'
import ContextMenu from './ContextMenu.vue'
import type { MonthResult, FlowColumn } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'
import { useStore } from '../composables/useStore'
import { buildComparison } from '../composables/useCalculation'
import { useClickOutside } from '../composables/useClickOutside'
import { useColumnDrag } from '../composables/useColumnDrag'

type FormulaField = 'investReturn' | 'monthlyBalance' | 'cumSavings'

const props = defineProps<{
  results: MonthResult[]
}>()

const store = useStore()
const columns = computed(() => store.data.value.columns)

// 动态列拖拽（列头按住拖动重排，范围限动态列内部）
const {
  draggingColumnId,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
} = useColumnDrag(store.moveColumn)

// 快照对比
const snapshots = computed(() => store.data.value.snapshots)
const sortedSnapshots = computed(() =>
  [...snapshots.value].sort((a, b) => b.createdMonth - a.createdMonth),
)
const selectedSnapshotId = ref<string | null>(null)
const selectedSnapshot = computed(
  () => snapshots.value.find(s => s.id === selectedSnapshotId.value) ?? null,
)

const comparisonByMonth = computed(() => {
  const list = buildComparison(props.results, selectedSnapshot.value)
  const map = new Map<number, { predicted: number | null; diff: number | null }>()
  for (const c of list) {
    map.set(c.month, { predicted: c.predicted, diff: c.diff })
  }
  return map
})

function getComparison(month: number) {
  return comparisonByMonth.value.get(month) ?? { predicted: null, diff: null }
}

function getDiffClass(diff: number | null): string {
  if (diff === null) return ''
  if (diff > 0) return 'text-green-600'
  if (diff < 0) return 'text-red-600'
  return 'text-gray-500'
}

// 快照重命名状态
const renamingSnapshotId = ref<string | null>(null)
const snapshotRenameValue = ref<string>('')
const snapshotRenameInput = ref<HTMLInputElement | null>(null)
function setSnapshotRenameInput(el: any) { snapshotRenameInput.value = el ?? null }

function handleAddSnapshot() {
  const snap = store.addSnapshot()
  selectedSnapshotId.value = snap.id
  renamingSnapshotId.value = snap.id
  snapshotRenameValue.value = snap.name
}

function confirmSnapshotRename() {
  if (renamingSnapshotId.value === null) return
  const trimmed = snapshotRenameValue.value.trim()
  if (trimmed) {
    store.renameSnapshot(renamingSnapshotId.value, trimmed)
  }
  renamingSnapshotId.value = null
  snapshotRenameValue.value = ''
}

function cancelSnapshotRename() {
  renamingSnapshotId.value = null
  snapshotRenameValue.value = ''
}

function startSnapshotRename() {
  if (!selectedSnapshot.value) return
  renamingSnapshotId.value = selectedSnapshot.value.id
  snapshotRenameValue.value = selectedSnapshot.value.name
}

function handleRemoveSnapshot() {
  const snap = selectedSnapshot.value
  if (!snap) return
  if (window.confirm(`确定要删除快照"${snap.name}"吗？`)) {
    store.removeSnapshot(snap.id)
    selectedSnapshotId.value = null
  }
}

// FormulaPopover 相关
const popover = ref<{
  result: MonthResult
  field: FormulaField
  x: number
  y: number
} | null>(null)

const formulaLabels: Record<FormulaField, string> = {
  investReturn: '理财收益',
  monthlyBalance: '本月结余',
  cumSavings: '存款',
}

// 现金流列单元格编辑状态
const editingCell = ref<{ columnId: string; month: number } | null>(null)
const editCellValue = ref<string>('')
const editCellInput = ref<HTMLInputElement | null>(null)

// 上下键在行间移动编辑状态时，跳过 blur 触发的关闭/保存（避免误关闭新打开的编辑框）
const skipBlur = ref(false)

// 累计列编辑状态
const editingCumMonth = ref<number | null>(null)
const editCumValue = ref<string>('')
const editCumInput = ref<HTMLInputElement | null>(null)

// 列头重命名状态
const renamingColumnId = ref<string | null>(null)
const renameValue = ref<string>('')
const renameInput = ref<HTMLInputElement | null>(null)

// v-for 内使用函数 ref，避免 Vue 3 将模板 ref 收集为数组
function setEditCellInput(el: any) { editCellInput.value = el ?? null }
function setEditCumInput(el: any) { editCumInput.value = el ?? null }
function setRenameInput(el: any) { renameInput.value = el ?? null }

// 获取特定月份、特定列的值
function getColumnValue(result: MonthResult, columnId: string): { amount: number; isEdited: boolean } {
  return result.columnValues.find(cv => cv.id === columnId) ?? { amount: 0, isEdited: false }
}

// FormulaPopover 相关函数
function showFormula(result: MonthResult, field: FormulaField, event: MouseEvent): void {
  popover.value = {
    result,
    field,
    x: event.clientX + 10,
    y: event.clientY + 10,
  }
}

function getFormulaAriaLabel(result: MonthResult, field: FormulaField): string {
  return `查看 ${formatMonth(result.month)} ${formulaLabels[field]}公式`
}

// 列头操作
function startRename(columnId: string, currentName: string) {
  renamingColumnId.value = columnId
  renameValue.value = currentName
}

function confirmRename() {
  if (renamingColumnId.value === null) return
  const trimmed = renameValue.value.trim()
  if (trimmed) {
    store.renameColumn(renamingColumnId.value, trimmed)
  }
  renamingColumnId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingColumnId.value = null
  renameValue.value = ''
}

function confirmRemoveColumn(columnId: string, columnName: string) {
  if (confirm(`确定要删除列"${columnName}"吗？`)) {
    store.removeColumn(columnId)
  }
}

// 列启用/禁用：缺省(undefined)/true 视为启用，仅 false 为禁用
function isColumnEnabled(column: FlowColumn): boolean {
  return column.enabled !== false
}

function toggleColumnEnabled(column: FlowColumn): void {
  store.setColumnEnabled(column.id, !isColumnEnabled(column))
}

function handleAddColumn() {
  const newColumn = store.addColumn('')
  renamingColumnId.value = newColumn.id
  renameValue.value = ''
}

// 现金流列单元格编辑
// 记录编辑前的原始值，用于判断是否真正发生变化
const editCellOriginalValue = ref<number>(0)

// 余额列在右键菜单逻辑中的特殊列标识
const BALANCE_COLUMN_ID = '__balance__'

// 右键菜单状态：columnId 为现金流列 id，或 BALANCE_COLUMN_ID 表示余额列
const contextMenu = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)

// 返回某列在指定月份"严格下方"所有编辑过值的行
function editedBelowRows(columnId: string, month: number): MonthResult[] {
  return props.results.filter(r =>
    r.month > month &&
    (columnId === BALANCE_COLUMN_ID ? r.isAnchor : getColumnValue(r, columnId).isEdited))
}

// 统计某列在指定月份"严格下方"编辑过的值的数量
function countEditedBelow(columnId: string, month: number): number {
  return editedBelowRows(columnId, month).length
}

// 清除某列在指定月份"严格下方"所有编辑过的值
function clearEditedBelow(columnId: string, month: number): void {
  editedBelowRows(columnId, month).forEach(r => {
    if (columnId === BALANCE_COLUMN_ID) {
      store.removeAnchor(r.month)
    } else {
      store.updateColumnEntry(columnId, r.month, null)
    }
  })
}

// 打开右键菜单
function openContextMenu(columnId: string, month: number, event: MouseEvent): void {
  contextMenu.value = { columnId, month, x: event.clientX, y: event.clientY }
}

// 当前右键菜单的菜单项
const contextMenuItems = computed(() => {
  const ctx = contextMenu.value
  if (!ctx) return []
  const items: { label: string; disabled?: boolean; onClick: () => void }[] = []

  // 同步到下方每年此月：仅现金流列，且该月存在直接编辑值时启用
  if (ctx.columnId !== BALANCE_COLUMN_ID) {
    const column = columns.value.find(c => c.id === ctx.columnId)
    const hasDirectEntry = column ? String(ctx.month) in column.entries : false
    items.push({
      label: '同步到下方每年此月',
      disabled: !hasDirectEntry,
      onClick: () => store.syncYearly(ctx.columnId, ctx.month),
    })
  }

  const count = countEditedBelow(ctx.columnId, ctx.month)
  items.push({
    label: '清除下方编辑值',
    disabled: count === 0,
    onClick: () => clearEditedBelow(ctx.columnId, ctx.month),
  })

  return items
})

function startEditCell(columnId: string, month: number, currentValue: number) {
  editingCell.value = { columnId, month }
  editCellOriginalValue.value = Math.round(currentValue)
  editCellValue.value = String(editCellOriginalValue.value)
  nextTick(() => {
    editCellInput.value?.select()
  })
}

function confirmEditCell() {
  if (!editingCell.value) return
  const { columnId, month } = editingCell.value
  const trimmed = editCellValue.value.trim()

  if (trimmed === '') {
    // 清空输入，删除 entry
    store.updateColumnEntry(columnId, month, null)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num)) {
      // 值未变化时不写入 entry，避免无意义的"已编辑"标记
      if (num !== editCellOriginalValue.value) {
        store.updateColumnEntry(columnId, month, num)
      }
    }
  }
  editingCell.value = null
  editCellValue.value = ''
}

function cancelEditCell() {
  editingCell.value = null
  editCellValue.value = ''
}

// 上下键在同一列的相邻行间移动编辑状态
async function moveEditCell(columnId: string, month: number, direction: -1 | 1) {
  const idx = props.results.findIndex(r => r.month === month)
  const targetIdx = idx + direction
  if (idx === -1 || targetIdx < 0 || targetIdx >= props.results.length) return
  // 先保存并关闭当前单元格，跳过 blur 重复触发；
  // 分两帧关闭/打开，确保函数 ref 的卸载(置 null)先于挂载(置元素)，
  // 否则向上移动时挂载早于卸载，ref 被错误置 null 导致新输入框无法聚焦。
  skipBlur.value = true
  confirmEditCell()
  await nextTick()
  const target = props.results[targetIdx]
  startEditCell(columnId, target.month, getColumnValue(target, columnId).amount)
  await nextTick()
  skipBlur.value = false
}

function handleEditCellBlur() {
  if (skipBlur.value) return
  confirmEditCell()
}

// 累计列编辑（锚点）
const editCumOriginalValue = ref<number>(0)

function startEditCum(result: MonthResult) {
  editingCumMonth.value = result.month
  editCumOriginalValue.value = Math.round(result.cumSavings)
  editCumValue.value = String(editCumOriginalValue.value)
  nextTick(() => {
    editCumInput.value?.select()
  })
}

function confirmEditCum() {
  if (editingCumMonth.value === null) return
  const trimmed = editCumValue.value.trim()

  if (trimmed === '') {
    store.removeAnchor(editingCumMonth.value)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num)) {
      // 值未变化时不写入锚点
      if (num !== editCumOriginalValue.value) {
        store.addAnchor(editingCumMonth.value, num)
      }
    }
  }
  editingCumMonth.value = null
  editCumValue.value = ''
}

function cancelEditCum() {
  editingCumMonth.value = null
  editCumValue.value = ''
}

// 上下键在余额列的相邻行间移动编辑状态
async function moveEditCum(month: number, direction: -1 | 1) {
  const idx = props.results.findIndex(r => r.month === month)
  const targetIdx = idx + direction
  if (idx === -1 || targetIdx < 0 || targetIdx >= props.results.length) return
  // 分两帧关闭/打开，确保卸载先于挂载（同 moveEditCell）
  skipBlur.value = true
  confirmEditCum()
  await nextTick()
  startEditCum(props.results[targetIdx])
  await nextTick()
  skipBlur.value = false
}

function handleEditCumBlur() {
  if (skipBlur.value) return
  confirmEditCum()
}

// 点击外部退出编辑（mousedown 捕获阶段，先于 blur 触发）
useClickOutside(editCellInput, confirmEditCell)
useClickOutside(editCumInput, confirmEditCum)
useClickOutside(renameInput, confirmRename)
useClickOutside(snapshotRenameInput, confirmSnapshotRename)

// v-focus 指令：元素挂载时自动聚焦
const vFocus = {
  mounted(el: HTMLInputElement) {
    el.focus()
    el.select()
  },
}

// 样式辅助函数：负数使用斜体
function getValueClass(value: number): string {
  if (value < 0) return 'italic'
  return ''
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 快照对比工具条 -->
    <div class="flex-none flex items-center gap-2 px-2 py-1 border-b bg-gray-50 text-[12px]">
      <span class="text-gray-500">计划对比</span>
      <!-- 命名编辑态 -->
      <input
        v-if="renamingSnapshotId !== null"
        :ref="setSnapshotRenameInput"
        v-focus
        type="text"
        class="border rounded px-1 text-[12px] w-32"
        :value="snapshotRenameValue"
        @input="snapshotRenameValue = ($event.target as HTMLInputElement).value"
        @keyup.enter="confirmSnapshotRename"
        @keyup.escape="cancelSnapshotRename"
        @blur="confirmSnapshotRename"
      />
      <!-- 选择器 -->
      <select
        v-else
        aria-label="选择对比快照"
        class="border rounded px-1 py-0.5 text-[12px]"
        :value="selectedSnapshotId ?? ''"
        @change="selectedSnapshotId = ($event.target as HTMLSelectElement).value || null"
      >
        <option value="">无</option>
        <option v-for="s in sortedSnapshots" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <!-- 选中快照后的重命名/删除 -->
      <template v-if="selectedSnapshot && renamingSnapshotId === null">
        <button type="button" class="text-blue-600 hover:text-blue-800" aria-label="重命名快照" @click="startSnapshotRename">重命名</button>
        <button type="button" class="text-red-600 hover:text-red-800" aria-label="删除快照" @click="handleRemoveSnapshot">删除</button>
      </template>
      <button
        type="button"
        class="ml-auto px-2 py-0.5 border rounded hover:bg-white"
        aria-label="封存当前计划"
        @click="handleAddSnapshot"
      >
        封存当前计划
      </button>
    </div>

    <!-- 原表格容器 -->
    <div class="flex-1 overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-1 py-0 text-left font-semibold whitespace-nowrap">月份</th>

          <!-- 动态现金流列 -->
          <th
            v-for="column in columns"
            :key="column.id"
            :draggable="renamingColumnId !== column.id"
            :class="[
              'px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap relative group',
              draggingColumnId === column.id ? 'opacity-50' : '',
              dropTarget?.columnId === column.id
                ? (dropTarget.side === 'before' ? 'drag-line-left' : 'drag-line-right')
                : '',
            ]"
            @dragstart="onDragStart(column.id, $event)"
            @dragover="onDragOver(column.id, $event)"
            @drop="onDrop(column.id, $event)"
            @dragend="onDragEnd"
          >
            <!-- 重命名输入框 -->
            <input
              v-if="renamingColumnId === column.id"
              :ref="setRenameInput"
              v-focus
              type="text"
              class="w-16 h-full border rounded px-1 text-right text-[11px]"
              :value="renameValue"
              @input="renameValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmRename"
              @keyup.escape="cancelRename"
              @blur="confirmRename"
            />
            <!-- 列头显示 -->
            <span v-else class="flex items-center justify-end w-full">
              <!-- 启用/禁用切换（hover 显示，与右侧 × 一致） -->
              <button
                type="button"
                class="mr-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-700"
                :aria-label="isColumnEnabled(column) ? '禁用此列' : '启用此列'"
                @click="toggleColumnEnabled(column)"
              >👁</button>
              <!-- 列名：禁用时加删除线 + 灰色 -->
              <span
                class="cursor-pointer"
                :class="{ 'line-through text-gray-400': !isColumnEnabled(column) }"
                aria-label="双击重命名"
                @dblclick="startRename(column.id, column.name)"
              >
                {{ column.name }}
              </span>
              <!-- 删除按钮 (hover 显示) -->
              <button
                type="button"
                class="ml-1 text-red-600 opacity-0 group-hover:opacity-100 hover:text-red-800"
                aria-label="删除列"
                @click="confirmRemoveColumn(column.id, column.name)"
              >
                ×
              </button>
            </span>
          </th>

          <!-- 添加列按钮 -->
          <th class="px-1 py-0 text-center whitespace-nowrap">
            <button
              type="button"
              class="text-blue-600 hover:text-blue-800 font-bold text-lg leading-none"
              aria-label="添加新列"
              @click="handleAddColumn"
            >
              +
            </button>
          </th>

          <!-- 固定列 -->
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap border-l border-gray-300">理财</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">收入</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">支出</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">结余</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">存款</th>
          <!-- 对比列表头 -->
          <th v-if="selectedSnapshot" class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">当时预计</th>
          <th v-if="selectedSnapshot" class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">差额</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="result in results"
          :key="result.month"
          class="hover:bg-green-50 even:bg-gray-500/[0.04]"
          :class="result.month % 100 === 12 ? 'border-b-2 border-gray-400' : 'border-b'"
        >
          <td class="px-1 py-0 whitespace-nowrap">{{ formatMonth(result.month) }}</td>

          <!-- 动态现金流列单元格 -->
          <td
            v-for="column in columns"
            :key="`${result.month}-${column.id}`"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap relative"
            :class="[
              getValueClass(getColumnValue(result, column.id).amount),
              { 'bg-blue-100': getColumnValue(result, column.id).isEdited },
              { 'opacity-40': !isColumnEnabled(column) }
            ]"
            @contextmenu.prevent="openContextMenu(column.id, result.month, $event)"
          >
            <input
              v-if="editingCell?.columnId === column.id && editingCell?.month === result.month"
              :ref="setEditCellInput"
              type="text"
              inputmode="numeric"
              class="absolute inset-0 border rounded px-1 text-right text-[11px]"
              :value="editCellValue"
              @input="editCellValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmEditCell"
              @keyup.escape="cancelEditCell"
              @keydown.up.prevent="moveEditCell(column.id, result.month, -1)"
              @keydown.down.prevent="moveEditCell(column.id, result.month, 1)"
              @blur="handleEditCellBlur"
            />
            <span
              v-else
              class="block w-full cursor-pointer"
              :aria-label="`编辑 ${formatMonth(result.month)} ${column.name}`"
              @click="startEditCell(column.id, result.month, getColumnValue(result, column.id).amount)"
            >
              {{ formatCurrency(getColumnValue(result, column.id).amount) }}<span
                v-if="column.yearlyMonths?.[result.month]"
                class="ml-0.5 text-blue-500"
                aria-hidden="true"
              >↻</span>
            </span>
          </td>

          <!-- 添加列占位 -->
          <td class="px-1 py-0"></td>

          <!-- 理财列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap border-l border-gray-300"
            :class="getValueClass(result.investReturn)"
          >
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'investReturn')"
              style="font: inherit"
              @click="showFormula(result, 'investReturn', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.investReturn) }}
            </button>
          </td>

          <!-- 本月收入列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
          >
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'monthlyBalance')"
              style="font: inherit"
              @click="showFormula(result, 'monthlyBalance', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.monthlyIncome) }}
            </button>
          </td>

          <!-- 本月支出列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getValueClass(result.monthlyExpense)"
          >
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'monthlyBalance')"
              style="font: inherit"
              @click="showFormula(result, 'monthlyBalance', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.monthlyExpense) }}
            </button>
          </td>

          <!-- 本月结余列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getValueClass(result.monthlyBalance)"
          >
            <button
              type="button"
              class="block w-full cursor-pointer border-0 bg-transparent p-0 text-right text-inherit"
              :aria-label="getFormulaAriaLabel(result, 'monthlyBalance')"
              style="font: inherit"
              @click="showFormula(result, 'monthlyBalance', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.monthlyBalance) }}
            </button>
          </td>

          <!-- 累计列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap font-bold relative"
            :class="[
              getValueClass(result.cumSavings),
              { 'bg-blue-100': result.isAnchor }
            ]"
            @contextmenu.prevent="openContextMenu(BALANCE_COLUMN_ID, result.month, $event)"
          >
            <input
              v-if="editingCumMonth === result.month"
              :ref="setEditCumInput"
              type="text"
              inputmode="numeric"
              class="absolute inset-0 border rounded px-1 text-right text-[11px]"
              :value="editCumValue"
              @input="editCumValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmEditCum"
              @keyup.escape="cancelEditCum"
              @keydown.up.prevent="moveEditCum(result.month, -1)"
              @keydown.down.prevent="moveEditCum(result.month, 1)"
              @blur="handleEditCumBlur"
            />
            <span
              v-else
              class="block w-full cursor-pointer text-right"
              :aria-label="`编辑 ${formatMonth(result.month)} 月末存款`"
              @click="startEditCum(result)"
              @mouseenter="showFormula(result, 'cumSavings', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.cumSavings) }}
            </span>
          </td>
          <!-- 对比列：当时预计 -->
          <td
            v-if="selectedSnapshot"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap text-gray-600"
          >
            <span v-if="getComparison(result.month).predicted !== null">
              {{ formatCurrency(getComparison(result.month).predicted as number) }}
            </span>
            <span v-else class="text-gray-300">—</span>
          </td>
          <!-- 对比列：差额 -->
          <td
            v-if="selectedSnapshot"
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getDiffClass(getComparison(result.month).diff)"
          >
            <span v-if="getComparison(result.month).diff !== null">
              {{ formatCurrency(getComparison(result.month).diff as number) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>

  <FormulaPopover
    v-if="popover"
    :result="popover.result"
    :field="popover.field"
    :x="popover.x"
    :y="popover.y"
    @close="popover = null"
  />

  <ContextMenu
    v-if="contextMenu"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :items="contextMenuItems"
    @close="contextMenu = null"
  />
</template>

<style scoped>
/* 拖拽插入线：用 box-shadow 不占布局空间，避免列宽跳动 */
.drag-line-left {
  box-shadow: -2px 0 0 0 #3b82f6;
}
.drag-line-right {
  box-shadow: 2px 0 0 0 #3b82f6;
}
</style>
