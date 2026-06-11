import { describe, expect, it, vi } from 'vitest'
import { useColumnDrag } from '../../src/composables/useColumnDrag'

// 构造一个满足 DragEvent 用法的假事件（jsdom 的 DragEvent.dataTransfer 不可靠，故自造）
function makeDragEvent(opts: { clientX?: number; left?: number; width?: number }): DragEvent {
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
    getData: vi.fn().mockReturnValue(''),
  }
  const left = opts.left ?? 0
  const width = opts.width ?? 100
  const currentTarget = {
    getBoundingClientRect: () => ({
      left,
      top: 0,
      right: left + width,
      bottom: 0,
      width,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => {},
    }),
  }
  return {
    clientX: opts.clientX ?? 0,
    dataTransfer,
    currentTarget,
    preventDefault: vi.fn(),
  } as unknown as DragEvent
}

describe('useColumnDrag', () => {
  it('onDragStart 记录被拖列 id 并配置 dataTransfer', () => {
    const reorder = vi.fn()
    const { draggingColumnId, onDragStart } = useColumnDrag(reorder)

    const e = makeDragEvent({})
    onDragStart('col-a', e)

    expect(draggingColumnId.value).toBe('col-a')
    expect((e.dataTransfer as any).effectAllowed).toBe('move')
    expect((e.dataTransfer as any).setData).toHaveBeenCalledWith('text/plain', 'col-a')
  })

  it('onDragOver 鼠标在左半区时 side=before 且 preventDefault', () => {
    const reorder = vi.fn()
    const { dropTarget, onDragOver } = useColumnDrag(reorder)

    const e = makeDragEvent({ clientX: 10, left: 0, width: 100 })
    onDragOver('col-b', e)

    expect(e.preventDefault).toHaveBeenCalled()
    expect(dropTarget.value).toEqual({ columnId: 'col-b', side: 'before' })
  })

  it('onDragOver 鼠标在右半区时 side=after', () => {
    const reorder = vi.fn()
    const { dropTarget, onDragOver } = useColumnDrag(reorder)

    const e = makeDragEvent({ clientX: 80, left: 0, width: 100 })
    onDragOver('col-b', e)

    expect(dropTarget.value).toEqual({ columnId: 'col-b', side: 'after' })
  })

  it('onDrop 用 dragover 记录的落点调用 reorder 并重置状态', () => {
    const reorder = vi.fn()
    const { draggingColumnId, dropTarget, onDragStart, onDragOver, onDrop } = useColumnDrag(reorder)

    onDragStart('col-a', makeDragEvent({}))
    onDragOver('col-b', makeDragEvent({ clientX: 10, left: 0, width: 100 }))
    onDrop('col-b', makeDragEvent({}))

    expect(reorder).toHaveBeenCalledWith('col-a', 'col-b', 'before')
    expect(draggingColumnId.value).toBeNull()
    expect(dropTarget.value).toBeNull()
  })

  it('onDragEnd 重置状态', () => {
    const reorder = vi.fn()
    const { draggingColumnId, dropTarget, onDragStart, onDragEnd } = useColumnDrag(reorder)

    onDragStart('col-a', makeDragEvent({}))
    onDragEnd()

    expect(draggingColumnId.value).toBeNull()
    expect(dropTarget.value).toBeNull()
  })

  it('未启动拖拽时 onDrop 不调用 reorder', () => {
    const reorder = vi.fn()
    const { onDrop } = useColumnDrag(reorder)

    onDrop('col-b', makeDragEvent({}))

    expect(reorder).not.toHaveBeenCalled()
  })
})
