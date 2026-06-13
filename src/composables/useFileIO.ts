import type { Workspace } from '../types'

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

  async function importData(_file: File): Promise<ImportResult> {
    return { success: false, error: '尚未实现' }
  }

  return { exportData, importData }
}
