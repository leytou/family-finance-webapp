import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { MonthResult } from '../../src/types'

// jsdom 无 ResizeObserver，提供空实现
class MockResizeObserver { observe() {} unobserve() {} disconnect() {} }
;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
  ECharts: class {},
}))
vi.mock('echarts/charts', () => ({ BarChart: {}, LineChart: {} }))
vi.mock('echarts/components', () => ({ GridComponent: {}, TooltipComponent: {}, LegendComponent: {} }))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

import FinanceChart from '../../src/components/FinanceChart.vue'
import * as echartsCore from 'echarts/core'

// 获取 mock 函数引用
const mockInit = echartsCore.init as ReturnType<typeof vi.fn>

function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    cumSavings: 0,
    isAnchor: false,
    ...overrides,
  }
}

function sampleResults(): MonthResult[] {
  return [
    makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000 }),
    makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000 }),
  ]
}

describe('FinanceChart', () => {
  beforeEach(() => {
    mockInit.mockClear()
  })

  it('挂载后初始化图表并传入三系列 option', async () => {
    const wrapper = mount(FinanceChart, { props: { results: sampleResults() } })
    await nextTick()

    expect(mockInit).toHaveBeenCalledTimes(1)
    const mockInstance = mockInit.mock.results[0].value as { setOption: ReturnType<typeof vi.fn> }
    expect(mockInstance.setOption).toHaveBeenCalledTimes(1)
    const option = mockInstance.setOption.mock.calls[0][0] as { series: { name: string }[] }
    expect(option.series.map(s => s.name)).toEqual(['存款', '收入', '支出'])
  })

  it('标题区高亮当前存款（与主线同名，万元格式）', async () => {
    const results = [
      makeResult({ month: 202601, cumSavings: 50000, totalAssets: 80000 }),
      makeResult({ month: 202602, cumSavings: 55000, totalAssets: 1234567 }),
    ]
    const wrapper = mount(FinanceChart, { props: { results } })
    await nextTick()

    // 取最末月 cumSavings（55000 → 5.5万），标签为「存款」与主线同名
    const title = wrapper.find('.text-base.font-bold.text-brand-600')
    expect(title.text()).toBe('¥ 5.5万')
    expect(wrapper.text()).toContain('存款')
    expect(wrapper.text()).not.toContain('总资产')
  })

  it('点击「按年」切换粒度并以年份为 x 轴刷新 option', async () => {
    const wrapper = mount(FinanceChart, { props: { results: sampleResults() } })
    await nextTick()
    const mockInstance = mockInit.mock.results[0].value as { setOption: ReturnType<typeof vi.fn> }
    mockInstance.setOption.mockClear()

    const yearBtn = wrapper.findAll('button').find(b => b.text() === '按年')!
    await yearBtn.trigger('click')
    await nextTick()

    expect(mockInstance.setOption).toHaveBeenCalledTimes(1)
    const option = mockInstance.setOption.mock.calls[0][0] as { xAxis: Array<{ data: string[] }> }
    expect(option.xAxis[1].data).toEqual(['2026'])
  })

  it('卸载时 dispose 图表实例', async () => {
    const wrapper = mount(FinanceChart, { props: { results: sampleResults() } })
    await nextTick()

    wrapper.unmount()
    await nextTick()

    const mockInstance = mockInit.mock.results[0].value as { dispose: ReturnType<typeof vi.fn> }
    expect(mockInstance.dispose).toHaveBeenCalledTimes(1)
  })
})
