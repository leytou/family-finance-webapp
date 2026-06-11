export interface FlowColumn {
  id: string
  name: string
  entries: Record<number, number>  // 稀疏存储，key=YYYYMM，只存用户手动编辑的值
}

export interface MonthlyAnchor {
  month: number
  actualSavings: number
}

export interface PlanSnapshot {
  id: string
  name: string                          // 默认「YYYY-MM 计划」，可重命名
  createdMonth: number                  // 封存时的系统当前月（YYYYMM）
  projection: Record<number, number>    // 稀疏存储：key=YYYYMM，value=该月计划累计储蓄
}

export interface SystemParams {
  startMonth: number
  annualRate: number
  initialDeposit?: number   // 初始存款（元），作为累计计算的起点本金；缺失视为 0
}

export interface PlanData {
  version: number
  systemParams: SystemParams
  columns: FlowColumn[]
  anchors: MonthlyAnchor[]
  snapshots: PlanSnapshot[]
}

export interface MonthResult {
  month: number
  columnValues: { id: string; name: string; amount: number; isEdited: boolean }[]
  totalFlow: number
  investReturn: number
  monthlyIncome: number
  monthlyExpense: number
  monthlyBalance: number
  cumSavings: number
  isAnchor: boolean
}

export interface Scenario {
  id: string
  name: string        // 如「买房方案」「租房方案」
  plan: PlanData      // 完整独立副本，含各自的现金流列、锚点、系统参数
}

export interface Workspace {
  version: number
  scenarios: Scenario[]
  activeId: string    // 当前激活（查看/编辑）的方案 id
}
