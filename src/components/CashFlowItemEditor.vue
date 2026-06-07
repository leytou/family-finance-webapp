<script setup lang="ts">
import { ref } from 'vue'

import TimeGrid from './TimeGrid.vue'
import type { AmountSegment, CashFlowItem } from '../types'

const props = defineProps<{
  item: CashFlowItem
  startMonth: number
}>()

const emit = defineEmits<{
  update: [item: CashFlowItem]
  remove: [id: string]
}>()

const expanded = ref(false)

function updateName(name: string) {
  emit('update', { ...props.item, name })
}

function toggleType() {
  emit('update', {
    ...props.item,
    type: props.item.type === 'income' ? 'expense' : 'income',
  })
}

function addSegment() {
  emit('update', {
    ...props.item,
    segments: [
      ...props.item.segments,
      { amount: 0, startMonth: 202601, endMonth: 203012 },
    ],
  })
}

function updateSegment(index: number, field: keyof AmountSegment, value: number) {
  emit('update', {
    ...props.item,
    segments: props.item.segments.map((segment, segmentIndex) =>
      segmentIndex === index ? { ...segment, [field]: value } : segment,
    ),
  })
}

function updateSegmentRange(index: number, startMonth: number, endMonth: number) {
  emit('update', {
    ...props.item,
    segments: props.item.segments.map((segment, segmentIndex) =>
      segmentIndex === index ? { ...segment, startMonth, endMonth } : segment,
    ),
  })
}

function removeSegment(index: number) {
  emit('update', {
    ...props.item,
    segments: props.item.segments.filter((_, segmentIndex) => segmentIndex !== index),
  })
}
</script>

<template>
  <div class="border rounded p-2 space-y-2">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="w-7 h-7 border rounded text-sm"
        aria-label="展开金额段"
        @click="expanded = !expanded"
      >
        {{ expanded ? '-' : '+' }}
      </button>
      <input
        :value="item.name"
        type="text"
        aria-label="项目名称"
        class="min-w-0 flex-1 px-2 py-1 border rounded text-sm"
        @input="updateName(($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="w-9 px-2 py-1 rounded text-xs text-white"
        :class="item.type === 'income' ? 'bg-green-600' : 'bg-red-600'"
        aria-label="切换收支类型"
        @click="toggleType"
      >
        {{ item.type === 'income' ? '收' : '支' }}
      </button>
      <button
        type="button"
        class="px-2 py-1 border rounded text-xs text-red-600"
        aria-label="删除现金流项目"
        @click="emit('remove', item.id)"
      >
        删除
      </button>
    </div>

    <div v-if="expanded" class="space-y-2 pl-9">
      <div
        v-for="(segment, index) in item.segments"
        :key="index"
        class="grid grid-cols-[1fr_auto] gap-2 items-end"
      >
        <label class="block text-xs">
          金额
          <input
            :value="segment.amount"
            type="number"
            aria-label="金额"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            @input="updateSegment(index, 'amount', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <button
          type="button"
          class="px-2 py-1 border rounded text-xs text-red-600"
          aria-label="删除金额段"
          @click="removeSegment(index)"
        >
          删除
        </button>
        <TimeGrid
          class="col-span-2"
          :start-month="props.startMonth"
          :selected-start="segment.startMonth"
          :selected-end="segment.endMonth"
          @select="({ startMonth: s, endMonth: e }) => {
            updateSegmentRange(index, s, e)
          }"
        />
      </div>

      <button
        type="button"
        class="w-full px-2 py-1 border rounded text-xs"
        aria-label="添加金额段"
        @click="addSegment"
      >
        + 添加金额段
      </button>
    </div>
  </div>
</template>
