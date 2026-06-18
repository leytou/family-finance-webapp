<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { formatMonthZh } from '../utils/month'
import { computePopoverX } from '../utils/popover'

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
    // 面板左边对齐触发按钮（rect.left），传 margin:0 保持原对齐；
    // 仅在右侧放不下时整体左移。面板约 3 列月份网格，估宽 224
    panelStyle.value = {
      left: `${computePopoverX(rect.left, { expectedWidth: 224, margin: 0 })}px`,
      top: `${rect.bottom}px`,
    }
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
    <!-- 触发按钮：统一为输入框风格 -->
    <button
      :id="inputId"
      ref="triggerRef"
      type="button"
      class="w-28 rounded-lg border border-line bg-surface px-2 py-0.5 text-left text-[11px] text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ formatMonthZh(model) }} ▾
    </button>

    <!-- 面板：统一浮窗外壳规范（定位逻辑不动） -->
    <div
      v-if="open"
      ref="panelRef"
      role="dialog"
      aria-label="选择起始月份"
      tabindex="-1"
      class="fixed z-50 rounded-xl border border-line bg-surface p-3 text-sm text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
      :style="panelStyle"
      @keyup.escape="open = false"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <button type="button" aria-label="上一年" class="px-2 text-ink-2 hover:bg-surface-2 rounded" @click="stepYear(-1)">◀</button>
        <button
          v-if="!yearEditing"
          type="button"
          data-testid="panel-year"
          class="min-w-16 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2"
          @click="startEditYear"
        >
          {{ panelYear }}年
        </button>
        <input
          v-else
          v-model="yearInput"
          type="number"
          data-testid="panel-year-input"
          class="w-16 rounded-lg border border-line bg-surface text-center text-ink focus:border-brand focus:ring-2 focus:ring-brand/30"
          @blur="commitYearInput"
          @keydown.enter.prevent="commitYearInput"
        />
        <button type="button" aria-label="下一年" class="px-2 text-ink-2 hover:bg-surface-2 rounded" @click="stepYear(1)">▶</button>
      </div>

      <div class="grid grid-cols-3 gap-1">
        <button
          v-for="m in months"
          :key="m"
          type="button"
          data-testid="month-cell"
          class="rounded-lg px-2 py-1 text-ink-2 hover:bg-surface-2"
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
