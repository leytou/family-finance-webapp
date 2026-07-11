<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import FormulaPopover from './FormulaPopover.vue'
import { buildMonthFormula, type MonthFormulaField } from '../utils/formula'
import ContextMenu from './ContextMenu.vue'
import ItemEditor from './ItemEditor.vue'
import EventDetailPopover from './EventDetailPopover.vue'
import FundFlowEditor from './FundFlowEditor.vue'
import type { MonthResult, FlowColumn, MilestoneEvent, FundConfig, FundWithdrawal } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth, getCurrentMonth } from '../utils/month'
import { computePopoverX } from '../utils/popover'
import { useStore } from '../composables/useStore'
import { buildComparison, resolveColumnValue, hasColumnValue, resolveFundOffset, resolveColumnItems } from '../composables/useCalculation'
import { useClickOutside } from '../composables/useClickOutside'
import { useColumnDrag } from '../composables/useColumnDrag'

const props = defineProps<{
  results: MonthResult[]
}>()

const store = useStore()
const columns = computed(() => store.data.value.columns)

// 当前真实月份(YYYYMM,如 202607),用于标记月度表「本月」行(上下淡分割线 + 「今」徽标)
const currentMonth = getCurrentMonth()

// 空列引导气泡是否被用户手动关闭（仅本次会话内记着；刷新页面可恢复提示）
const hintDismissed = ref(false)

// 公积金配置（未启用时为 undefined，专区不渲染）
const fund = computed<FundConfig | undefined>(() => store.data.value.fund)

// 专区单元格取值
function fundMortgageAbs(month: number): number {
  return Math.abs(resolveColumnValue(fund.value!.mortgage, month).amount)
}
function fundContribution(month: number): number {
  return resolveColumnValue(fund.value!.contribution, month).amount
}
// 房贷月供 / 公积金缴存：该月是否手填过（用于浅蓝底与右键判断）
function isFundEntryEdited(field: 'mortgage' | 'contribution', month: number): boolean {
  return fund.value ? String(month) in fund.value[field].itemSets : false
}
// 月冲：手填用手填值，否则自动联动房贷月供（返回 { value, auto }）
function fundOffsetDisplay(month: number): { value: number; auto: boolean } {
  if (!fund.value) return { value: 0, auto: false }
  if (hasColumnValue(fund.value.monthlyOffset, month)) {
    return { value: Math.abs(resolveColumnValue(fund.value.monthlyOffset, month).amount), auto: false }
  }
  return { value: resolveFundOffset(fund.value, month), auto: true }
}
// 公积金期初余额：上月末 fundBalance，首月取 fundInitialBalance
function fundPrevBalance(month: number): number {
  const idx = props.results.findIndex(r => r.month === month)
  if (idx <= 0) return store.data.value.systemParams.fundInitialBalance ?? 0
  return props.results[idx - 1].fundBalance
}
// 当月公积金提取列表（FundFlowEditor 初始化草稿用）
function fundWithdrawalsByMonth(month: number): FundWithdrawal[] {
  return fund.value?.withdrawals.filter(w => w.month === month) ?? []
}
// 该月公积金余额修正（实际余额）；undefined=未修正
function fundActualBalance(month: number): number | undefined {
  return fund.value?.corrections.find(an => an.month === month)?.actualBalance
}
// FundFlowEditor 的该月 result：fundFlowEditor 打开的月份必在 results 内（余额单元格由 results v-for 渲染），
// 断言集中在此 computed，避免模板内联 results.find(...)! 散落。
const fundFlowEditorResult = computed<MonthResult>(() =>
  props.results.find(r => r.month === fundFlowEditor.value!.month)!,
)

// 专项事件：按月聚合（净额、笔数、明细）。单元格直接读此 map，不依赖 columnValues
const ZERO_EVENT_INFO = { net: 0, count: 0, events: [] as MilestoneEvent[] }
const eventsByMonth = computed(() => {
  const map = new Map<number, { net: number; count: number; events: MilestoneEvent[] }>()
  for (const e of store.data.value.events) {
    const cur = map.get(e.month) ?? { net: 0, count: 0, events: [] }
    cur.net += e.amount
    cur.count += 1
    cur.events.push(e)
    map.set(e.month, cur)
  }
  return map
})
function eventInfo(month: number) {
  return eventsByMonth.value.get(month) ?? ZERO_EVENT_INFO
}

// 事件编辑器状态
const eventEditor = ref<{ month: number; x: number; y: number } | null>(null)
function openEventEditor(month: number, event: MouseEvent) {
  // 编辑器宽约 min-w-64(256)，估 288；靠右时整体左移避免溢出视口
  eventEditor.value = { month, x: computePopoverX(event.clientX, { expectedWidth: 288 }), y: event.clientY }
  // 打开编辑器时收起悬浮明细，避免两者叠加
  eventPopover.value = null
}
function closeEventEditor() {
  eventEditor.value = null
}

// 专项悬浮明细弹窗：仅展示，无编辑能力
const eventPopover = ref<{ month: number; x: number; y: number } | null>(null)
function showEventDetail(month: number, event: MouseEvent) {
  // 仅在有事件的月份才弹出明细
  if (eventInfo(month).count > 0) {
    eventPopover.value = { month, x: computePopoverX(event.clientX), y: event.clientY + 10 }
  }
}
function hideEventDetail() {
  eventPopover.value = null
}

// 动态列是否为明细模式
function isDetailColumn(column: FlowColumn): boolean {
  return column.mode === 'detail'
}

// 动态列明细编辑器状态：点击单元格时打开，可新增/编辑/删除多条「名称+金额」明细
const detailEditor = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)
function openDetailEditor(columnId: string, month: number, event: MouseEvent) {
  // 编辑器宽约 min-w-64(256)，估 288；靠右时整体左移避免溢出视口
  detailEditor.value = { columnId, month, x: computePopoverX(event.clientX, { expectedWidth: 288 }), y: event.clientY }
  // 打开编辑器时收起悬浮明细，避免两者叠加（与专项 openEventEditor 一致）
  detailPopover.value = null
}
function closeDetailEditor() {
  detailEditor.value = null
}
// 编辑器当前对应的列与结果：在 setup 中解析，避免模板内联非空断言
const detailEditorColumn = computed(() =>
  detailEditor.value ? columns.value.find(c => c.id === detailEditor.value!.columnId) : undefined,
)
function handleDetailEditorSave(items: { name: string; amount: number }[]) {
  if (detailEditor.value) store.replaceColumnItems(detailEditor.value.columnId, detailEditor.value.month, items)
}

// 动态列只读明细弹窗状态：悬停单元格时展示已有明细（无可弹项时不弹）
const detailPopover = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)
function showDetailPopover(columnId: string, month: number, event: MouseEvent) {
  const col = columns.value.find(c => c.id === columnId)
  if (col && resolveColumnItems(col, month).length > 0) {
    detailPopover.value = { columnId, month, x: computePopoverX(event.clientX), y: event.clientY + 10 }
  }
}
function hideDetailPopover() {
  detailPopover.value = null
}
// 弹窗当前对应的列与结果：在 setup 中解析，避免模板内联非空断言
const detailPopoverColumn = computed(() =>
  detailPopover.value ? columns.value.find(c => c.id === detailPopover.value!.columnId) : undefined,
)
const detailPopoverResult = computed(() =>
  detailPopover.value ? props.results.find(r => r.month === detailPopover.value!.month) : undefined,
)


// 公积金流水编辑器状态
const fundFlowEditor = ref<{ month: number; x: number; y: number } | null>(null)
function openFundFlowEditor(month: number, event: MouseEvent) {
  fundFlowEditor.value = { month, x: computePopoverX(event.clientX, { expectedWidth: 288 }), y: event.clientY }
}
function closeFundFlowEditor() {
  fundFlowEditor.value = null
}

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
  if (diff > 0) return 'text-positive-600'   // 实际>预计：存得更多（中式正向=红）
  if (diff < 0) return 'text-negative-600'   // 实际<预计：存得更少（中式负向=绿）
  return 'text-ink-3'
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
  title: string
  lines: string[]
  x: number
  y: number
} | null>(null)

const formulaLabels: Record<MonthFormulaField, string> = {
  investReturn: '理财',
  monthlyIncome: '收入',
  monthlyExpense: '支出',
  monthlyBalance: '结余',
  cumSavings: '存款',
  fundOffset: '月冲',
  fundOffsetShortfall: '存款补扣',
  fundBalance: '公积金',
  fundInterest: '结息',
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
function showFormula(result: MonthResult, field: MonthFormulaField, event: MouseEvent): void {
  const idx = props.results.findIndex(r => r.month === result.month)
  const initialDeposit = store.data.value.systemParams.initialDeposit ?? 0
  const prevCum = idx === 0 ? initialDeposit : props.results[idx - 1].cumSavings
  const prevFundBalance = fundPrevBalance(result.month)
  const od = fundOffsetDisplay(result.month)
  const { title, lines } = buildMonthFormula(result, field, {
    annualRate: store.data.value.systemParams.annualRate,
    prevCum,
    prevFundBalance,
    fundContribution: result.fundContribution,
    fundWithdrawal: result.fundWithdrawal,
    fundOffset: result.fundOffset,
    fundInterest: result.fundInterest,
    fundBalance: result.fundBalance,
    fundRate: store.data.value.systemParams.fundRate,
    mortgageAbs: fund.value ? fundMortgageAbs(result.month) : 0,
    offsetAutoLinked: od.auto,
    fundOffsetTarget: od.value,
  })
  popover.value = { title, lines, x: computePopoverX(event.clientX), y: event.clientY + 10 }
}

function getFormulaAriaLabel(result: MonthResult, field: MonthFormulaField): string {
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
// 公积金余额列在右键菜单逻辑中的特殊列标识
const FUND_BALANCE_COLUMN_ID = '__fund_balance__'

// 房贷月供 / 公积金缴存列在右键菜单逻辑中的特殊列标识
const FUND_MORTGAGE_COLUMN_ID = '__fund_mortgage__'
const FUND_CONTRIBUTION_COLUMN_ID = '__fund_contribution__'

// 标识 → fund 字段名；非专区固定列返回 null
function fundFieldFromColumnId(columnId: string): 'mortgage' | 'contribution' | null {
  if (columnId === FUND_MORTGAGE_COLUMN_ID) return 'mortgage'
  if (columnId === FUND_CONTRIBUTION_COLUMN_ID) return 'contribution'
  return null
}

// 右键菜单状态：columnId 为现金流列 id，或 BALANCE_COLUMN_ID 表示余额列
const contextMenu = ref<{ columnId: string; month: number; x: number; y: number } | null>(null)

// 返回某列在指定月份"严格下方"所有编辑过值的行
function editedBelowRows(columnId: string, month: number): MonthResult[] {
  const fundField = fundFieldFromColumnId(columnId)
  return props.results.filter(r =>
    r.month > month &&
    (columnId === BALANCE_COLUMN_ID ? r.isCorrected
      : columnId === FUND_BALANCE_COLUMN_ID ? r.isFundCorrected
      : fundField ? isFundEntryEdited(fundField, r.month)
      : getColumnValue(r, columnId).isEdited))
}

// 统计某列在指定月份"严格下方"编辑过的值的数量
function countEditedBelow(columnId: string, month: number): number {
  return editedBelowRows(columnId, month).length
}

// 清除某列在指定月份"严格下方"所有编辑过的值
function clearEditedBelow(columnId: string, month: number): void {
  const fundField = fundFieldFromColumnId(columnId)
  editedBelowRows(columnId, month).forEach(r => {
    if (columnId === BALANCE_COLUMN_ID) {
      store.removeCorrection(r.month)
    } else if (columnId === FUND_BALANCE_COLUMN_ID) {
      store.removeFundCorrection(r.month)
    } else if (fundField) {
      store.updateFundEntry(fundField, r.month, null)
    } else {
      store.updateColumnEntry(columnId, r.month, null)
    }
  })
}

// 当前格是否已被手动编辑（决定「清除该值」是否可用）
function isCurrentCellEdited(columnId: string, month: number): boolean {
  if (columnId === BALANCE_COLUMN_ID) {
    return props.results.find(r => r.month === month)?.isCorrected ?? false
  }
  if (columnId === FUND_BALANCE_COLUMN_ID) {
    return props.results.find(r => r.month === month)?.isFundCorrected ?? false
  }
  const fundField = fundFieldFromColumnId(columnId)
  if (fundField) return isFundEntryEdited(fundField, month)
  const column = columns.value.find(c => c.id === columnId)
  return column ? String(month) in column.itemSets : false
}

// 清除当前格的编辑值
function clearCurrentValue(columnId: string, month: number): void {
  const fundField = fundFieldFromColumnId(columnId)
  if (columnId === BALANCE_COLUMN_ID) {
    store.removeCorrection(month)
  } else if (columnId === FUND_BALANCE_COLUMN_ID) {
    store.removeFundCorrection(month)
  } else if (fundField) {
    store.updateFundEntry(fundField, month, null)
  } else {
    store.updateColumnEntry(columnId, month, null)
  }
}

// 打开右键菜单
function openContextMenu(columnId: string, month: number, event: MouseEvent): void {
  // 菜单项最长约「同步到下方每年此月」，估 192；靠右时整体左移避免溢出视口
  contextMenu.value = { columnId, month, x: computePopoverX(event.clientX, { expectedWidth: 192 }), y: event.clientY }
}

// 当前右键菜单的菜单项
const contextMenuItems = computed(() => {
  const ctx = contextMenu.value
  if (!ctx) return []
  const items: { label: string; disabled?: boolean; onClick: () => void }[] = []

  const isBalanceColumn = ctx.columnId === BALANCE_COLUMN_ID || ctx.columnId === FUND_BALANCE_COLUMN_ID
  // 专区固定列（房贷月供/公积金缴存）：「同步」项恒置灰
  const isFundFixed = fundFieldFromColumnId(ctx.columnId) !== null

  // 同步到下方每年此月：余额列不显示；专区固定列显示但恒置灰；动态列按是否有直接值
  if (!isBalanceColumn) {
    const column = columns.value.find(c => c.id === ctx.columnId)
    const hasDirectEntry = column ? String(ctx.month) in column.itemSets : false
    items.push({
      label: '同步到下方每年此月',
      disabled: isFundFixed ? true : !hasDirectEntry,
      onClick: () => store.syncYearly(ctx.columnId, ctx.month),
    })
  }

  // 清除该值：当前单元格存在编辑值时启用（动态列与余额列均支持）
  items.push({
    label: '清除该值',
    disabled: !isCurrentCellEdited(ctx.columnId, ctx.month),
    onClick: () => clearCurrentValue(ctx.columnId, ctx.month),
  })

  const count = countEditedBelow(ctx.columnId, ctx.month)
  const clearLabel = ctx.columnId === FUND_BALANCE_COLUMN_ID
    ? '清除下方公积金修正'
    : '清除下方编辑值'
  items.push({
    label: clearLabel,
    disabled: count === 0,
    onClick: () => clearEditedBelow(ctx.columnId, ctx.month),
  })

  // 切换明细/单值：仅真实动态列（余额列、公积金专区固定列不切换）
  if (!isBalanceColumn && !isFundFixed) {
    const col = columns.value.find(c => c.id === ctx.columnId)
    if (col) {
      items.push({
        label: col.mode === 'detail' ? '切回单值' : '切换为明细列',
        onClick: () => store.setColumnMode(ctx.columnId, col.mode === 'detail' ? 'single' : 'detail'),
      })
    }
  }

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

// 累计列编辑（修正）
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
    store.removeCorrection(editingCumMonth.value)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num)) {
      // 值未变化时不写入修正
      if (num !== editCumOriginalValue.value) {
        store.addCorrection(editingCumMonth.value, num)
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

// 公积金专区单元格编辑状态（独立 ref，镜像 editCell/editCum 模式）
const editingFundCell = ref<{ field: 'mortgage' | 'contribution' | 'monthlyOffset'; month: number } | null>(null)
const editFundCellValue = ref<string>('')
const editFundCellInput = ref<HTMLInputElement | null>(null)
const editFundOriginalValue = ref<number>(0)
function setEditFundCellInput(el: any) { editFundCellInput.value = el ?? null }

function fundEditKey(field: 'mortgage' | 'contribution' | 'monthlyOffset', month: number): string {
  return `${field}-${month}`
}

function startEditFundCell(
  field: 'mortgage' | 'contribution' | 'monthlyOffset',
  month: number,
) {
  if (!fund.value) return
  const current = Math.abs(resolveColumnValue(fund.value[field], month).amount)
  editingFundCell.value = { field, month }
  editFundOriginalValue.value = Math.round(current)
  editFundCellValue.value = String(editFundOriginalValue.value)
  nextTick(() => {
    editFundCellInput.value?.select()
  })
}

function confirmEditFundCell() {
  if (!editingFundCell.value) return
  const { field, month } = editingFundCell.value
  const trimmed = editFundCellValue.value.trim()
  if (trimmed === '') {
    store.updateFundEntry(field, month, null)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num) && num !== editFundOriginalValue.value) {
      store.updateFundEntry(field, month, field === 'mortgage' ? -num : num)
    }
  }
  editingFundCell.value = null
  editFundCellValue.value = ''
}

function cancelEditFundCell() {
  editingFundCell.value = null
  editFundCellValue.value = ''
}

async function moveEditFundCell(
  field: 'mortgage' | 'contribution' | 'monthlyOffset',
  month: number,
  direction: -1 | 1,
) {
  const idx = props.results.findIndex(r => r.month === month)
  const targetIdx = idx + direction
  if (idx === -1 || targetIdx < 0 || targetIdx >= props.results.length) return
  skipBlur.value = true
  confirmEditFundCell()
  await nextTick()
  startEditFundCell(field, props.results[targetIdx].month)
  await nextTick()
  skipBlur.value = false
}

function handleEditFundCellBlur() {
  if (skipBlur.value) return
  confirmEditFundCell()
}

// 点击外部退出编辑（mousedown 捕获阶段，先于 blur 触发）
useClickOutside(editCellInput, confirmEditCell)
useClickOutside(editCumInput, confirmEditCum)
useClickOutside(editFundCellInput, confirmEditFundCell)
useClickOutside(renameInput, confirmRename)
useClickOutside(snapshotRenameInput, confirmSnapshotRename)

// v-focus 指令：元素挂载时自动聚焦
const vFocus = {
  mounted(el: HTMLInputElement) {
    el.focus()
    el.select()
  },
}

// 样式辅助函数：负数用竹青色（中式负向）以区分流向
function getValueClass(value: number): string {
  if (value < 0) return 'text-negative-600'
  return ''
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 快照对比工具条 -->
    <div class="flex-none flex items-center gap-2 px-2 py-1 border-b bg-surface-2 text-[12px]">
      <button
        type="button"
        class="ml-auto px-2 py-0.5 border rounded hover:bg-surface"
        aria-label="保存计划快照"
        @click="handleAddSnapshot"
      >
        保存计划快照
      </button>
      <span class="text-ink-3">计划对比</span>
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
        <button type="button" class="text-brand-600 hover:text-brand-700" aria-label="重命名快照" @click="startSnapshotRename">重命名</button>
        <button type="button" class="text-danger-600 hover:text-danger-800" aria-label="删除快照" @click="handleRemoveSnapshot">删除</button>
      </template>
    </div>

    <!-- 原表格容器 -->
    <div class="flex-1 border rounded bg-surface">
    <table class="min-w-full border-collapse text-[11px] leading-tight">
      <thead class="sticky top-7 z-1 bg-surface-2 font-mono">
        <tr class="border-b">
          <th class="px-0.5 py-0 text-left font-mono font-semibold whitespace-nowrap">月份</th>

          <!-- 动态现金流列 -->
          <th
            v-for="column in columns"
            :key="column.id"
            :draggable="renamingColumnId !== column.id"
            :class="[
              'px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap relative group',
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
                class="mr-1 text-ink-3 opacity-0 group-hover:opacity-100 hover:text-ink-2"
                :aria-label="isColumnEnabled(column) ? '禁用此列' : '启用此列'"
                @click="toggleColumnEnabled(column)"
              ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-middle"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg></button>
              <!-- 列名：禁用时加删除线 + 灰色 -->
              <span
                class="cursor-pointer"
                :class="{ 'line-through text-ink-3': !isColumnEnabled(column) }"
                aria-label="双击重命名"
                @dblclick="startRename(column.id, column.name)"
              >
                {{ column.name }}
              </span>
              <!-- 删除按钮 (hover 显示) -->
              <button
                type="button"
                class="ml-1 text-danger-600 opacity-0 group-hover:opacity-100 hover:text-danger-800"
                aria-label="删除列"
                @click="confirmRemoveColumn(column.id, column.name)"
              >
                ×
              </button>
            </span>
          </th>

          <!-- 添加列按钮 -->
          <th class="relative px-0.5 py-0 text-center font-mono whitespace-nowrap">
            <button
              type="button"
              class="text-brand-600 hover:text-brand-700 font-bold text-lg leading-none"
              aria-label="添加新列"
              @click="handleAddColumn"
            >
              +
            </button>
            <!-- 空列引导气泡:还没有任何自定义收支列时常驻提示,新增第一列后随 columns 变化自动消失;可手动关闭 -->
            <div v-if="columns.length === 0 && !hintDismissed" class="empty-col-hint font-sans" role="status">
              <button
                type="button"
                class="empty-col-hint-close"
                aria-label="关闭提示"
                @click="hintDismissed = true"
              >×</button>
              点这里添加一列收支
              <span class="block opacity-90">(如工资、房租)</span>
            </div>
          </th>

          <!-- 专项固定列(右侧 i 图标 hover 显示用途说明) -->
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap border-l border-line">
            <span class="inline-flex items-center justify-end gap-0.5">
              专项
              <span class="info-trigger">
                <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                <span class="info-tooltip">可添加一次性大额收支，如结婚、买房、年终奖等</span>
              </span>
            </span>
          </th>

          <!-- 固定列 -->
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">理财</th>
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">收入</th>
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">支出</th>
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">结余</th>
          <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap" data-tour="balance-col">存款</th>
          <!-- 对比列表头：紧贴存款列，便于直接对照快照偏差 -->
          <th v-if="selectedSnapshot" class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">快照预计</th>
          <th v-if="selectedSnapshot" class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">快照偏差</th>
          <!-- 公积金专区表头（仅 fund 启用） -->
          <template v-if="fund">
            <th data-tour="fund-columns" class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap border-l-2 border-brand-300">房贷月供</th>
            <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">公积金缴存</th>
            <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">公积金月冲</th>
            <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">存款补扣</th>
            <th class="px-0.5 py-0 text-right tabular-nums font-mono font-semibold whitespace-nowrap">公积金</th>
          </template>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="result in results"
          :key="result.month"
          :class="[
            result.month % 100 === 12 ? 'border-b-2 border-line' : 'border-b',
            { 'current-month': result.month === currentMonth },
          ]"
        >
          <td class="px-0.5 py-0 whitespace-nowrap">
            {{ formatMonth(result.month) }}<span
              v-if="result.month === currentMonth"
              class="now-badge"
              aria-label="本月"
            >今</span>
          </td>

          <!-- 动态现金流列单元格 -->
          <td
            v-for="column in columns"
            :key="`${result.month}-${column.id}`"
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap relative"
            :class="[
              getValueClass(getColumnValue(result, column.id).amount),
              { 'bg-brand-50': getColumnValue(result, column.id).isEdited },
              { 'opacity-40': !isColumnEnabled(column) }
            ]"
            @contextmenu.prevent="openContextMenu(column.id, result.month, $event)"
          >
            <!-- 明细模式：点击打开编辑器，悬停查看只读明细 -->
            <span
              v-if="isDetailColumn(column)"
              class="block w-full cursor-pointer"
              :aria-label="`编辑 ${formatMonth(result.month)} ${column.name}`"
              @click="openDetailEditor(column.id, result.month, $event)"
              @mouseenter="showDetailPopover(column.id, result.month, $event)"
              @mouseleave="hideDetailPopover"
            >{{ formatCurrency(getColumnValue(result, column.id).amount) }}<span
                v-if="column.yearlyMonths?.[result.month]"
                class="ml-0.5 text-brand-500"
                aria-hidden="true"
              >↻</span></span>

            <!-- 单值模式：维持原有内联编辑 -->
            <template v-else>
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
              >{{ formatCurrency(getColumnValue(result, column.id).amount) }}<span
                  v-if="column.yearlyMonths?.[result.month]"
                  class="ml-0.5 text-brand-500"
                  aria-hidden="true"
                >↻</span></span>
            </template>
          </td>

          <!-- 添加列占位 -->
          <td class="px-0.5 py-0"></td>

          <!-- 专项单元格 -->
          <td
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap cursor-pointer border-l border-line"
            :class="getValueClass(eventInfo(result.month).net)"
            :aria-label="`编辑 ${formatMonth(result.month)} 专项`"
            @click="openEventEditor(result.month, $event)"
            @mouseenter="showEventDetail(result.month, $event)"
            @mouseleave="hideEventDetail"
          >
            <template v-if="eventInfo(result.month).count > 0">
              {{ formatCurrency(eventInfo(result.month).net) }}
            </template>
          </td>

          <!-- 理财列 -->
          <td
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getValueClass(result.investReturn)"
          >
            <span
              class="block w-full"
              :aria-label="getFormulaAriaLabel(result, 'investReturn')"
              @mouseenter="showFormula(result, 'investReturn', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(result.investReturn) }}</span>
          </td>

          <!-- 本月收入列 -->
          <td class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap">
            <span
              class="block w-full"
              :aria-label="getFormulaAriaLabel(result, 'monthlyIncome')"
              @mouseenter="showFormula(result, 'monthlyIncome', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(result.monthlyIncome) }}</span>
          </td>

          <!-- 本月支出列 -->
          <td
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getValueClass(result.monthlyExpense)"
          >
            <span
              class="block w-full"
              :aria-label="getFormulaAriaLabel(result, 'monthlyExpense')"
              @mouseenter="showFormula(result, 'monthlyExpense', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(result.monthlyExpense) }}</span>
          </td>

          <!-- 本月结余列 -->
          <td
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getValueClass(result.monthlyBalance)"
          >
            <span
              class="block w-full"
              :aria-label="getFormulaAriaLabel(result, 'monthlyBalance')"
              @mouseenter="showFormula(result, 'monthlyBalance', $event)"
              @mouseleave="popover = null"
            >{{ formatCurrency(result.monthlyBalance) }}</span>
          </td>

          <!-- 累计列 -->
          <td
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap font-bold relative"
            :class="[
              getValueClass(result.cumSavings),
              { 'bg-brand-50': result.isCorrected }
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
          <!-- 对比列：快照预计（紧贴存款列） -->
          <td
            v-if="selectedSnapshot"
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap text-ink-2"
          >
            <span v-if="getComparison(result.month).predicted !== null">
              {{ formatCurrency(getComparison(result.month).predicted as number) }}
            </span>
            <span v-else class="text-ink-3">—</span>
          </td>
          <!-- 对比列：快照偏差 -->
          <td
            v-if="selectedSnapshot"
            class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap"
            :class="getDiffClass(getComparison(result.month).diff)"
          >
            <span v-if="getComparison(result.month).diff !== null">
              {{ formatCurrency(getComparison(result.month).diff as number) }}
            </span>
          </td>
          <!-- 公积金专区数据列（仅 fund 启用） -->
          <template v-if="fund">
            <!-- 房贷月供（可编辑；输入正数存负数，显示绝对值） -->
            <td
              class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap border-l-2 border-brand-300 relative"
              :data-fund-mortgage="result.month"
              :class="[
                getValueClass(-fundMortgageAbs(result.month)),
                { 'bg-brand-50': isFundEntryEdited('mortgage', result.month) },
              ]"
              @contextmenu.prevent="openContextMenu(FUND_MORTGAGE_COLUMN_ID, result.month, $event)"
            >
              <input
                v-if="editingFundCell?.field === 'mortgage' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('mortgage', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('mortgage', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('mortgage', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :data-fund-edit="fundEditKey('mortgage', result.month)"
                @click="startEditFundCell('mortgage', result.month)"
              >{{ formatCurrency(fundMortgageAbs(result.month)) }}</span>
            </td>
            <!-- 公积金缴存（可编辑） -->
            <td
              class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap relative"
              :data-fund-contribution="result.month"
              :class="{ 'bg-brand-50': isFundEntryEdited('contribution', result.month) }"
              @contextmenu.prevent="openContextMenu(FUND_CONTRIBUTION_COLUMN_ID, result.month, $event)"
            >
              <input
                v-if="editingFundCell?.field === 'contribution' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('contribution', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('contribution', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('contribution', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :data-fund-edit="fundEditKey('contribution', result.month)"
                @click="startEditFundCell('contribution', result.month)"
              >{{ formatCurrency(fundContribution(result.month)) }}</span>
            </td>
            <!-- 公积金月冲（可编辑 + 联动视觉：auto 淡灰 / 手填蓝底 + hover 公式） -->
            <td
              class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap relative"
              :class="{
                'text-ink-3': fundOffsetDisplay(result.month).auto,
                'bg-brand-50': !fundOffsetDisplay(result.month).auto,
              }"
              :data-fund-offset-auto="fundOffsetDisplay(result.month).auto ? result.month : false"
              :data-fund-offset-edited="!fundOffsetDisplay(result.month).auto ? result.month : false"
            >
              <input
                v-if="editingFundCell?.field === 'monthlyOffset' && editingFundCell?.month === result.month"
                :data-fund-edit-input="fundEditKey('monthlyOffset', result.month)"
                :ref="setEditFundCellInput"
                type="text"
                inputmode="numeric"
                class="absolute inset-0 border rounded px-1 text-right text-[11px]"
                :value="editFundCellValue"
                @input="editFundCellValue = ($event.target as HTMLInputElement).value"
                @keyup.enter="confirmEditFundCell"
                @keyup.escape="cancelEditFundCell"
                @keydown.up.prevent="moveEditFundCell('monthlyOffset', result.month, -1)"
                @keydown.down.prevent="moveEditFundCell('monthlyOffset', result.month, 1)"
                @blur="handleEditFundCellBlur"
              />
              <span
                v-else
                class="block w-full cursor-pointer"
                :data-fund-edit="fundEditKey('monthlyOffset', result.month)"
                :aria-label="getFormulaAriaLabel(result, 'fundOffset')"
                @click="startEditFundCell('monthlyOffset', result.month)"
                @mouseenter="showFormula(result, 'fundOffset', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(result.fundOffset) }}</span>
            </td>
            <!-- 存款补扣：房贷月供 − 公积金实际月冲（≥0），由可支配存款承担；缺口>0 标告警色 -->
            <td
              class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap"
              :class="{ 'text-warning-600': result.fundOffsetShortfall > 0 }"
              :data-fund-shortfall="result.month"
            >
              <span
                class="block w-full"
                :aria-label="getFormulaAriaLabel(result, 'fundOffsetShortfall')"
                @mouseenter="showFormula(result, 'fundOffsetShortfall', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(result.fundOffsetShortfall) }}</span>
            </td>
            <!-- 公积金余额（左键开 FundFlowEditor / 右键修正菜单 / hover 余额公式） -->
            <td
              class="px-0.5 py-0 text-right tabular-nums whitespace-nowrap cursor-pointer"
              :class="{ 'bg-brand-50': result.isFundCorrected }"
              :data-fund-balance="result.month"
              @click="openFundFlowEditor(result.month, $event)"
              @contextmenu.prevent="openContextMenu(FUND_BALANCE_COLUMN_ID, result.month, $event)"
            >
              <span
                class="block w-full"
                :aria-label="getFormulaAriaLabel(result, 'fundBalance')"
                @mouseenter="showFormula(result, 'fundBalance', $event)"
                @mouseleave="popover = null"
              >{{ formatCurrency(result.fundBalance) }}</span>
            </td>
          </template>
        </tr>
      </tbody>
    </table>
    </div>
  </div>

  <FormulaPopover
    v-if="popover"
    :title="popover.title"
    :lines="popover.lines"
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

  <ItemEditor
    v-if="eventEditor"
    :title="`${formatMonth(eventEditor.month)} 专项`"
    :items="eventInfo(eventEditor.month).events.map(e => ({ name: e.name, amount: e.amount }))"
    :x="eventEditor.x"
    :y="eventEditor.y"
    @save="(items) => store.replaceMonthEvents(eventEditor!.month, items)"
    @close="closeEventEditor"
  />

  <EventDetailPopover
    v-if="eventPopover"
    :title="`${formatMonth(eventPopover.month)} 专项`"
    :items="eventInfo(eventPopover.month).events.map(e => ({ name: e.name, amount: e.amount }))"
    :net="eventInfo(eventPopover.month).net"
    :x="eventPopover.x"
    :y="eventPopover.y"
    @close="eventPopover = null"
  />

  <!-- 动态列明细编辑器：detail 模式点击单元格时打开 -->
  <ItemEditor
    v-if="detailEditor && detailEditorColumn"
    :title="`${formatMonth(detailEditor.month)} ${detailEditorColumn.name}`"
    :items="resolveColumnItems(detailEditorColumn, detailEditor.month)"
    :x="detailEditor.x"
    :y="detailEditor.y"
    @save="handleDetailEditorSave"
    @close="closeDetailEditor"
  />

  <!-- 动态列只读明细弹窗：detail 模式悬停单元格时展示 -->
  <EventDetailPopover
    v-if="detailPopover && detailPopoverColumn && detailPopoverResult"
    :title="`${formatMonth(detailPopover.month)} ${detailPopoverColumn.name}`"
    :items="resolveColumnItems(detailPopoverColumn, detailPopover.month)"
    :net="getColumnValue(detailPopoverResult, detailPopover.columnId).amount"
    :x="detailPopover.x"
    :y="detailPopover.y"
    @close="detailPopover = null"
  />

  <FundFlowEditor
    v-if="fundFlowEditor"
    :month="fundFlowEditor.month"
    :result="fundFlowEditorResult"
    :prev-fund-balance="fundPrevBalance(fundFlowEditor.month)"
    :withdrawals="fundWithdrawalsByMonth(fundFlowEditor.month)"
    :actual-balance="fundActualBalance(fundFlowEditor.month)"
    :x="fundFlowEditor.x"
    :y="fundFlowEditor.y"
    @close="closeFundFlowEditor"
  />
</template>

<style scoped>
/* 拖拽插入线：用 box-shadow 不占布局空间，避免列宽跳动；主色 indigo-600 */
.drag-line-left {
  box-shadow: -2px 0 0 0 #4f46e5;
}
.drag-line-right {
  box-shadow: 2px 0 0 0 #4f46e5;
}
/* 隔行斑马纹：偶数行极淡灰（slate-500 4%） */
tbody tr:nth-child(even) {
  background-color: rgb(100 116 139 / 0.04);
}
/* 行 hover：统一中性 surface-2（与 hover:bg-surface-2 一致），特异性高于斑马纹故能覆盖 */
tbody tr:hover {
  background-color: #f8fafc;
}
/* hover 行内单元格同步变 surface-2，覆盖已编辑/修正的高亮 */
tbody tr:hover td {
  background-color: #f8fafc;
}
/* 当前月（本月）行：上下淡靛蓝细线，形成克制的时间分界标记 */
tbody tr.current-month td {
  border-top: 1px solid #c7d2fe;    /* brand-200 */
  border-bottom: 1px solid #c7d2fe; /* brand-200 */
}
/* 「今」徽标：主色圆角底 + 白字，挂在当前月月份文字后 */
.now-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: #4f46e5;   /* brand-600 */
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
  vertical-align: middle;
}
/* 空列引导气泡：加号下方常驻 + 呼吸光，新增首列后随 v-if 消失 */
.empty-col-hint {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
  z-index: 30;
  padding: 6px 22px 6px 10px;  /* 右侧留位给关闭按钮 */
  border-radius: 8px;
  background: rgb(79 70 229 / 0.8);  /* brand-600 加透明，更柔和 */
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.45;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;  /* 不挡下方单元格点击 */
  box-shadow: 0 4px 16px -2px rgb(79 70 229 / 0.5);  /* 柔和光晕，随 opacity 一起呼吸 */
  animation: empty-col-hint-breath 2.2s ease-in-out infinite;
}
/* 关闭按钮：气泡整体 pointer-events:none，按钮上单独放开点击 */
.empty-col-hint-close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgb(255 255 255 / 0.75);
  font-size: 13px;
  cursor: pointer;
  pointer-events: auto;
}
.empty-col-hint-close:hover {
  background: rgb(255 255 255 / 0.22);
  color: #fff;
}
/* 气泡上方小三角，指向加号 */
.empty-col-hint::before {
  content: '';
  position: absolute;
  top: -3px;
  left: 50%;
  width: 8px;
  height: 8px;
  background: rgb(79 70 229 / 0.8);  /* 与气泡同色 */
  transform: translateX(-50%) rotate(45deg);
}
/* 呼吸：整体透明度渐变（含光晕与小三角），不做大小变化 */
@keyframes empty-col-hint-breath {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}
/* 专项列表头 i 图标与简约说明 tooltip（hover 显示） */
.info-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
}
.info-icon {
  color: #8a93a6;            /* ink-3，次要灰，不抢眼 */
  transition: color 0.15s ease;
}
.info-trigger:hover .info-icon {
  color: #4f46e5;            /* brand-600，hover 转主色 */
}
.info-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;                  /* 右对齐图标，向左展开，避免溢出表格右边界 */
  z-index: 40;
  min-width: 10rem;
  max-width: 16rem;
  padding: 6px 8px;
  border: 1px solid #e4e8f1; /* line */
  border-radius: 6px;
  background: #ffffff;       /* surface */
  color: #5b6678;            /* ink-2 */
  font-size: 11px;
  font-weight: 400;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  box-shadow: 0 4px 14px -4px rgba(26, 34, 51, 0.18);
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;      /* 不挡下方单元格，且避免移入时闪烁 */
}
.info-trigger:hover .info-tooltip {
  opacity: 1;
  transform: translateY(0);
}
</style>
