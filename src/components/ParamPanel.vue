<script setup lang="ts">
import { useStore } from '../composables/useStore'

const { data, save } = useStore()
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
  </div>
</template>
