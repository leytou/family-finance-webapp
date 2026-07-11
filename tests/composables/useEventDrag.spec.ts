import { describe, expect, it, vi } from 'vitest'
import { useEventDrag } from '../../src/composables/useEventDrag'

// 构造满足 DragEvent 用法的假事件（jsdom 的 DragEvent.dataTransfer 不可靠，故自造）。
// useEventDrag 的 handler 对 dataTransfer 做了空值保护，只用 preventDefault，不读坐标。
function makeDragEvent(): DragEvent {
  const dataTransfer = {
    effectAllowed: '',
    dropEffect: '',
    setData: vi.fn(),
    getData: vi.fn().mockReturnValue(''),
  }
  return {
    dataTransfer,
    preventDefault: vi.fn(),
  } as unknown as DragEvent
}

describe('useEventDrag', () => {
  it('onDragStart 记录被拖月份并配置 dataTransfer', () => {
    const move = vi.fn()
    const { draggingMonth, onDragStart } = useEventDrag(move)

    const e = makeDragEvent()
    onDragStart(202601, e)

    expect(draggingMonth.value).toBe(202601)
    expect((e.dataTransfer as any).effectAllowed).toBe('move')
    expect((e.dataTransfer as any).setData).toHaveBeenCalledWith('text/plain', '202601')
  })

  it('onDragOver 记录目标月份并 preventDefault', () => {
    const move = vi.fn()
    const { dropTargetMonth, onDragOver } = useEventDrag(move)

    const e = makeDragEvent()
    onDragOver(202603, e)

    expect(e.preventDefault).toHaveBeenCalled()
    expect(dropTargetMonth.value).toBe(202603)
  })

  it('onDrop 用 dragover 记录的落点调用 move 并重置状态', () => {
    const move = vi.fn()
    const { draggingMonth, dropTargetMonth, onDragStart, onDragOver, onDrop } = useEventDrag(move)

    onDragStart(202601, makeDragEvent())
    onDragOver(202603, makeDragEvent())
    onDrop(202603, makeDragEvent())

    expect(move).toHaveBeenCalledWith(202601, 202603)
    expect(draggingMonth.value).toBeNull()
    expect(dropTargetMonth.value).toBeNull()
  })

  it('onDragEnd 重置状态', () => {
    const move = vi.fn()
    const { draggingMonth, dropTargetMonth, onDragStart, onDragEnd } = useEventDrag(move)

    onDragStart(202601, makeDragEvent())
    onDragEnd()

    expect(draggingMonth.value).toBeNull()
    expect(dropTargetMonth.value).toBeNull()
  })

  it('未启动拖拽时 onDrop 不调用 move', () => {
    const move = vi.fn()
    const { onDrop } = useEventDrag(move)

    onDrop(202603, makeDragEvent())

    expect(move).not.toHaveBeenCalled()
  })
})
