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
    const el = target.value
    if (!el) return
    // Vue 3 在 v-for 内的模板 ref 可能被收集为数组，取第一个元素
    const node = (Array.isArray(el) ? el[0] : el) as HTMLElement
    if (node && !node.contains(e.target as Node)) {
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
