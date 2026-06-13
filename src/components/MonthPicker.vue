<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { formatMonthZh } from '../utils/month'

defineProps<{ inputId?: string }>()
const model = defineModel<number>({ required: true })

// 外层容器 ref：点其外部（含触发器与面板之外）即关闭
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)

const open = ref(false)
// 面板当前展示年份：可独立翻看，选定前不写回 model
const panelYear = ref(Math.floor(model.value / 100))
const selectedYear = computed(() => Math.floor(model.value / 100))
const selectedMonth = computed(() => model.value % 100)

const panelStyle = ref<{ left: string; top: string }>({ left: '0px', top: '0px' })

function toggle() {
  open.value = !open.value
}

// 展开时：同步年份到已选年、按触发器位置定位、聚焦面板（使 Esc 生效）
watch(open, async (isOpen) => {
  if (!isOpen) return
  panelYear.value = selectedYear.value
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    panelStyle.value = { left: `${rect.left}px`, top: `${rect.bottom}px` }
  }
  await nextTick()
  panelRef.value?.focus()
})

function stepYear(delta: number) {
  panelYear.value = panelYear.value + delta
}

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

function isCurrentMonth(m: number): boolean {
  return panelYear.value === selectedYear.value && m === selectedMonth.value
}

function selectMonth(m: number) {
  model.value = panelYear.value * 100 + m
  open.value = false
}

// 年份键入：点中年份切入输入框，blur/Enter 提交；仅 1000–9999 整数接受，否则回退
const yearEditing = ref(false)
const yearInput = ref('')

function startEditYear() {
  yearInput.value = String(panelYear.value)
  yearEditing.value = true
}

function commitYearInput() {
  const y = Number(yearInput.value)
  if (Number.isInteger(y) && y >= 1000 && y <= 9999) {
    panelYear.value = y
  }
  yearEditing.value = false
}

useClickOutside(rootRef, () => {
  if (open.value) open.value = false
})
</script>

<template>
  <div ref="rootRef" class="relative inline-block">
    <button
      :id="inputId"
      ref="triggerRef"
      type="button"
      class="border rounded px-2 py-1 text-sm w-28 text-left"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ formatMonthZh(model) }} ▾
    </button>

    <div
      v-if="open"
      ref="panelRef"
      role="dialog"
      aria-label="选择起始月份"
      tabindex="-1"
      class="fixed z-50 border rounded bg-white p-2 text-sm shadow-lg"
      :style="panelStyle"
      @keyup.escape="open = false"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <button type="button" aria-label="上一年" class="px-2" @click="stepYear(-1)">◀</button>
        <button
          v-if="!yearEditing"
          type="button"
          data-testid="panel-year"
          class="min-w-16 font-semibold"
          @click="startEditYear"
        >
          {{ panelYear }}年
        </button>
        <input
          v-else
          v-model="yearInput"
          type="number"
          data-testid="panel-year-input"
          class="w-16 border rounded text-center"
          @blur="commitYearInput"
          @keydown.enter.prevent="commitYearInput"
        />
        <button type="button" aria-label="下一年" class="px-2" @click="stepYear(1)">▶</button>
      </div>

      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="m in months"
          :key="m"
          type="button"
          data-testid="month-cell"
          class="rounded px-2 py-1 hover:bg-neutral-100"
          :class="isCurrentMonth(m) ? 'bg-brand-50' : ''"
          :aria-current="isCurrentMonth(m) ? 'true' : undefined"
          :aria-label="`${panelYear}年${m}月`"
          @click="selectMonth(m)"
        >
          {{ m }}月
        </button>
      </div>
    </div>
  </div>
</template>
