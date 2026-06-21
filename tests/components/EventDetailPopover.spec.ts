import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import EventDetailPopover from '../../src/components/EventDetailPopover.vue'

describe('EventDetailPopover', () => {
  it('展示标题、每笔明细与净额', () => {
    const wrapper = mount(EventDetailPopover, {
      props: {
        title: '2026-01 奖金',
        items: [
          { name: '年终奖', amount: 8000 },
          { name: '红包', amount: 3000 },
        ],
        net: 11000,
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('2026-01 奖金')
    expect(wrapper.text()).toContain('年终奖')
    expect(wrapper.text()).toContain('8,000')
    expect(wrapper.text()).toContain('红包')
    expect(wrapper.text()).toContain('3,000')
    // 净额合计
    expect(wrapper.text()).toContain('净额')
    expect(wrapper.text()).toContain('11,000')
  })

  it('负数明细以斜体展示', () => {
    const wrapper = mount(EventDetailPopover, {
      props: {
        title: '2026-02 专项',
        items: [{ name: '买房', amount: -2000000 }],
        net: -2000000,
        x: 0,
        y: 0,
      },
    })

    expect(wrapper.text()).toContain('买房')
    expect(wrapper.text()).toContain('-2,000,000')
    // 负数金额渲染为斜体
    const amounts = wrapper.findAll('span.tabular-nums')
    expect(amounts.some((s) => s.classes().includes('italic'))).toBe(true)
  })

  it('按传入坐标定位弹窗', () => {
    const wrapper = mount(EventDetailPopover, {
      props: { title: '专项', items: [], net: 0, x: 80, y: 90 },
    })

    expect(wrapper.attributes('style')).toContain('left: 80px')
    expect(wrapper.attributes('style')).toContain('top: 90px')
  })

  it('鼠标移出时触发 close', async () => {
    const wrapper = mount(EventDetailPopover, {
      props: { title: '专项', items: [{ name: '买房', amount: -100 }], net: -100, x: 0, y: 0 },
    })

    await wrapper.trigger('mouseleave')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
