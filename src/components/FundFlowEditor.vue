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
  emit('close')
}

useClickOutside(rootRef, commit)
onMounted(() => { rootRef.value?.focus() })
</script>

<template>
  <div
    ref="rootRef"
    class="fixed z-50 min-w-64 border rounded bg-white p-2 text-[12px] shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="commit"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(month) }} 公积金</div>

    <!-- 流水：期初 / 缴存 / 提取（可编辑）/ 月冲 / 结息 / 期末 -->
    <div class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">期初余额</span>
      <span class="tabular-nums">{{ formatCurrency(prevFundBalance) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">+ 缴存</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundContribution) }}</span>
    </div>

    <div class="mt-1 text-neutral-500">- 提取</div>
    <div v-if="rows.length === 0" class="mb-1 text-neutral-400">暂无提取，点下方「添加」</div>
    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1 flex items-center gap-1 pl-2">
      <input
        v-model="row.name"
        type="text"
        class="flex-1 border rounded px-1 text-[12px]"
        placeholder="名称"
        @input="markDirty"
      />
      <input
        v-model="row.amount"
        type="text"
        inputmode="numeric"
        class="w-24 border rounded px-1 text-right text-[12px]"
        placeholder="金额"
        @input="markDirty"
      />
      <button
        type="button"
        class="text-danger-600 hover:text-danger-800"
        aria-label="删除该提取"
        @click="removeRow(idx)"
      >×</button>
    </div>
    <button
      type="button"
      class="text-brand-600 hover:text-brand-700"
      aria-label="添加提取"
      @click="addRow"
    >+ 添加</button>

    <!-- 截断提示：请求总额 ≠ 实际 fundWithdrawal -->
    <div
      v-if="requestedTotal() !== result.fundWithdrawal"
      class="mt-1 text-[11px] text-amber-600"
    >已截断：请求 {{ formatCurrency(requestedTotal()) }}，实际提取 {{ formatCurrency(result.fundWithdrawal) }}</div>

    <div class="mt-1 flex items-center justify-between gap-4">
      <span class="text-neutral-500">- 月冲</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundOffset) }}</span>
    </div>
    <div v-if="result.fundInterest !== 0" class="flex items-center justify-between gap-4">
      <span class="text-neutral-500">+ 结息</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundInterest) }}</span>
    </div>

    <div class="mt-1 flex items-center justify-between gap-4 border-t pt-1 font-semibold">
      <span>= 期末余额</span>
      <span class="tabular-nums">{{ formatCurrency(result.fundBalance) }}</span>
    </div>

    <div class="mt-2 flex justify-end">
      <button
        type="button"
        class="border rounded px-2 py-0.5 hover:bg-neutral-50"
        aria-label="完成"
        @click="commit"
      >完成</button>
    </div>
  </div>
</template>
