// 单笔明细（动态列专用；按月存于 FlowColumn.itemSets 一组中）
export interface ColumnItem {
  id: string
  name: string      // 可空；单值列那笔 name=''，明细列可填
  amount: number    // 元；正=收入，负=支出
}

export interface FlowColumn {
  id: string
  name: string
  itemSets: Record<number, ColumnItem[]>   // key=YYYYMM，value=该月手填明细组（单值=一组一笔）
  yearlyMonths?: Record<number, true>      // 标记月：整组只算当月、不参与往后延续
  enabled?: boolean                        // 缺省/true=启用；false=禁用（不计统计，灰显）
  mode?: 'single' | 'detail'               // 缺省/'single'=单值；'detail'=明细列（仅控制 UI）
}

// 单月一次性大额收支（买房、生育、换车、择校费……）
export interface MilestoneEvent {
  id: string
  name: string      // 如"买房"
  month: number     // YYYYMM
  amount: number    // 元；正=收入（如奖金/卖房），负=支出（如买房）
}

// 单月一次性公积金提取（买房首付等）：从公积金账户转出到可支配储蓄
export interface FundWithdrawal {
  id: string
  name: string        // 如「买房提取」
  month: number       // YYYYMM
  amount: number      // 元，正数
}

// 公积金账户余额锚点（校验用，同 MonthlyAnchor 语义）
export interface FundAnchor {
  month: number
  actualBalance: number
}

// 公积金配置（PlanData.fund，可选；缺失=无公积金）
export interface FundConfig {
  mortgage: FlowColumn        // 房贷月供（专区固定列，进可支配支出 totalFlow）
  contribution: FlowColumn    // 公积金缴存（稀疏+yearly，进公积金账户）
  monthlyOffset: FlowColumn   // 公积金月冲（稀疏+yearly；未手填时默认取 mortgage 同月值）
  withdrawals: FundWithdrawal[]   // 单月提取
  anchors: FundAnchor[]           // 公积金余额锚点
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
  endMonth: number              // 规划结束月（YYYYMM，绝对）；期限 = monthDiff(startMonth, endMonth) + 1
  annualRate: number
  initialDeposit?: number   // 初始存款（元），作为累计计算的起点本金；缺失视为 0
  fundRate: number            // 公积金年利率，默认 0.015
  fundInterestMonth: number   // 公积金结息月 1-12，默认 7
  fundInitialBalance?: number // 初始公积金余额（元），缺失视为 0
}

export interface PlanData {
  version: number
  systemParams: SystemParams
  columns: FlowColumn[]
  anchors: MonthlyAnchor[]
  snapshots: PlanSnapshot[]
  events: MilestoneEvent[]   // 单月一次性大额事件；脉冲，不携带延续
  fund?: FundConfig          // 公积金配置；缺失=无公积金，向后兼容
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
  // —— 公积金账户（无 fund 时均为 0/false）——
  fundBalance: number       // 月末公积金账户余额
  fundInterest: number      // 当月入账结息（仅结息月非 0）
  fundContribution: number  // 当月缴存额（展示用）
  fundOffset: number        // 当月月冲额（实际扣取，已截断）
  fundOffsetShortfall: number  // 房贷月供 − 公积金实际月冲（≥0）：月冲没冲满、改由可支配存款承担的部分
  fundWithdrawal: number    // 当月提取额（实际扣取，已截断）
  fundOutflow: number       // 当月转出到可支配合计 = fundOffset + fundWithdrawal
  isFundAnchor: boolean     // 该月公积金余额是否被锚点覆盖
  totalAssets: number       // = cumSavings + fundBalance
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
  yearIncome: number        // 该自然年各月 monthlyIncome 求和
  yearExpense: number       // 该自然年各月 monthlyExpense 求和
  yearBalance: number
  endSavings: number
  fundBalance?: number   // 年末公积金余额（fund 启用时）
  totalAssets?: number   // 年末总资产（fund 启用时）
  yearMortgage?: number   // 年度房贷月供合计（公积金专区列，未计入 columnSummaries；负数=支出）
  yearFundInflow?: number // 年度公积金转入可支配合计（月冲 + 提取；正数）
}
