<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import FormulaPopover from './FormulaPopover.vue'
import type { MonthResult } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'
import { useStore } from '../composables/useStore'
import { useClickOutside } from '../composables/useClickOutside'

type FormulaField = 'investReturn' | 'monthlyBalance' | 'cumSavings'

const props = defineProps<{
  results: MonthResult[]
}>()

const store = useStore()
const columns = computed(() => store.data.value.columns)

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
  cumSavings: '余额',
}

// 现金流列单元格编辑状态
const editingCell = ref<{ columnId: string; month: number } | null>(null)
const editCellValue = ref<string>('')
const editCellInput = ref<HTMLInputElement | null>(null)

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

function handleAddColumn() {
  const newColumn = store.addColumn('')
  renamingColumnId.value = newColumn.id
  renameValue.value = ''
}

// 现金流列单元格编辑
// 记录编辑前的原始值，用于判断是否真正发生变化
const editCellOriginalValue = ref<number>(0)

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

// 点击外部退出编辑（mousedown 捕获阶段，先于 blur 触发）
useClickOutside(editCellInput, confirmEditCell)
useClickOutside(editCumInput, confirmEditCum)
useClickOutside(renameInput, confirmRename)

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
  <div class="h-full overflow-auto border rounded bg-white">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="sticky top-0 z-1 bg-gray-50">
        <tr class="border-b">
          <th class="px-1 py-0 text-left font-semibold whitespace-nowrap">月份</th>

          <!-- 动态现金流列 -->
          <th
            v-for="column in columns"
            :key="column.id"
            class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap relative group"
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
            <span v-else class="block w-full">
              <span
                class="cursor-pointer"
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
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">理财</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">收入</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">支出</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">结余</th>
          <th class="px-1 py-0 text-right tabular-nums font-semibold whitespace-nowrap">余额</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="result in results"
          :key="result.month"
          class="hover:bg-gray-50"
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
              { 'bg-blue-100': getColumnValue(result, column.id).isEdited }
            ]"
          >
            <input
              v-if="editingCell?.columnId === column.id && editingCell?.month === result.month"
              :ref="setEditCellInput"
              type="number"
              step="1"
              class="absolute inset-0 border rounded px-1 text-right text-[11px]"
              :value="editCellValue"
              @input="editCellValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmEditCell"
              @keyup.escape="cancelEditCell"
              @blur="confirmEditCell"
            />
            <span
              v-else
              class="block w-full cursor-pointer"
              :aria-label="`编辑 ${formatMonth(result.month)} ${column.name}`"
              @click="startEditCell(column.id, result.month, getColumnValue(result, column.id).amount)"
            >
              {{ formatCurrency(getColumnValue(result, column.id).amount) }}
            </span>
          </td>

          <!-- 添加列占位 -->
          <td class="px-1 py-0"></td>

          <!-- 理财列 -->
          <td
            class="px-1 py-0 text-right tabular-nums whitespace-nowrap"
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
          >
            <input
              v-if="editingCumMonth === result.month"
              :ref="setEditCumInput"
              type="number"
              step="1"
              class="absolute inset-0 border rounded px-1 text-right text-[11px]"
              :value="editCumValue"
              @input="editCumValue = ($event.target as HTMLInputElement).value"
              @keyup.enter="confirmEditCum"
              @keyup.escape="cancelEditCum"
              @blur="confirmEditCum"
            />
            <span
              v-else
              class="block w-full cursor-pointer text-right"
              :aria-label="`编辑 ${formatMonth(result.month)} 月末余额`"
              @click="startEditCum(result)"
              @mouseenter="showFormula(result, 'cumSavings', $event)"
              @mouseleave="popover = null"
            >
              {{ formatCurrency(result.cumSavings) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <FormulaPopover
    v-if="popover"
    :result="popover.result"
    :field="popover.field"
    :x="popover.x"
    :y="popover.y"
    @close="popover = null"
  />
</template>
