export interface FlowColumn {
  id: string
  name: string
  entries: Record<number, number>          // 稀疏存储，key=YYYYMM，只存用户手动编辑的值
  yearlyMonths?: Record<number, true>      // 标记哪些月是「年度重复项」(key=YYYYMM，存在即标记)；标记月不向前延续
  enabled?: boolean                        // 缺省(undefined)/true=启用；false=禁用（不计入统计，数值仍灰显）
}

// 单月一次性大额收支（买房、生育、换车、择校费……）
export interface MilestoneEvent {
  id: string
  name: string      // 如"买房"
  month: number     // YYYYMM
  amount: number    // 元；正=收入（如奖金/卖房），负=支出（如买房）
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
  events: MilestoneEvent[]   // 单月一次性大额事件；脉冲，不携带延续
}

export interface MonthResult {
  month: number
  columnValues: { id: string; name: string; amount: number; isEdited: boolean; enabled?: boolean }[]
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

export interface ColumnSummary {
  name: string
  total: number
}

export interface YearSummary {
  year: number
  startSavings: number
  columnSummaries: ColumnSummary[]
  totalFlow: number
  investReturn: number
  yearBalance: number
  endSavings: number
}
