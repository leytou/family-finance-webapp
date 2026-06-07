<script setup lang="ts">
import { computed, ref } from 'vue'

import { addMonths, formatMonth } from '../utils/month'

const props = defineProps<{
  startMonth: number
  selectedStart: number | null
  selectedEnd: number | null
}>()

const emit = defineEmits<{
  select: [range: { startMonth: number; endMonth: number }]
}>()

const months = computed(() =>
  Array.from({ length: 60 }, (_, index) => addMonths(props.startMonth, index)),
)

const dragging = ref(false)
const dragStart = ref<number | null>(null)
const dragEnd = ref<number | null>(null)

function isBetween(month: number, start: number, end: number) {
  const rangeStart = Math.min(start, end)
  const rangeEnd = Math.max(start, end)

  return month >= rangeStart && month <= rangeEnd
}

function isSelected(month: number) {
  if (props.selectedStart === null || props.selectedEnd === null) {
    return false
  }

  return isBetween(month, props.selectedStart, props.selectedEnd)
}

function isDragSelected(month: number) {
  if (!dragging.value || dragStart.value === null || dragEnd.value === null) {
    return false
  }

  return isBetween(month, dragStart.value, dragEnd.value)
}

function onMouseDown(month: number) {
  dragging.value = true
  dragStart.value = month
  dragEnd.value = month
}

function onMouseMove(month: number) {
  if (!dragging.value) {
    return
  }

  dragEnd.value = month
}

function onMouseUp() {
  if (!dragging.value || dragStart.value === null || dragEnd.value === null) {
    return
  }

  emit('select', {
    startMonth: Math.min(dragStart.value, dragEnd.value),
    endMonth: Math.max(dragStart.value, dragEnd.value),
  })

  dragging.value = false
  dragStart.value = null
  dragEnd.value = null
}
</script>

<template>
  <div class="grid grid-cols-12 gap-1 select-none" @mouseleave="onMouseUp">
    <button
      v-for="month in months"
      :key="month"
      type="button"
      data-testid="grid-cell"
      class="h-7 rounded border text-[10px]"
      :class="{
        selected: isSelected(month) || isDragSelected(month),
        'border-blue-600 bg-blue-600 text-white': isSelected(month) || isDragSelected(month),
        'border-gray-200 hover:bg-blue-50': !isSelected(month) && !isDragSelected(month),
      }"
      @mousedown="onMouseDown(month)"
      @mousemove="onMouseMove(month)"
      @mouseup="onMouseUp"
    >
      {{ formatMonth(month) }}
    </button>
  </div>
</template>
