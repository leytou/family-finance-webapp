import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EventEditor from '../../src/components/EventEditor.vue'
import { useStore as useSharedStore } from '../../src/composables/useStore'
import type { MilestoneEvent } from '../../src/types'

describe('EventEditor', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('预填传入的事件（名称与金额）', () => {
    const store = useSharedStore()
    store.reset()
    const events: MilestoneEvent[] = [
      { id: 'e1', name: '买房', month: 202601, amount: -2000000 },
    ]
    const wrapper = mount(EventEditor, {
      props: { month: 202601, events, x: 10, y: 10 },
    })
    const inputs = wrapper.findAll('input')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('买房')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('-2000000')
  })

  it('点「添加」按钮新增空行', async () => {
    const store = useSharedStore()
    store.reset()
    const wrapper = mount(EventEditor, {
      props: { month: 202601, events: [], x: 10, y: 10 },
    })
    expect(wrapper.findAll('[aria-label="删除该事件"]')).toHaveLength(0)
    await wrapper.find('[aria-label="添加事件"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该事件"]')).toHaveLength(1)
  })

  it('点「×」删除按钮移除一行', async () => {
    const store = useSharedStore()
    store.reset()
    const events: MilestoneEvent[] = [
      { id: 'e1', name: '买房', month: 202601, amount: -2000000 },
    ]
    const wrapper = mount(EventEditor, {
      props: { month: 202601, events, x: 10, y: 10 },
    })
    await wrapper.find('[aria-label="删除该事件"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该事件"]')).toHaveLength(0)
  })

  it('改金额后点「完成」写回 store', async () => {
    const store = useSharedStore()
    store.reset()
    const events: MilestoneEvent[] = [
      { id: 'e1', name: '买房', month: 202601, amount: -2000000 },
    ]
    const wrapper = mount(EventEditor, {
      props: { month: 202601, events, x: 10, y: 10 },
    })
    const amountInput = wrapper
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).value === '-2000000')!
    await amountInput.setValue('-1500000')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    expect(store.data.value.events).toHaveLength(1)
    expect(store.data.value.events[0]!.amount).toBe(-1500000)
    expect(store.data.value.events[0]!.name).toBe('买房')
  })

  it('半空行（名称空）在完成时丢弃', async () => {
    const store = useSharedStore()
    store.reset()
    const wrapper = mount(EventEditor, {
      props: { month: 202601, events: [], x: 10, y: 10 },
    })
    await wrapper.find('[aria-label="添加事件"]').trigger('click')
    const inputs = wrapper.findAll('input')
    // 名称框留空，仅填金额框
    await inputs[1]!.setValue('-1000')
    await wrapper.find('[aria-label="完成"]').trigger('click')

    expect(store.data.value.events).toEqual([])
  })

  it('未改动时关闭不写回 store（无 no-op 写入与 id 重建）', async () => {
    const store = useSharedStore()
    store.reset()
    // 先把一条事件预置进 store（生成其 id）
    store.replaceMonthEvents(202601, [{ name: '买房', amount: -2000000 }])
    const beforeId = store.data.value.events[0]!.id
    const stored = store.data.value.events

    const wrapper = mount(EventEditor, {
      props: { month: 202601, events: stored, x: 10, y: 10 },
    })
    await wrapper.find('[aria-label="完成"]').trigger('click')

    // 未改动：未触发 replaceMonthEvents，原 id 保留、未重建
    expect(store.data.value.events).toHaveLength(1)
    expect(store.data.value.events[0]!.id).toBe(beforeId)
  })
})
