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
    class="fixed z-50 min-w-64 border rounded bg-white p-2 text-[12px] shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="commit"
  >
    <div class="mb-2 font-semibold">{{ formatMonth(month) }} 专项</div>

    <div v-if="rows.length === 0" class="mb-2 text-gray-400">暂无事件，点下方「添加」</div>

    <div v-for="(row, idx) in rows" :key="row.key" class="mb-1 flex items-center gap-1">
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
        class="text-red-600 hover:text-red-800"
        aria-label="删除该事件"
        @click="removeRow(idx)"
      >×</button>
    </div>

    <button
      type="button"
      class="mt-1 text-blue-600 hover:text-blue-800"
      aria-label="添加事件"
      @click="addRow"
    >+ 添加</button>

    <div class="mt-2 flex justify-end">
      <button
        type="button"
        class="border rounded px-2 py-0.5 hover:bg-gray-50"
        aria-label="完成"
        @click="commit"
      >完成</button>
    </div>
  </div>
</template>
