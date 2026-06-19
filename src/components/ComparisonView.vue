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
    class: diff > 0 ? 'text-positive-600' : 'text-negative-600',
  }
}

// 对比表行定义：年末行按期限动态生成，汇总行固定
interface ComparisonRow {
  label: string
  getValues: (m: ScenarioMetrics) => number[]
}

// 期限年数：取首个方案指标（所有对比方案共享同一期限口径）
const projectionYears = computed(() => {
  if (metricsList.value.length === 0) return 0
  return metricsList.value[0].yearEndSavings.length
})

const comparisonRows = computed<ComparisonRow[]>(() => {
  const yearRows: ComparisonRow[] = Array.from({ length: projectionYears.value }, (_, i) => ({
    label: `第${i + 1}年末`,
    getValues: m => [m.yearEndSavings[i]],
  }))
  return [
    ...yearRows,
    { label: '全程总收入', getValues: m => [m.totalIncome] },
    { label: '全程总支出', getValues: m => [m.totalExpense] },
    { label: '全程结余', getValues: m => [m.netSavings] },
    { label: '期末存款', getValues: m => [m.finalCumSavings] },
    { label: '期间最低余额', getValues: m => [m.minCumSavings] },
  ]
})
</script>

<template>
  <div class="h-full overflow-auto p-6">
    <div class="flex items-center justify-between mb-4">
      <!-- 标题使用等宽字体，呼应「金融终端」风格 -->
      <h2 class="text-lg font-bold font-mono text-ink">方案对比</h2>
      <button
        type="button"
        data-test="close-comparison"
        class="px-3 py-1 border border-line rounded text-sm text-ink-2 hover:bg-surface-2"
        @click="emit('close')"
      >
        关闭
      </button>
    </div>

    <!-- 方案选择：选中态用语义色 pill 呈现，未选中保持终端中性风 -->
    <div class="flex gap-2 mb-4">
      <label
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="flex items-center gap-1 px-2 py-1 rounded-full text-sm cursor-pointer border transition-colors"
        :class="selectedIds.includes(scenario.id)
          ? 'bg-brand-50 text-brand-700 border-brand-200'
          : 'bg-surface text-ink-2 border-line-soft hover:bg-surface-2'"
      >
        <input
          v-model="selectedIds"
          type="checkbox"
          :value="scenario.id"
          class="accent-brand-500"
        />
        {{ scenario.name || '未命名' }}
      </label>
    </div>

    <!-- 对比表：表头/边框采用终端中性基底，数字用等宽字体 -->
    <table v-if="canCompare" class="min-w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="px-3 py-2 text-left border border-line bg-surface-2 font-semibold text-ink-2">指标</th>
          <th
            v-for="metrics in metricsList"
            :key="metrics.scenarioId"
            class="px-3 py-2 text-right border border-line bg-surface-2 font-semibold text-ink-2"
          >
            {{ metrics.scenarioName || '未命名' }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in comparisonRows"
          :key="row.label"
          class="hover:bg-surface-2"
        >
          <td class="px-3 py-2 border border-line whitespace-nowrap text-ink-2">{{ row.label }}</td>
          <td
            v-for="(metrics, idx) in metricsList"
            :key="metrics.scenarioId"
            class="px-3 py-2 text-right border border-line font-mono tabular-nums whitespace-nowrap text-ink"
          >
            <span>{{ formatCurrency(row.getValues(metrics)[0]) }}</span>
            <!-- 差额保留语义色（正绿/负红），不随终端改版变化 -->
            <span
              v-if="idx > 0 && baseline"
              class="ml-1 text-xs font-mono tabular-nums"
              :class="formatDiff(row.getValues(metrics)[0], row.getValues(baseline)[0]).class"
            >
              {{ formatDiff(row.getValues(metrics)[0], row.getValues(baseline)[0]).text }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else class="text-ink-3 text-sm">
      请至少选择 2 个方案进行对比
    </p>
  </div>
</template>
