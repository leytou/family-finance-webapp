<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'

const props = defineProps<{
  title: string
  items: { name: string; amount: number }[]
  x: number
  y: number
}>()

const emit = defineEmits<{
  save: [items: { name: string; amount: number }[]]
  close: []
}>()

// 草稿行：金额用字符串以便输入框编辑
interface DraftRow { key: string; name: string; amount: string }

// 草稿行稳定 key 计数器（仅本组件实例用，保证 v-for 不用数组索引）
let draftKeySeq = 0
function nextDraftKey(): string {
  draftKeySeq += 1
  return `draft-${draftKeySeq}`
}

// 打开时默认至少 3 行：已有项保留，不足补空行（补空不触发 dirty）
const INITIAL_ROWS = 3
const rows = ref<DraftRow[]>(
  (() => {
    const filled = props.items.map(e => ({ key: nextDraftKey(), name: e.name, amount: String(e.amount) }))
    while (filled.length < INITIAL_ROWS) filled.push({ key: nextDraftKey(), name: '', amount: '' })
    return filled
  })(),
)

// 是否相对初始值有改动；未改动则关闭时不 emit save（避免 no-op 写入与上层 id 重建）
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
      .map(r => ({ name: r.name.trim(), amount: Number(r.amount) }))
      .filter(r => r.name !== '' && Number.isFinite(r.amount))
      .map(r => ({ name: r.name, amount: Math.round(r.amount) }))
    emit('save', items)
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
    <!-- 统一浮层标题样式（等宽小号大写），标题由父组件传入 -->
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ title }}</div>

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
        aria-label="删除该行"
        @click="removeRow(idx)"
      >×</button>
    </div>

    <!-- 添加按钮保留 brand 语义色 -->
    <button
      type="button"
      class="mt-1 text-brand-600 hover:text-brand-700"
      aria-label="添加行"
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
