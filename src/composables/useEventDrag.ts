import { ref } from 'vue'

/**
 * 封装专项单元格拖转状态机。比 useColumnDrag 更简单：
 * 专项是「整格落到某月」，无左/右插入位置概念。
 * @param move 搬运回调，由调用方提供（store.moveMonthEvents）
 */
export function useEventDrag(move: (fromMonth: number, toMonth: number) => void) {
  // 当前被拖动的源月（YYYYMM）
  const draggingMonth = ref<number | null>(null)
  // 当前落点目标月
  const dropTargetMonth = ref<number | null>(null)

  function reset(): void {
    draggingMonth.value = null
    dropTargetMonth.value = null
  }

  function onDragStart(month: number, e: DragEvent): void {
    draggingMonth.value = month
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      // setData 让部分浏览器允许 drop 触发
      e.dataTransfer.setData('text/plain', String(month))
    }
  }

  function onDragOver(month: number, e: DragEvent): void {
    e.preventDefault() // 允许 drop
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dropTargetMonth.value = month
  }

  function onDrop(_month: number, e: DragEvent): void {
    e.preventDefault()
    const from = draggingMonth.value
    const to = dropTargetMonth.value
    if (from !== null && to !== null) move(from, to)
    reset()
  }

  function onDragEnd(): void {
    reset()
  }

  return { draggingMonth, dropTargetMonth, onDragStart, onDragOver, onDrop, onDragEnd }
}
