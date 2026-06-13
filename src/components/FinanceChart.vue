<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import type { MonthResult } from '../types'
import { buildChartData, buildChartOption } from '../utils/financeChart'
import type { Granularity } from '../utils/financeChart'

// 按需 register：仅柱/折线 + 网格/提示/图例 + Canvas 渲染器
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ results: MonthResult[] }>()

const granularity = ref<Granularity>('month')
const el = ref<HTMLElement>()

let chart: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// 由纯函数产出当前数据；粒度或 results 变化即重算
const chartData = computed(() => buildChartData(props.results, granularity.value))

function render() {
  // option 字段遵循 ECharts 规范，用 as any 桥接第三方严格类型
  chart?.setOption(buildChartOption(chartData.value) as unknown as echarts.EChartsCoreOption)
}

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  render()
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(el.value)
})

watch(chartData, render)

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="h-full w-full flex flex-col p-4">
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-sm font-bold whitespace-nowrap">财务趋势图</h2>
      <div class="flex border rounded overflow-hidden text-xs">
        <button
          type="button"
          class="px-3 py-1"
          :class="granularity === 'month' ? 'bg-brand-50' : 'hover:bg-neutral-50'"
          @click="granularity = 'month'"
        >
          按月
        </button>
        <button
          type="button"
          class="px-3 py-1 border-l"
          :class="granularity === 'year' ? 'bg-brand-50' : 'hover:bg-neutral-50'"
          @click="granularity = 'year'"
        >
          按年
        </button>
      </div>
    </div>
    <!-- echarts 挂载点：撑满剩余空间，min-h-0 保证 flex 子项可收缩 -->
    <div ref="el" class="flex-1 min-h-0 w-full" />
  </div>
</template>
