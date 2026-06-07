<script setup lang="ts">
import { ref } from 'vue'

import { useStore } from '../composables/useStore'
import type { CashFlowItem } from '../types'
import { formatCurrency } from '../utils/format'
import { formatMonth } from '../utils/month'
import CashFlowItemEditor from './CashFlowItemEditor.vue'

const { data, save, addItem, removeItem, addAnchor, removeAnchor } = useStore()

const newAnchorMonth = ref<number>(0)
const newAnchorValue = ref<number>(0)

function isValidAnchorMonth(month: number): boolean {
  if (!Number.isFinite(month) || !Number.isInteger(month)) {
    return false
  }

  const year = Math.floor(month / 100)
  const monthPart = month % 100

  return year >= 1000 && year <= 9999 && monthPart >= 1 && monthPart <= 12
}

function updateItem(updated: CashFlowItem) {
  const index = data.value.items.findIndex(item => item.id === updated.id)

  if (index === -1) {
    return
  }

  data.value.items[index] = updated
  save()
}

function doAddAnchor() {
  if (!isValidAnchorMonth(newAnchorMonth.value) || !Number.isFinite(newAnchorValue.value)) {
    return
  }

  addAnchor(newAnchorMonth.value, newAnchorValue.value)
  newAnchorMonth.value = 0
  newAnchorValue.value = 0
}
</script>

<template>
  <div class="space-y-4">
    <section>
      <h2 class="text-sm font-bold mb-2">系统参数</h2>
      <div class="space-y-2">
        <label class="block text-xs">
          当前储蓄
          <input
            v-model.number="data.systemParams.currentSavings"
            type="number"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            @change="save()"
          />
        </label>
        <label class="block text-xs">
          起始月份 (YYYYMM)
          <input
            v-model.number="data.systemParams.startMonth"
            type="number"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            @change="save()"
          />
        </label>
        <label class="block text-xs">
          年化收益率
          <input
            v-model.number="data.systemParams.annualRate"
            type="number"
            step="0.001"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            @change="save()"
          />
        </label>
      </div>
    </section>

    <section>
      <h2 class="text-sm font-bold mb-2">现金流项目</h2>
      <div class="space-y-2">
        <CashFlowItemEditor
          v-for="item in data.items"
          :key="item.id"
          :item="item"
          :start-month="data.systemParams.startMonth"
          @update="updateItem"
          @remove="removeItem"
        />
      </div>
      <div class="flex gap-2 mt-2">
        <button
          type="button"
          class="flex-1 px-2 py-1 border rounded text-sm"
          aria-label="添加收入项目"
          @click="addItem('新收入', 'income')"
        >
          + 收入
        </button>
        <button
          type="button"
          class="flex-1 px-2 py-1 border rounded text-sm"
          aria-label="添加支出项目"
          @click="addItem('新支出', 'expense')"
        >
          + 支出
        </button>
      </div>
    </section>

    <section>
      <h2 class="text-sm font-bold mb-2">月度锚点</h2>
      <div class="space-y-2">
        <div
          v-for="anchor in data.anchors"
          :key="anchor.month"
          class="flex items-center justify-between gap-2 text-xs"
        >
          <span>{{ formatMonth(anchor.month) }}</span>
          <span class="font-mono">{{ formatCurrency(anchor.actualSavings) }}</span>
          <button
            type="button"
            class="px-2 py-1 border rounded text-sm"
            :aria-label="`删除 ${formatMonth(anchor.month)} 锚点`"
            @click="removeAnchor(anchor.month)"
          >
            ×
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <label class="block text-xs">
          YYYYMM
          <input
            v-model.number="newAnchorMonth"
            type="number"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            aria-label="锚点月份"
          />
        </label>
        <label class="block text-xs">
          金额
          <input
            v-model.number="newAnchorValue"
            type="number"
            class="block w-full mt-1 px-2 py-1 border rounded text-sm"
            aria-label="锚点金额"
          />
        </label>
      </div>
      <button
        type="button"
        class="w-full mt-2 px-2 py-1 border rounded text-sm"
        aria-label="添加月度锚点"
        @click="doAddAnchor"
      >
        + 添加
      </button>
    </section>
  </div>
</template>
