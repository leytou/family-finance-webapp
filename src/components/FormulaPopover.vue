<script setup lang="ts">
defineProps<{
  title: string
  lines: string[]
  x: number
  y: number
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div
    class="fixed z-50 min-w-48 max-w-96 rounded-xl border border-line bg-surface p-3 text-sm text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)]"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <!-- 统一浮层标题样式（等宽小号大写） -->
    <div class="mb-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-ink-2">{{ title }}</div>
    <div v-for="(line, index) in lines" :key="index" class="formula-line text-ink-2">{{ line }}</div>
  </div>
</template>
