<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useClickOutside } from '../composables/useClickOutside'

const store = useStore()
const scenarios = computed(() => store.workspace.value.scenarios)
const activeId = computed(() => store.workspace.value.activeId)

// 行内重命名状态
const renamingId = ref<string | null>(null)
const renameValue = ref<string>('')
const renameInput = ref<HTMLInputElement | null>(null)

function setRenameInput(el: any) { renameInput.value = el ?? null }

const vFocus = {
  mounted(el: HTMLInputElement) {
    el.focus()
    el.select()
  },
}

function startRename(id: string, name: string) {
  renamingId.value = id
  renameValue.value = name
}

function confirmRename() {
  if (renamingId.value === null) return
  const trimmed = renameValue.value.trim()
  if (trimmed) {
    store.renameScenario(renamingId.value, trimmed)
  }
  renamingId.value = null
  renameValue.value = ''
}

function cancelRename() {
  renamingId.value = null
  renameValue.value = ''
}

useClickOutside(renameInput, confirmRename)

function handleSwitch(id: string) {
  if (id !== activeId.value) {
    store.switchScenario(id)
  }
}

function handleAdd() {
  const scenario = store.addScenario()
  renamingId.value = scenario.id
  renameValue.value = ''
}

function handleDuplicate() {
  const scenario = store.duplicateScenario()
  renamingId.value = scenario.id
  renameValue.value = ''
}

function handleRemove(id: string, name: string) {
  if (window.confirm(`确定要删除方案"${name}"吗？`)) {
    store.removeScenario(id)
  }
}
</script>

<template>
  <div class="flex items-center gap-1">
    <div
      v-for="scenario in scenarios"
      :key="scenario.id"
      data-test="scenario-tab"
      class="group flex items-center gap-1 px-3 py-1 border rounded text-sm cursor-pointer select-none"
      :class="scenario.id === activeId ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'"
      @click="handleSwitch(scenario.id)"
    >
      <!-- 重命名输入框 -->
      <input
        v-if="renamingId === scenario.id"
        :ref="setRenameInput"
        v-focus
        data-test="rename-input"
        type="text"
        class="w-20 border rounded px-1 text-sm text-center"
        :value="renameValue"
        @input="renameValue = ($event.target as HTMLInputElement).value"
        @keyup.enter="confirmRename"
        @keyup.escape="cancelRename"
        @blur="confirmRename"
        @click.stop
      />
      <!-- 方案名显示 -->
      <span
        v-else
        data-test="scenario-name"
        @dblclick.stop="startRename(scenario.id, scenario.name)"
      >
        {{ scenario.name || '未命名' }}
      </span>
      <!-- 删除按钮（仅多方案时显示） -->
      <button
        v-if="scenarios.length > 1"
        type="button"
        data-test="remove-scenario"
        class="text-red-600 opacity-0 group-hover:opacity-100 hover:text-red-800 text-xs ml-1"
        aria-label="删除方案"
        @click.stop="handleRemove(scenario.id, scenario.name)"
      >
        ✕
      </button>
    </div>

    <!-- 操作按钮 -->
    <button
      type="button"
      data-test="add-scenario"
      class="px-2 py-1 text-sm text-blue-600 hover:text-blue-800 border border-dashed rounded"
      title="新建方案"
      @click="handleAdd"
    >
      新建
    </button>
    <button
      type="button"
      data-test="duplicate-scenario"
      class="px-2 py-1 text-sm text-blue-600 hover:text-blue-800 border border-dashed rounded"
      title="复制当前方案"
      @click="handleDuplicate"
    >
      复制
    </button>
  </div>
</template>
