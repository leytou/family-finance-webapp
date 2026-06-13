import type { Workspace } from '../types'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const STORAGE_KEY = 'family-finance-plan'

interface ExportPayload {
  exportVersion: number
  exportTime: string
  data: Workspace
}

interface ExportResult {
  success: boolean
  error?: string
}

interface ImportResult {
  success: boolean
  error?: string
}

export function useFileIO() {
  function exportData(): ExportResult {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { success: false, error: '无数据可导出' }
      }

      const workspace: Workspace = JSON.parse(raw)
      const payload: ExportPayload = {
        exportVersion: 1,
        exportTime: new Date().toISOString(),
        data: workspace,
      }

      const json = JSON.stringify(payload, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const now = new Date()
      const dateStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('')

      const link = document.createElement('a')
      link.href = url
      link.download = `family-finance-plan-${dateStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true }
    } catch {
      return { success: false, error: '导出失败' }
    }
  }

  async function importData(file: File): Promise<ImportResult> {
    try {
      const text = await readFileAsText(file)

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return { success: false, error: '文件内容无法解析，请选择有效的 JSON 文件' }
      }

      if (!isObject(parsed) || typeof parsed.exportVersion !== 'number' || !isObject(parsed.data)) {
        return { success: false, error: '文件格式不正确，缺少必需字段' }
      }

      const data = parsed.data
      if (
        !isObject(data) ||
        data.version !== 1 ||
        !Array.isArray(data.scenarios) ||
        data.scenarios.length === 0 ||
        typeof data.activeId !== 'string'
      ) {
        return { success: false, error: '数据结构不完整或版本不兼容' }
      }

      for (const scenario of data.scenarios) {
        if (
          !isObject(scenario) ||
          typeof scenario.id !== 'string' ||
          typeof scenario.name !== 'string' ||
          !isObject(scenario.plan)
        ) {
          return { success: false, error: '数据结构不完整：方案格式错误' }
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

      return { success: true }
    } catch {
      return { success: false, error: '导入失败' }
    }
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }

  return { exportData, importData }
}
