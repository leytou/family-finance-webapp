import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EventDetailPopover from '../../src/components/EventDetailPopover.vue'
import type { MilestoneEvent } from '../../src/types'

function createEvent(overrides: Partial<MilestoneEvent> = {}): MilestoneEvent {
  return { id: 'e1', name: '买房', month: 202601, amount: -2000000, ...overrides }
}

describe('EventDetailPopover', () => {
  it('展示月份专项标题并逐条列出事件与净额', () => {
    const wrapper = mount(EventDetailPopover, {
      props: {
        month: 202602,
        events: [
          createEvent({ id: 'e1', name: '买房', amount: -2000000 }),
          createEvent({ id: 'e2', name: '奖金', amount: 100000 }),
        ],
        net: -1900000,
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('2026-02 专项')
    expect(wrapper.text()).toContain('买房')
    expect(wrapper.text()).toContain('-2,000,000')
    expect(wrapper.text()).toContain('奖金')
    expect(wrapper.text()).toContain('100,000')
    // 净额合计
    expect(wrapper.text()).toContain('净额')
    expect(wrapper.text()).toContain('-1,900,000')
  })

  it('按传入坐标定位弹窗', () => {
    const wrapper = mount(EventDetailPopover, {
      props: { month: 202603, events: [], net: 0, x: 80, y: 90 },
    })

    expect(wrapper.attributes('style')).toContain('left: 80px')
    expect(wrapper.attributes('style')).toContain('top: 90px')
  })

  it('鼠标移出时触发 close', async () => {
    const wrapper = mount(EventDetailPopover, {
      props: { month: 202601, events: [createEvent()], net: -2000000, x: 0, y: 0 },
    })

    await wrapper.trigger('mouseleave')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
