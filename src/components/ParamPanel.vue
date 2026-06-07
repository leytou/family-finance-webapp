<script setup lang="ts">
import { useStore } from '../composables/useStore'
import type { CashFlowItem } from '../types'
import CashFlowItemEditor from './CashFlowItemEditor.vue'

const { data, addItem, removeItem } = useStore()

function updateItem(updated: CashFlowItem) {
  const index = data.value.items.findIndex(item => item.id === updated.id)

  if (index === -1) {
    return
  }

  data.value.items[index] = updated
}

</script>

<template>
  <div class="space-y-3">
    <section>
      <h2 class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">系统参数</h2>
      <div class="space-y-1">
        <label class="block text-xs">
          当前储蓄
          <input
            v-model.number="data.systemParams.currentSavings"
            type="number"
            class="block w-full mt-1 h-7 px-2 border rounded text-xs"
          />
        </label>
        <label class="block text-xs">
          起始月份 (YYYYMM)
          <input
            v-model.number="data.systemParams.startMonth"
            type="number"
            class="block w-full mt-1 h-7 px-2 border rounded text-xs"
          />
        </label>
        <label class="block text-xs">
          年化收益率
          <input
            v-model.number="data.systemParams.annualRate"
            type="number"
            step="0.001"
            class="block w-full mt-1 h-7 px-2 border rounded text-xs"
          />
        </label>
      </div>
    </section>

    <section>
      <h2 class="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">现金流项目</h2>
      <div class="space-y-1">
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
          class="flex-1 h-7 px-2 border rounded text-xs"
          aria-label="添加收入项目"
          @click="addItem('新收入', 'income')"
        >
          + 收入
        </button>
        <button
          type="button"
          class="flex-1 h-7 px-2 border rounded text-xs"
          aria-label="添加支出项目"
          @click="addItem('新支出', 'expense')"
        >
          + 支出
        </button>
      </div>
    </section>
  </div>
</template>
