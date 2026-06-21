import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ItemEditor from '../../src/components/ItemEditor.vue'

describe('ItemEditor', () => {
  it('打开时默认至少 3 行（已有项保留、不足补空）', () => {
    const wrapper = mount(ItemEditor, {
      props: { title: '2026-01 专项', items: [{ name: '买房', amount: -500000 }], x: 0, y: 0 },
    })
    // 1 个已有 + 2 个补空 = 3 行输入框组
    const nameInputs = wrapper.findAll('input[placeholder="名称"]')
    expect(nameInputs.length).toBe(3)
  })

  it('已有项超过 3 个时全部保留', () => {
    const items = [{ name: 'a', amount: 1 }, { name: 'b', amount: 2 }, { name: 'c', amount: 3 }, { name: 'd', amount: 4 }]
    const wrapper = mount(ItemEditor, { props: { title: 't', items, x: 0, y: 0 } })
    expect(wrapper.findAll('input[placeholder="名称"]').length).toBe(4)
  })

  it('预填传入的项（名称与金额）', () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: '买房', amount: -2000000 }], x: 0, y: 0 },
    })
    const inputs = wrapper.findAll('input')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('买房')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('-2000000')
  })

  it('点「添加」按钮新增空行', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: 'a', amount: 1 }, { name: 'b', amount: 2 }, { name: 'c', amount: 3 }], x: 0, y: 0 },
    })
    expect(wrapper.findAll('[aria-label="删除该行"]')).toHaveLength(3)
    await wrapper.find('[aria-label="添加行"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该行"]')).toHaveLength(4)
  })

  it('点「×」删除按钮移除一行', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: '买房', amount: -2000000 }], x: 0, y: 0 },
    })
    await wrapper.find('[aria-label="删除该行"]').trigger('click')
    expect(wrapper.findAll('[aria-label="删除该行"]')).toHaveLength(2)
  })

  it('点「完成」emit save（仅含有效项）并 close', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: 'a', amount: 100 }], x: 0, y: 0 },
    })
    await wrapper.findAll('input[placeholder="名称"]')[0].setValue('奖金')
    const amountInput = wrapper.find('input[inputmode="numeric"]')
    await amountInput.setValue('5000')
    await wrapper.find('button[aria-label="完成"]').trigger('click')
    const save = wrapper.emitted('save')
    expect(save).toBeTruthy()
    expect(save![0][0]).toEqual([{ name: '奖金', amount: 5000 }])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('改金额后点「完成」emit save 含四舍五入后的金额', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: '买房', amount: -2000000 }], x: 0, y: 0 },
    })
    const amountInput = wrapper
      .findAll('input')
      .find((i) => (i.element as HTMLInputElement).value === '-2000000')!
    await amountInput.setValue('-1500000.6')
    await wrapper.find('button[aria-label="完成"]').trigger('click')
    const save = wrapper.emitted('save')
    expect(save).toBeTruthy()
    expect(save![0][0]).toEqual([{ name: '买房', amount: -1500001 }])
  })

  it('半空行（名称空）在完成时丢弃', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [], x: 0, y: 0 },
    })
    // 默认 3 行；填其中一个金额框、名称留空
    const inputs = wrapper.findAll('input')
    await inputs[1]!.setValue('-1000')
    await wrapper.find('button[aria-label="完成"]').trigger('click')
    expect(wrapper.emitted('save')).toBeTruthy()
    // 名称空 → 被过滤，emit 出空数组
    expect((wrapper.emitted('save')![0][0] as unknown[])).toEqual([])
  })

  it('未改动时点「完成」不 emit save（避免 no-op 写入）', async () => {
    const wrapper = mount(ItemEditor, {
      props: { title: 't', items: [{ name: '买房', amount: -2000000 }], x: 0, y: 0 },
    })
    await wrapper.find('button[aria-label="完成"]').trigger('click')
    // 未改动：不触发 save（父组件可据此跳过 store 写回，保留原 id）
    expect(wrapper.emitted('save')).toBeFalsy()
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
