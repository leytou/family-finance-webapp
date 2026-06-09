import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextMenu from '../../src/components/ContextMenu.vue'

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染菜单项并定位到指定坐标', () => {
    const wrapper = mount(ContextMenu, {
      props: {
        x: 120,
        y: 80,
        items: [{ label: '清除下方编辑值', onClick: () => {} }],
      },
    })

    const menu = wrapper.get('[role="menu"]')
    expect(menu.text()).toContain('清除下方编辑值')
    const style = menu.attributes('style') ?? ''
    expect(style).toContain('left: 120px')
    expect(style).toContain('top: 80px')
  })

  it('点击可用菜单项触发 onClick 并 emit close', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ContextMenu, {
      props: {
        x: 0,
        y: 0,
        items: [{ label: '清除下方编辑值', onClick }],
      },
    })

    await wrapper.get('[role="menuitem"]').trigger('click')

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('点击禁用菜单项不触发 onClick 也不关闭', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ContextMenu, {
      props: {
        x: 0,
        y: 0,
        items: [{ label: '清除下方编辑值', disabled: true, onClick }],
      },
    })

    const item = wrapper.get('[role="menuitem"]')
    expect(item.attributes('aria-disabled')).toBe('true')

    await item.trigger('click')

    expect(onClick).not.toHaveBeenCalled()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('按 Esc 时 emit close', async () => {
    const wrapper = mount(ContextMenu, {
      props: {
        x: 0,
        y: 0,
        items: [{ label: '清除下方编辑值', onClick: () => {} }],
      },
      attachTo: document.body,
    })

    await wrapper.get('[role="menu"]').trigger('keyup.escape')

    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})
