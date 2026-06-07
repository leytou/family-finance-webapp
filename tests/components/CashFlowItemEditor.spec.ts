import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CashFlowItemEditor from '../../src/components/CashFlowItemEditor.vue'
import TimeGrid from '../../src/components/TimeGrid.vue'
import type { CashFlowItem } from '../../src/types'

function createItem(overrides: Partial<CashFlowItem> = {}): CashFlowItem {
  return {
    id: 'salary',
    name: '工资',
    type: 'income',
    segments: [],
    ...overrides,
  }
}

describe('CashFlowItemEditor', () => {
  it('编辑名称、切换类型和删除时发出对应事件', async () => {
    const item = createItem()
    const wrapper = mount(CashFlowItemEditor, {
      props: { item, startMonth: 202601 },
    })

    await wrapper.get('[aria-label="项目名称"]').setValue('奖金')
    await wrapper.get('[aria-label="切换收支类型"]').trigger('click')
    await wrapper.get('[aria-label="删除现金流项目"]').trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      [{ ...item, name: '奖金' }],
      [{ ...item, type: 'expense' }],
    ])
    expect(wrapper.emitted('remove')).toEqual([['salary']])
  })

  it('展开后可新增、修改和删除金额段', async () => {
    const item = createItem({
      segments: [{ amount: 5000, startMonth: 202601, endMonth: 202612 }],
    })
    const wrapper = mount(CashFlowItemEditor, {
      props: { item, startMonth: 202601 },
    })

    await wrapper.get('[aria-label="展开金额段"]').trigger('click')
    await wrapper.get('[aria-label="金额"]').setValue(6000)
    wrapper.findComponent(TimeGrid).vm.$emit('select', {
      startMonth: 202602,
      endMonth: 202712,
    })
    await wrapper.get('[aria-label="添加金额段"]').trigger('click')
    await wrapper.get('[aria-label="删除金额段"]').trigger('click')

    expect(wrapper.emitted('update')).toEqual([
      [{ ...item, segments: [{ amount: 6000, startMonth: 202601, endMonth: 202612 }] }],
      [{ ...item, segments: [{ amount: 5000, startMonth: 202602, endMonth: 202712 }] }],
      [
        {
          ...item,
          segments: [
            { amount: 5000, startMonth: 202601, endMonth: 202612 },
            { amount: 0, startMonth: 202601, endMonth: 203012 },
          ],
        },
      ],
      [{ ...item, segments: [] }],
    ])
  })

  it('使用传入的起始月份渲染时间网格', async () => {
    const item = createItem({
      segments: [{ amount: 5000, startMonth: 202704, endMonth: 202712 }],
    })
    const wrapper = mount(CashFlowItemEditor, {
      props: { item, startMonth: 202704 },
    })

    await wrapper.get('[aria-label="展开金额段"]').trigger('click')

    expect(wrapper.findComponent(TimeGrid).props('startMonth')).toBe(202704)
    expect(wrapper.findAll('[data-testid="grid-cell"]')[0].text()).toBe('2027-04')
  })
})
