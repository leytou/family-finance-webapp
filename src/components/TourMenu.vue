<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { playTour, TOUR_TOPICS } from '../composables/useTour'

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)

useClickOutside(menuRef, () => {
  open.value = false
})

function toggle() {
  open.value = !open.value
}

function choose(key: typeof TOUR_TOPICS[number]['key']) {
  open.value = false
  playTour(key)
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="px-3 py-1 border rounded text-sm font-mono hover:bg-surface-2"
      type="button"
      @click="toggle"
    >
      教程
    </button>
    <div
      v-if="open"
      data-testid="tour-menu"
      class="absolute right-0 top-full mt-1 min-w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 text-[12px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)] z-50"
    >
      <button
        v-for="topic in TOUR_TOPICS"
        :key="topic.key"
        type="button"
        class="block w-full px-3 py-1.5 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2"
        @click="choose(topic.key)"
      >
        {{ topic.label }}
      </button>
    </div>
  </div>
</template>
