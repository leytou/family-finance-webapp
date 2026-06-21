<script setup lang="ts">
const props = withDefaults(defineProps<{
  collapsed: boolean
  title: string
  index?: string
  sticky?: boolean
}>(), {
  sticky: false,
})

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

function toggle() {
  emit('update:collapsed', !props.collapsed)
}
</script>

<template>
  <div>
    <!-- 折叠头样式与现有「01 年度汇总」标题条一致，四个区块复用，保证入口统一 -->
    <button
      type="button"
      data-testid="collapse-header"
      class="font-mono text-[10.5px] tracking-[0.18em] uppercase text-ink-2 px-4 py-1.5 flex items-center gap-2 bg-surface w-full text-left hover:bg-surface-2"
      :class="{ 'sticky top-0 z-1': sticky }"
      :aria-expanded="!collapsed"
      @click="toggle"
    >
      <span data-testid="collapse-arrow" aria-hidden="true">{{ collapsed ? '▸' : '▾' }}</span>
      <span v-if="index" data-testid="collapse-index" class="text-brand-600 font-bold">{{ index }}</span>
      {{ title }}
    </button>
    <!-- v-show 保留 DOM：避免展开后输入框重新挂载导致失焦/丢值 -->
    <div v-show="!collapsed">
      <slot />
    </div>
  </div>
</template>
