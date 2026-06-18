<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { useStore } from '../composables/useStore'
import { formatMonth } from '../utils/month'
import type { MilestoneEvent } from '../types'

const props = defineProps<{
  month: number
  events: MilestoneEvent[]
  x: number
  y: number
}>()

const emit = defineEmits<{ close: [] }>()

const store = useStore()

// 草稿行：金额用字符串以便输入框编辑
interface DraftRow { key: string; name: string; amount: string }

// 草稿行稳定 key 计数器（仅本组件实例用，保证 v-for 不用数组索引）
let draftKeySeq = 0
function nextDraftKey(): string {
  draftKeySeq += 1
  return `draft-${draftKeySeq}`
}

const rows = ref<DraftRow[]>(
  props.events.map((e) => ({ key: nextDraftKey(), name: e.name, amount: String(e.amount) })),
)

// 是否相对初始值有改动；未改动则关闭时不写回（避免 no-op 写入与事件 id 重建）
const dirty = ref(false)
function markDirty() { dirty.value = true }

const rootRef = ref<HTMLElement | null>(null)

function addRow() {
  rows.value.push({ key: nextDraftKey(), name: '', amount: '' })
  markDirty()
}

function removeRow(idx: number) {
  rows.value.splice(idx, 1)
  markDirty()
}

function commit() {
  if (dirty.value) {
    const items = rows.value
      .map((r) => ({ name: r.name.trim(), amount: Number(r.amount) }))
      .filter((r) => r.name !== '' && Number.isFinite(r.amount))
      .map((r) => ({ name: r.name, amount: Math.round(r.amount) }))
    store.replaceMonthEvents(props.month, items)
  }
  emit('close')
}

// 点击外部、Esc 均走 commit
useClickOutside(rootRef, commit)

// 挂载后聚焦弹层容器，使其能接收 Esc 键盘事件（与 ContextMenu 一致）
onMounted(() => {
  rootRef.value?.focus()
})
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
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ formatMonth(month) }} 专项</div>

    <div v-if="rows.length === 0" class="mb-2 text-ink-3">暂无事件，点下方「添加」</div>

    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1.5 flex items-center gap-1.5">
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
        aria-label="删除该事件"
        @click="removeRow(idx)"
      >×</button>
    </div>

    <!-- 添加按钮保留 brand 语义色 -->
    <button
      type="button"
      class="mt-1 text-brand-600 hover:text-brand-700"
      aria-label="添加事件"
      @click="addRow"
    >+ 添加</button>

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
