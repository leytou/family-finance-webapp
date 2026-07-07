import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CollapsibleSection from '../../src/components/CollapsibleSection.vue'

enableAutoUnmount(afterEach)

function mountSection(props: Record<string, unknown>) {
  return mount(CollapsibleSection, {
    props,
    slots: { default: '<div data-testid="content">内容</div>' },
  })
}

describe('CollapsibleSection', () => {
  it('展开时显示标题与内容', () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    expect(wrapper.text()).toContain('参数')
    expect(wrapper.find('[data-testid="content"]').isVisible()).toBe(true)
  })

  it('收起时隐藏内容但保留 DOM（v-show）', () => {
    const wrapper = mountSection({ collapsed: true, title: '参数' })
    expect(wrapper.find('[data-testid="content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="content"]').isVisible()).toBe(false)
  })

  it('点击折叠头切换并 emit update:collapsed', async () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toEqual([[true]])
  })

  it('收起态再点一次回到展开（双向切换）', async () => {
    const wrapper = mountSection({ collapsed: true, title: '参数' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toEqual([[false]])
  })

  it('折叠头 aria-expanded 反映展开状态', () => {
    const open = mountSection({ collapsed: false, title: '参数' })
    expect(open.get('button').attributes('aria-expanded')).toBe('true')
    const closed = mountSection({ collapsed: true, title: '参数' })
    expect(closed.get('button').attributes('aria-expanded')).toBe('false')
  })

  it('展开时箭头朝下 ▾，收起时朝右 ▸', () => {
    const open = mountSection({ collapsed: false, title: '参数' })
    expect(open.get('[data-testid="collapse-arrow"]').text()).toBe('▾')
    const closed = mountSection({ collapsed: true, title: '参数' })
    expect(closed.get('[data-testid="collapse-arrow"]').text()).toBe('▸')
  })

  it('传入 index 渲染序号', () => {
    const wrapper = mountSection({ collapsed: false, title: '年度汇总', index: '01' })
    expect(wrapper.get('[data-testid="collapse-index"]').text()).toBe('01')
  })

  it('未传 index 时不渲染序号节点', () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    expect(wrapper.find('[data-testid="collapse-index"]').exists()).toBe(false)
  })

  it('传入 icon 渲染对应线性图标（SVG）', () => {
    const wrapper = mountSection({ collapsed: false, title: '年度汇总', icon: 'calendar' })
    const icon = wrapper.get('[data-testid="collapse-icon"]')
    // 容器为品牌靛蓝，内部内联了一枚 <svg>
    expect(icon.classes()).toContain('text-brand-600')
    expect(icon.find('svg').exists()).toBe(true)
  })

  it('未传 icon 时不渲染图标节点', () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    expect(wrapper.find('[data-testid="collapse-icon"]').exists()).toBe(false)
  })

  it('sticky 为真时外层行带 sticky 类（钉顶整行而非小块）', () => {
    const wrapper = mountSection({ collapsed: false, title: '月度流水', sticky: true })
    expect(wrapper.get('[data-testid="collapse-header-row"]').classes()).toContain('sticky')
  })

  it('点击标题块外的行空白不触发展开/收起，点小块仍触发', async () => {
    const wrapper = mountSection({ collapsed: false, title: '参数' })
    // 点击外层行容器（标题小块之外的空白区域）—— 不触发
    await wrapper.get('[data-testid="collapse-header-row"]').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toBeUndefined()
    // 点击标题小块本身 —— 仍触发
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:collapsed')).toEqual([[true]])
  })
})
