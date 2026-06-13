import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FormulaPopover from '../../src/components/FormulaPopover.vue'

describe('FormulaPopover', () => {
  it('渲染标题与公式行并按坐标定位', () => {
    const wrapper = mount(FormulaPopover, {
      props: {
        title: '2026-02 - 结余',
        lines: ['结余 = 收入(12,000) - 支出(3,500) + 理财(125) = 8,625'],
        x: 20,
        y: 30,
      },
    })

    expect(wrapper.text()).toContain('2026-02 - 结余')
    expect(wrapper.text()).toContain('结余 = 收入(12,000) - 支出(3,500) + 理财(125) = 8,625')
    expect(wrapper.attributes('style')).toContain('left: 20px')
    expect(wrapper.attributes('style')).toContain('top: 30px')
  })

  it('多行公式每行各占一个 div', () => {
    const wrapper = mount(FormulaPopover, {
      props: { title: '标题', lines: ['第一行', '第二行'], x: 0, y: 0 },
    })

    expect(wrapper.findAll('.text-gray-700')).toHaveLength(2)
  })

  it('鼠标移出时触发 close 事件', async () => {
    const wrapper = mount(FormulaPopover, {
      props: { title: '标题', lines: ['x'], x: 0, y: 0 },
    })

    await wrapper.trigger('mouseleave')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
