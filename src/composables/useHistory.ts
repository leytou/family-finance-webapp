import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { Workspace } from '../types'
import { useStore } from './useStore'

const CAPTURE_DELAY = 500
const MAX_HISTORY = 50

// 模块单例状态（与 useStore 的 sharedWorkspace 同构，刷新即清空——仅内存设计）
const past = ref<string[]>([])      // 可撤销的旧状态快照（栈顶 = 最近）
const future = ref<string[]>([])    // 可重做的状态快照
let lastSnapshot = ''               // 上一次「落盘」的检查点快照（= 当前状态基准）
let captureTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false
let workspaceRef: Ref<Workspace> | null = null

// 捕获当前工作区为新检查点。current === lastSnapshot 时跳过：
// 这同时处理了「无变化」和「undo/redo 恢复引发的 watch」（恢复时 lastSnapshot 已设为目标态）
function capture(): void {
  if (!workspaceRef) return
  const current = JSON.stringify(workspaceRef.value)
  if (current === lastSnapshot) return
  past.value.push(lastSnapshot)
  if (past.value.length > MAX_HISTORY) past.value.shift()
  lastSnapshot = current
  future.value = []   // 新编辑作废重做栈
}

// 撤销前调用：把尚未落盘的待捕获编辑立即捕获，避免丢失
function flushPendingCapture(): void {
  if (captureTimer) {
    clearTimeout(captureTimer)
    captureTimer = null
    capture()
  }
}

function restore(json: string): void {
  if (!workspaceRef) return
  workspaceRef.value = JSON.parse(json) as Workspace
}

async function undo(): Promise<void> {
  // 先 flush 刚发生但未触发 watch 的变更（如失焦提交），确保最新编辑进入历史
  await nextTick()
  flushPendingCapture()
  if (past.value.length === 0) return
  const prev = past.value.pop()!
  future.value.push(lastSnapshot)
  lastSnapshot = prev     // 设为目标态，让恢复引发的 watch 捕获时被相等守卫跳过
  restore(prev)
}

async function redo(): Promise<void> {
  await nextTick()
  if (future.value.length === 0) return
  const next = future.value.pop()!
  past.value.push(lastSnapshot)
  lastSnapshot = next     // 设为目标态，与 undo 对称
  restore(next)
}

// 导入数据后的钩子：整体替换工作区后，把历史从新数据起步（past/future 清空）
function resetHistory(workspaceJson: string): void {
  if (captureTimer) {
    clearTimeout(captureTimer)
    captureTimer = null
  }
  past.value = []
  future.value = []
  lastSnapshot = workspaceJson
}

export function useHistory() {
  const { workspace } = useStore()

  if (!initialized) {
    initialized = true
    workspaceRef = workspace
    lastSnapshot = JSON.stringify(workspace.value)   // 加载态作为基线
    watch(
      workspace,
      () => {
        if (captureTimer) clearTimeout(captureTimer)
        captureTimer = setTimeout(() => {
          captureTimer = null
          capture()
        }, CAPTURE_DELAY)
      },
      { deep: true },
    )
  }

  const canUndo: ComputedRef<boolean> = computed(() => past.value.length > 0)
  const canRedo: ComputedRef<boolean> = computed(() => future.value.length > 0)

  return { undo, redo, canUndo, canRedo, resetHistory }
}
