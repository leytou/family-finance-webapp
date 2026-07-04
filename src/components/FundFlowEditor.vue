<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { useStore } from '../composables/useStore'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'
import type { MonthResult, FundWithdrawal } from '../types'

const props = defineProps<{
  month: number
  result: MonthResult            // 该月 MonthResult（取 fundContribution/fundOffset/fundInterest/fundBalance/fundWithdrawal）
  prevFundBalance: number        // 期初余额（上月末 fundBalance；首月取 fundInitialBalance）
  withdrawals: FundWithdrawal[]  // 该月提取（初始化草稿）
  x: number
  y: number
  actualBalance?: number         // 该月已修正的实际余额（公积金余额修正）；undefined=未修正
}>()

const emit = defineEmits<{ close: [] }>()
const store = useStore()

interface DraftRow { key: string; name: string; amount: string }
let draftKeySeq = 0
function nextDraftKey(): string { draftKeySeq += 1; return `fund-draft-${draftKeySeq}` }

const rows = ref<DraftRow[]>(
  props.withdrawals.map(w => ({ key: nextDraftKey(), name: w.name, amount: String(w.amount) })),
)
const dirty = ref(false)
// 实际余额修正草稿：打开时取已存实际余额，未修正则空（0 视为有效值保留）
const draftCorrection = ref<string>(props.actualBalance != null ? String(props.actualBalance) : '')
function markDirty() { dirty.value = true }
const rootRef = ref<HTMLElement | null>(null)

// 提取请求总额（编辑行展示）
const requestedTotal = () => rows.value.reduce((s, r) => s + (Number(r.amount) || 0), 0)

function addRow() { rows.value.push({ key: nextDraftKey(), name: '', amount: '' }); markDirty() }
function removeRow(idx: number) { rows.value.splice(idx, 1); markDirty() }

function commit() {
  if (dirty.value) {
    const items = rows.value
      .map(r => ({ name: r.name.trim(), amount: Number(r.amount) }))
      .filter(r => r.name !== '' && Number.isFinite(r.amount))
      .map(r => ({ name: r.name, amount: Math.round(r.amount) }))
    store.replaceMonthWithdrawals(props.month, items)
  }
  // 实际余额修正：留空=移除修正；非空且变化=写入；值未变化不写
  const trimmed = draftCorrection.value.trim()
  if (trimmed === '') {
    store.removeFundCorrection(props.month)
  } else {
    const num = Math.round(Number(trimmed))
    if (Number.isFinite(num) && num !== props.actualBalance) {
      store.addFundCorrection(props.month, num)
    }
  }
  emit('close')
}

useClickOutside(rootRef, commit)
onMounted(() => { rootRef.value?.focus() })
</script>

<template>
  <div
    ref="rootRef"
    class="fixed z-50 min-w-64 rounded-xl border border-line bg-surface p-3 text-[12px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="commit"
  >
    <!-- 统一浮层标题样式（等宽小号大写） -->
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ formatMonth(month) }} 公积金</div>

    <!-- 流水：期初 / 缴存 / 提取（可编辑）/ 月冲 / 结息 / 期末 -->
    <div class="flex items-center justify-between gap-4">
      <span class="text-ink-3">期初余额</span>
      <span class="tabular-nums">{{ formatCurrency(prevFundBalance) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4">
      <span class="text-ink-3">+ 缴存</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundContribution) }}</span>
    </div>

    <div class="mt-1 text-ink-3">- 提取</div>
    <div v-if="rows.length === 0" class="mb-1 text-ink-3">暂无提取，点下方「添加」</div>
    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1.5 flex items-center gap-1.5 pl-2">
      <input
        v-model="row.name"
        type="text"
        class="flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-[12px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
        placeholder="名称"
        @input="markDirty"
      />
      <input
        v-model="row.amount"
        type="text"
        inputmode="numeric"
        class="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-right text-[12px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
        placeholder="金额"
        @input="markDirty"
      />
      <!-- 删除按钮保留 danger 语义色 -->
      <button
        type="button"
        class="text-danger-600 hover:text-danger-800"
        aria-label="删除该提取"
        @click="removeRow(idx)"
      >×</button>
    </div>
    <!-- 添加按钮保留 brand 语义色 -->
    <button
      type="button"
      class="text-brand-600 hover:text-brand-700"
      aria-label="添加提取"
      @click="addRow"
    >+ 添加</button>

    <!-- 截断提示：请求总额 ≠ 实际 fundWithdrawal（保留 warning 语义色） -->
    <div
      v-if="requestedTotal() !== result.fundWithdrawal"
      class="mt-1 text-[11px] text-warning-600"
    >已截断：请求 {{ formatCurrency(requestedTotal()) }}，实际提取 {{ formatCurrency(result.fundWithdrawal) }}</div>

    <div class="mt-1 flex items-center justify-between gap-4">
      <span class="text-ink-3">- 月冲</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundOffset) }}</span>
    </div>
    <div v-if="result.fundInterest !== 0" class="flex items-center justify-between gap-4">
      <span class="text-ink-3">+ 结息</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundInterest) }}</span>
    </div>

    <div class="mt-1 flex items-center justify-between gap-4 border-t border-line-soft pt-1 font-semibold">
      <span>= 期末余额</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundBalance) }}</span>
    </div>

    <!-- 实际余额修正：留空=用上方流水余额，后续月份从此值继续累计 -->
    <div class="mt-1 flex items-center justify-between gap-4">
      <span class="text-ink-3">修正为实际余额</span>
      <input
        v-model="draftCorrection"
        type="text"
        inputmode="numeric"
        data-correction-input
        class="w-28 rounded-lg border border-line bg-surface px-2 py-1 text-right text-[12px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
        placeholder="留空=流水余额"
      />
    </div>

    <div class="mt-3 flex justify-end border-t border-line-soft pt-2">
      <button
        type="button"
        class="rounded-lg border border-line bg-surface px-2 py-0.5 text-ink hover:bg-surface-2"
        aria-label="完成"
        @click="commit"
      >完成</button>
    </div>
  </div>
</template>
