<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { computeScenarioMetrics, type ScenarioMetrics } from '../composables/useComparison'
import { formatCurrency } from '../utils/format'

const emit = defineEmits<{
  close: []
}>()

const store = useStore()
const scenarios = computed(() => store.workspace.value.scenarios)

// 选中的方案 ID 列表
const selectedIds = ref<string[]>(scenarios.value.map(s => s.id))

// 计算选中方案的指标
const metricsList = computed<ScenarioMetrics[]>(() => {
  return selectedIds.value
    .map(id => {
      const scenario = scenarios.value.find(s => s.id === id)
      if (!scenario) return null
      return computeScenarioMetrics(id, scenario.name, scenario.plan)
    })
    .filter((m): m is ScenarioMetrics => m !== null)
})

// 基准指标（第一个选中的方案）
const baseline = computed<ScenarioMetrics | null>(() => {
  return metricsList.value.length > 0 ? metricsList.value[0] : null
})

// 是否可以显示对比表
const canCompare = computed(() => metricsList.value.length >= 2)

// 格式化差额
function formatDiff(value: number, baselineValue: number): { text: string; class: string } {
  const diff = value - baselineValue
  if (Math.abs(diff) < 0.5) return { text: '', class: '' }
  const prefix = diff > 0 ? '+' : ''
  return {
    text: `(${prefix}${formatCurrency(diff)})`,
    class: diff > 0 ? 'text-green-600' : 'text-red-600',
  }
}

// 对比表行定义
interface ComparisonRow {
  label: string
  getValues: (m: ScenarioMetrics) => number[]
}

const comparisonRows: ComparisonRow[] = [
  { label: '第1年末', getValues: m => [m.yearEndSavings[0]] },
  { label: '第2年末', getValues: m => [m.yearEndSavings[1]] },
  { label: '第3年末', getValues: m => [m.yearEndSavings[2]] },
  { label: '第4年末', getValues: m => [m.yearEndSavings[3]] },
  { label: '第5年末', getValues: m => [m.yearEndSavings[4]] },
  { label: '5年总收入', getValues: m => [m.totalIncome] },
  { label: '5年总支出', getValues: m => [m.totalExpense] },
  { label: '5年净储蓄', getValues: m => [m.netSavings] },
  { label: '最终累计储蓄', getValues: m => [m.finalCumSavings] },
  { label: '期间最低储蓄', getValues: m => [m.minCumSavings] },
]
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold">方案对比</h2>
      <button
        type="button"
        data-test="close-comparison"
        class="px-3 py-1 border rounded text-sm hover:bg-gray-50"
        @click="emit('close')"
      >
        关闭
      </button>
    </div>

    <!-- 方案选择 -->
    <div class="flex gap-4 mb-4">
      <label
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="flex items-center gap-1 text-sm"
      >
        <input
          v-model="selectedIds"
          type="checkbox"
          :value="scenario.id"
        />
        {{ scenario.name || '未命名' }}
      </label>
    </div>

    <!-- 对比表 -->
    <table v-if="canCompare" class="min-w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="px-3 py-2 text-left border bg-gray-50 font-semibold">指标</th>
          <th
            v-for="metrics in metricsList"
            :key="metrics.scenarioId"
            class="px-3 py-2 text-right border bg-gray-50 font-semibold"
          >
            {{ metrics.scenarioName || '未命名' }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in comparisonRows"
          :key="row.label"
          class="hover:bg-gray-50"
        >
          <td class="px-3 py-2 border whitespace-nowrap">{{ row.label }}</td>
          <td
            v-for="(metrics, idx) in metricsList"
            :key="metrics.scenarioId"
            class="px-3 py-2 text-right border tabular-nums whitespace-nowrap"
          >
            <span>{{ formatCurrency(row.getValues(metrics)[0]) }}</span>
            <span
              v-if="idx > 0 && baseline"
              class="ml-1 text-xs"
              :class="formatDiff(row.getValues(metrics)[0], row.getValues(baseline)[0]).class"
            >
              {{ formatDiff(row.getValues(metrics)[0], row.getValues(baseline)[0]).text }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else class="text-gray-500 text-sm">
      请至少选择 2 个方案进行对比
    </p>
  </div>
</template>
