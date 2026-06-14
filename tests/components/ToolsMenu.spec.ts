import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

enableAutoUnmount(afterEach)

async function loadToolsMenu() {
  return (await import('../../src/components/ToolsMenu.vue')).default
}

describe('ToolsMenu', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('触发按钮文案为「更多」', async () => {
    const ToolsMenu = await loadToolsMenu()
    const wrapper = mount(ToolsMenu)

    const trigger = wrapper.findAll('button').find(b => b.text() === '更多')
    expect(trigger).toBeDefined()
  })
})
