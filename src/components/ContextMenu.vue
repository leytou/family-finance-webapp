<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'

export interface MenuItem {
  label: string
  disabled?: boolean
  onClick: () => void
}

defineProps<{
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

function handleItemClick(item: MenuItem) {
  if (item.disabled) return
  item.onClick()
  emit('close')
}

// 点击菜单外部关闭（mousedown 捕获阶段，先于其他点击处理）
useClickOutside(menuRef, () => emit('close'))

// 挂载后聚焦菜单容器，使其能接收 Esc 键盘事件（真实场景下焦点原本在触发单元格）
onMounted(() => {
  menuRef.value?.focus()
})
</script>

<template>
  <div
    ref="menuRef"
    role="menu"
    class="fixed z-50 min-w-32 overflow-hidden rounded-xl border border-line bg-surface py-1 text-[11px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
    :style="{ left: `${x}px`, top: `${y}px` }"
    tabindex="-1"
    @keyup.escape="emit('close')"
  >
    <button
      v-for="(item, idx) in items"
      :key="idx"
      type="button"
      role="menuitem"
      class="block w-full px-3 py-1 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-transparent"
      :disabled="item.disabled"
      :aria-disabled="item.disabled ? 'true' : 'false'"
      @click="handleItemClick(item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
