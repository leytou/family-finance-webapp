<script setup lang="ts">
import { ref } from 'vue'
import { useClickOutside } from '../composables/useClickOutside'
import { useFileIO } from '../composables/useFileIO'
import { useHistory } from '../composables/useHistory'
import { useStore } from '../composables/useStore'

const { workspace, reloadWorkspace, reset } = useStore()
const { exportData, importData } = useFileIO()
const { resetHistory } = useHistory()

const open = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// 导入状态反馈
const importStatus = ref<{ success: boolean; message: string } | null>(null)

useClickOutside(menuRef, () => {
  open.value = false
})

function toggleMenu() {
  open.value = !open.value
}

function handleExport() {
  open.value = false
  const result = exportData()
  if (!result.success) {
    alert(result.error)
  }
}

function triggerImport() {
  open.value = false
  fileInputRef.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 清空 input value 以支持重复选择同一文件
  input.value = ''

  if (!window.confirm('导入将替换当前所有数据，确定继续吗？')) {
    return
  }

  const result = await importData(file)
  if (result.success) {
    // 导入成功，刷新内存中的 workspace（此时 workspace.value 已替换为新数据）
    reloadWorkspace()
    // 重置撤销历史：以新导入数据作为基线，清空过去/未来栈，
    // 并清掉 reloadWorkspace 触发的捕获定时器，避免 Ctrl+Z 撤销整个导入
    resetHistory(JSON.stringify(workspace.value))
    importStatus.value = { success: true, message: '导入成功' }
  } else {
    importStatus.value = { success: false, message: result.error ?? '导入失败' }
  }

  // 3 秒后自动清除状态提示
  setTimeout(() => {
    importStatus.value = null
  }, 3000)
}

function handleReset() {
  open.value = false
  if (window.confirm('确定要重置当前方案？')) {
    reset()
  }
}
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      class="px-2 py-1 border rounded text-sm hover:bg-neutral-50"
      type="button"
      @click="toggleMenu"
    >
      ⋯
    </button>
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 min-w-32 border rounded bg-white py-1 text-[11px] shadow-lg z-50"
    >
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-neutral-100"
        @click="handleExport"
      >
        📤 导出数据
      </button>
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-neutral-100"
        @click="triggerImport"
      >
        📥 导入数据
      </button>
      <div class="my-1 border-t" />
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap hover:bg-neutral-100"
        @click="handleReset"
      >
        🔄 重置数据
      </button>
    </div>
    <!-- 导入状态提示 -->
    <div
      v-if="importStatus"
      class="absolute right-0 top-full mt-1 px-3 py-1 rounded text-[11px] shadow-lg z-50 border"
      :class="importStatus.success ? 'bg-success-50 text-success-700 border-success-200' : 'bg-danger-50 text-danger-700 border-danger-200'"
    >
      {{ importStatus.message }}
    </div>
    <!-- 隐藏的文件选择 input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleFileChange"
    />
  </div>
</template>
