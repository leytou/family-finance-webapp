import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MonthPicker from '../../src/components/MonthPicker.vue'

describe('MonthPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('触发器显示中文友好格式', () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    const trigger = wrapper.get('button[aria-haspopup="dialog"]')
    expect(trigger.text()).toContain('2026年1月')
  })

  it('初始不展开面板', () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('点击触发器展开/收起', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    const trigger = wrapper.get('button[aria-haspopup="dialog"]')

    await trigger.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await trigger.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('点选某月 → emit 正确 YYYYMM 并关闭', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="month-cell"]')
    await cells[2]!.trigger('click') // 3 月 → 202603

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(202603)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('已选月格高亮且 aria-current=true', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    const cells = wrapper.findAll('[data-testid="month-cell"]')
    expect(cells[0]!.attributes('aria-current')).toBe('true') // 1 月为已选
    expect(cells[0]!.classes()).toContain('bg-brand-50')
    expect(cells[1]!.attributes('aria-current')).toBeUndefined()
  })

  it('◀▶ 步进切换面板年份', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get('button[aria-label="上一年"]').trigger('click')
    expect(wrapper.get('[data-testid="panel-year"]').text()).toContain('2025')

    // 翻到 2025 年后点 1 月 → 202501
    await wrapper.findAll('[data-testid="month-cell"]')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe(202501)
  })

  it('点年份键入合法年份后更新', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get('[data-testid="panel-year"]').trigger('click') // 切到输入框
    const input = wrapper.get('[data-testid="panel-year-input"]')
    await input.setValue('2030')
    await input.trigger('blur')

    expect(wrapper.get('[data-testid="panel-year"]').text()).toContain('2030')
  })

  it('年份键入非法（空）回退原年', async () => {
    const wrapper = mount(MonthPicker, { props: { modelValue: 202601 } })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')

    await wrapper.get('[data-testid="panel-year"]').trigger('click')
    const input = wrapper.get('[data-testid="panel-year-input"]')
    await input.setValue('')
    await input.trigger('blur')

    expect(wrapper.get('[data-testid="panel-year"]').text()).toContain('2026')
  })

  it('Esc 关闭面板', async () => {
    const wrapper = mount(MonthPicker, {
      props: { modelValue: 202601 },
      attachTo: document.body,
    })
    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    await nextTick()

    await wrapper.get('[role="dialog"]').trigger('keyup.escape')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('点击外部关闭面板', async () => {
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    const wrapper = mount(MonthPicker, {
      props: { modelValue: 202601 },
      attachTo: document.body,
    })

    await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    wrapper.unmount()
    outside.remove()
  })
})
