import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

const playTourMock = vi.fn()
vi.mock('../../src/composables/useTour', () => ({
  playTour: (...args: unknown[]) => playTourMock(...args),
  TOUR_TOPICS: [
    { key: 'quickstart', label: '🚀 快速入门' },
    { key: 'all', label: '🔁 重看全部' },
  ],
}))

async function loadTourMenu() {
  return (await import('../../src/components/TourMenu.vue')).default
}

describe('TourMenu', () => {
  beforeEach(() => {
    playTourMock.mockClear()
    localStorage.clear()
  })

  it('渲染「教程」触发按钮，初始菜单不显示', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    const trigger = wrapper.findAll('button').find(b => b.text().includes('教程'))
    expect(trigger).toBeDefined()
    expect(wrapper.text()).not.toContain('快速入门')
  })

  it('点击触发按钮展开主题菜单', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    const trigger = wrapper.findAll('button').find(b => b.text().includes('教程'))!
    await trigger.trigger('click')
    expect(wrapper.text()).toContain('快速入门')
    expect(wrapper.text()).toContain('重看全部')
  })

  it('点击某主题调用 playTour 并收起菜单', async () => {
    const TourMenu = await loadTourMenu()
    const wrapper = mount(TourMenu)
    await wrapper.findAll('button').find(b => b.text().includes('教程'))!.trigger('click')
    const item = wrapper.findAll('button').find(b => b.text().includes('快速入门'))!
    await item.trigger('click')
    expect(playTourMock).toHaveBeenCalledWith('quickstart')
    expect(wrapper.text()).not.toContain('重看全部')
  })
})
