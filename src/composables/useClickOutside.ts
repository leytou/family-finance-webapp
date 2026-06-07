import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * 点击目标元素外部时触发回调
 * 使用 mousedown 捕获阶段，确保在 blur 之前处理，避免 blur→重渲染→click 丢失的时序问题
 */
export function useClickOutside(
  target: Ref<HTMLElement | null>,
  callback: () => void
) {
  function handler(e: MouseEvent) {
    if (target.value && !target.value.contains(e.target as Node)) {
      callback()
    }
  }

  onMounted(() => {
    document.addEventListener('mousedown', handler, true)
  })

  onUnmounted(() => {
    document.removeEventListener('mousedown', handler, true)
  })
}
