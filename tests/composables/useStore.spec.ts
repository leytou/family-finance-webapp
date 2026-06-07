import { beforeEach, describe, expect, it } from 'vitest'

import { useStore } from '../../src/composables/useStore'

describe('useStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('初次加载返回默认数据', () => {
    const store = useStore()

    expect(store.data.value.version).toBe(1)
    expect(store.data.value.items).toEqual([])
    expect(store.data.value.anchors).toEqual([])
    expect(store.data.value.systemParams.annualRate).toBe(0.025)
  })

  it('保存后重新加载可恢复', () => {
    const store1 = useStore()

    store1.data.value.systemParams.currentSavings = 500000
    store1.save()

    const store2 = useStore()

    expect(store2.data.value.systemParams.currentSavings).toBe(500000)
  })

  it('addItem 添加现金流项目', () => {
    const store = useStore()

    store.addItem('工资', 'income')

    expect(store.data.value.items).toHaveLength(1)
    expect(store.data.value.items[0]).toMatchObject({
      name: '工资',
      type: 'income',
    })
  })

  it('removeItem 删除项目', () => {
    const store = useStore()

    store.addItem('工资', 'income')
    const id = store.data.value.items[0].id
    store.removeItem(id)

    expect(store.data.value.items).toHaveLength(0)
  })

  it('reset 清空数据恢复默认', () => {
    const store = useStore()

    store.data.value.systemParams.currentSavings = 999999
    store.save()
    store.reset()

    expect(store.data.value.systemParams.currentSavings).toBe(0)
  })
})
