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
    <!-- 触发按钮：统一输入框/按钮风格 -->
    <button
      class="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink hover:bg-surface-2"
      type="button"
      @click="toggleMenu"
    >
      更多
    </button>
    <!-- 下拉菜单：统一浮窗外壳规范（绝对定位逻辑不动） -->
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 min-w-32 overflow-hidden rounded-xl border border-line bg-surface py-1 text-[11px] text-ink shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)] z-50"
    >
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2"
        @click="handleExport"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-middle"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        导出数据
      </button>
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2"
        @click="triggerImport"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-middle"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        导入数据
      </button>
      <div class="my-1 border-t border-line-soft" />
      <button
        type="button"
        class="block w-full px-3 py-1 text-left whitespace-nowrap text-ink-2 hover:bg-surface-2"
        @click="handleReset"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="inline-block align-middle"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        重置数据
      </button>
    </div>
    <!-- 导入状态提示：保留 success/danger 语义色 -->
    <div
      v-if="importStatus"
      class="absolute right-0 top-full mt-1 px-3 py-1 rounded-lg text-[11px] shadow-[0_18px_50px_-20px_rgba(26,34,51,0.25)] z-50 border"
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
