export interface AmountSegment {
  amount: number
  startMonth: number
  endMonth: number
}

export interface CashFlowItem {
  id: string
  name: string
  type: 'income' | 'expense'
  segments: AmountSegment[]
}

export interface MonthlyAnchor {
  month: number
  actualSavings: number
}

export interface SystemParams {
  currentSavings: number
  startMonth: number
  annualRate: number
}

export interface PlanData {
  version: number
  systemParams: SystemParams
  items: CashFlowItem[]
  anchors: MonthlyAnchor[]
}

export interface MonthResult {
  month: number
  incomeItems: { name: string; amount: number }[]
  expenseItems: { name: string; amount: number }[]
  totalIncome: number
  totalExpense: number
  investReturn: number
  netSavings: number
  cumSavings: number
  isAnchor: boolean
}
