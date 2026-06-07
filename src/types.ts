export interface FlowColumn {
  id: string
  name: string
  entries: Record<number, number>  // 稀疏存储，key=YYYYMM，只存用户手动编辑的值
}

export interface MonthlyAnchor {
  month: number
  actualSavings: number
}

export interface SystemParams {
  startMonth: number
  annualRate: number
}

export interface PlanData {
  version: number
  systemParams: SystemParams
  columns: FlowColumn[]
  anchors: MonthlyAnchor[]
}

export interface MonthResult {
  month: number
  columnValues: { id: string; name: string; amount: number; isEdited: boolean }[]
  totalFlow: number
  investReturn: number
  netSavings: number
  cumSavings: number
  isAnchor: boolean
}
