import { ref } from 'vue'

export type DropSide = 'before' | 'after'

export interface DropTarget {
  columnId: string
  side: DropSide
}

/**
 * 封装动态列头拖拽状态机与插入线计算。
 * @param reorder 重排回调，由调用方提供（通常为 store.moveColumn）
 */
export function useColumnDrag(
  reorder: (fromId: string, toId: string, side: DropSide) => void,
) {
  // 当前被拖动的列 id
  const draggingColumnId = ref<string | null>(null)
  // 当前落点（目标列 + 左/右侧）
  const dropTarget = ref<DropTarget | null>(null)

  function reset(): void {
    draggingColumnId.value = null
    dropTarget.value = null
  }

  function onDragStart(columnId: string, e: DragEvent): void {
    draggingColumnId.value = columnId
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      // setData 让部分浏览器允许 drop 触发
      e.dataTransfer.setData('text/plain', columnId)
    }
  }

  function onDragOver(columnId: string, e: DragEvent): void {
    e.preventDefault() // 允许 drop
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const side: DropSide = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    dropTarget.value = { columnId, side }
  }

  function onDrop(_columnId: string, e: DragEvent): void {
    e.preventDefault()
    const from = draggingColumnId.value
    const target = dropTarget.value
    if (from && target) {
      reorder(from, target.columnId, target.side)
    }
    reset()
  }

  function onDragEnd(): void {
    reset()
  }

  return { draggingColumnId, dropTarget, onDragStart, onDragOver, onDrop, onDragEnd }
}
