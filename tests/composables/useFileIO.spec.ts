import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseFileIO() {
  return (await import('../../src/composables/useFileIO')).useFileIO
}

async function loadUseStore() {
  return (await import('../../src/composables/useStore')).useStore
}

describe('useFileIO', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exportData', () => {
    it('生成含 exportVersion、exportTime、data 的 JSON 并触发下载', async () => {
      const useStore = await loadUseStore()
      const store = useStore()
      store.addColumn('工资')
      store.save()

      const clickSpy = vi.fn()
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        node.addEventListener('click', () => clickSpy())
        return node
      })
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      const result = exportData()

      expect(result.success).toBe(true)
      expect(appendChildSpy).toHaveBeenCalled()

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })

    it('导出文件名包含当前日期 YYYYMMDD', async () => {
      const useStore = await loadUseStore()
      useStore()

      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.createElement('a'))
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.createElement('a'))

      const useFileIO = await loadUseFileIO()
      const { exportData } = useFileIO()
      exportData()

      const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
      expect(link.download).toMatch(/^family-finance-plan-\d{8}\.json$/)

      appendChildSpy.mockRestore()
      removeChildSpy.mockRestore()
    })
  })
})
