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
    class="fixed z-50 min-w-48 max-w-96 border rounded bg-white p-3 text-sm shadow-lg"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @mouseleave="emit('close')"
  >
    <div class="mb-2 font-semibold">{{ title }}</div>
    <div v-for="(line, index) in lines" :key="index" class="text-neutral-700">{{ line }}</div>
  </div>
</template>
