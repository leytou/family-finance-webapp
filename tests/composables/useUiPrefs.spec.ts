import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUseUiPrefs() {
  return (await import('../../src/composables/useUiPrefs')).useUiPrefs
}

describe('useUiPrefs', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('初次加载四个区块默认展开', async () => {
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.params.value).toBe(false)
    expect(prefs.metrics.value).toBe(false)
    expect(prefs.annual.value).toBe(false)
    expect(prefs.monthly.value).toBe(false)
  })

  it('设置收起后写入 localStorage 独立 key', async () => {
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    prefs.annual.value = true
    const raw = localStorage.getItem('family-finance-ui-prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).collapsed.annual).toBe(true)
  })

  it('收起后重新加载保持状态', async () => {
    let useUiPrefs = await loadUseUiPrefs()
    useUiPrefs().metrics.value = true
    vi.resetModules()
    useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.metrics.value).toBe(true)
    expect(prefs.params.value).toBe(false)
  })

  it('localStorage 损坏时回退默认全展开', async () => {
    localStorage.setItem('family-finance-ui-prefs', '{not json')
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.params.value).toBe(false)
    expect(prefs.annual.value).toBe(false)
  })

  it('部分字段缺失时，缺失字段回退展开', async () => {
    localStorage.setItem(
      'family-finance-ui-prefs',
      JSON.stringify({ version: 1, collapsed: { annual: true } }),
    )
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    expect(prefs.annual.value).toBe(true)
    expect(prefs.monthly.value).toBe(false)
  })

  it('给一个区块设值不影响其它区块（make 工厂独立性）', async () => {
    const useUiPrefs = await loadUseUiPrefs()
    const prefs = useUiPrefs()
    prefs.annual.value = true
    expect(prefs.annual.value).toBe(true)
    expect(prefs.monthly.value).toBe(false)
    expect(prefs.params.value).toBe(false)
  })
})
