import type { FlowColumn, FundConfig, MonthResult, PlanData, PlanSnapshot } from '../types'
import { addMonths, projectionMonths } from '../utils/month'

// 虚拟「专项」列值在 columnValues 中的固定 id（事件求和注入；非真实 FlowColumn）
const EVENT_COLUMN_ID = '__events__'

/**
 * 解析某列在指定月份的显示值
 * @param column 现金流列
 * @param month 当前月（YYYYMM格式）
 * @returns 列值信息（含 enabled 标记，供统计过滤与年表过滤）
 */
export function resolveColumnValue(
  column: FlowColumn,
  month: number,
): { id: string; name: string; amount: number; isEdited: boolean; enabled: boolean } {
  const enabled = column.enabled !== false   // undefined / true → 启用；仅 false → 禁用

  // 规则1: 若该月存在编辑值，直接返回
  // 注意：entries 的键在 JavaScript 中是字符串，所以需要用 String(month) 检查
  const monthKey = String(month)
  if (monthKey in column.entries) {
    return {
      id: column.id,
      name: column.name,
      amount: column.entries[month],
      isEdited: true,
      enabled,
    }
  }

  // 规则2: 向前查找最近的 entry（key < month），跳过被标记为 yearly 的月
  // yearly 月是脉冲项，不向前延续；否则其后所有月会被错误蔓延
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.entries)
    .map(Number)
    .filter(key => key < month && !isYearlyKey(key))

  if (entryKeys.length > 0) {
    // 找到最近的 entry（最大的 key）
    const mostRecentKey = Math.max(...entryKeys)
    const inheritedValue = column.entries[mostRecentKey]

    // 找到且值非零 → 延续该值
    // 找到且值为 0 → 显示 0
    // 两种情况都标记为非编辑状态
    return {
      id: column.id,
      name: column.name,
      amount: inheritedValue,
      isEdited: false,
      enabled,
    }
  }

  // 规则3: 未找到任何 entry → 显示 0
  return {
    id: column.id,
    name: column.name,
    amount: 0,
    isEdited: false,
    enabled,
  }
}

/**
 * 判断某列在指定月是否有「用户输入值」（直接编辑或向前延续，含 0）。
 * 区别于 resolveColumnValue 的「规则3 无任何 entry 返回 0」：本函数在那种情况下返回 false。
 * 供月冲默认联动判定（未手填月冲时回退到房贷月供）。
 */
export function hasColumnValue(column: FlowColumn, month: number): boolean {
  // 直接编辑值
  if (String(month) in column.entries) return true

  // 向前查找最近的非 yearly entry（与 resolveColumnValue 规则2 一致）
  const isYearlyKey = (k: number) => Boolean(column.yearlyMonths?.[k])
  const entryKeys = Object.keys(column.entries)
    .map(Number)
    .filter(key => key < month && !isYearlyKey(key))
  return entryKeys.length > 0
}

/**
 * 解析月冲在指定月的「目标值」：月冲有用户输入（直接编辑或延续）则用之，
 * 否则默认取房贷月供（mortgage）同月解析值（自动全额抵扣房贷）。
 * 注意：月冲目标值是「拟抵扣金额」，取绝对值——房贷月供在可支配账户按支出记账为负数，
 * 但月冲抵扣额本身是一个正数量（processFund 用 min 截断到余额）。
 */
export function resolveFundOffset(fund: FundConfig, month: number): number {
  if (hasColumnValue(fund.monthlyOffset, month)) {
    return Math.abs(resolveColumnValue(fund.monthlyOffset, month).amount)
  }
  return Math.abs(resolveColumnValue(fund.mortgage, month).amount)
}

/** processFund 单月公积金处理结果 */
export interface FundMonthResult {
  fundBalance: number
  fundInterest: number
  fundContribution: number
  fundOffset: number
  fundWithdrawal: number
  fundOutflow: number
  isFundAnchor: boolean
  nextAccrual: number   // 传给下月的应计利息
}

/**
 * 处理单月公积金账户：缴存 → 提取 → 月冲 → 结息 → 锚点覆盖。
 */
export function processFund(
  fund: FundConfig,
  month: number,
  prevBalance: number,
  accrual: number,
  fundRate: number,
  fundInterestMonth: number,
): FundMonthResult {
  let balance = prevBalance

  // 缴存
  const contribution = resolveColumnValue(fund.contribution, month).amount
  balance += contribution

  // 提取（逐笔截断）
  let withdrawalOut = 0
  for (const w of fund.withdrawals.filter(w => w.month === month)) {
    const take = Math.min(w.amount, balance)
    balance -= take
    withdrawalOut += take
  }

  // 月冲（默认联动房贷月供，截断到余额）
  const offsetTarget = resolveFundOffset(fund, month)
  const offsetOut = Math.min(offsetTarget, balance)
  balance -= offsetOut

  const fundOutflow = withdrawalOut + offsetOut

  // 结息：按月计提，结息月并入
  let fundInterest = 0
  let nextAccrual = accrual + (balance * fundRate) / 12
  if (month % 100 === fundInterestMonth) {
    balance += nextAccrual
    fundInterest = nextAccrual
    nextAccrual = 0
  }

  // 锚点覆盖
  const anchor = fund.anchors.find(a => a.month === month)
  const isFundAnchor = Boolean(anchor)
  if (anchor) balance = anchor.actualBalance

  return {
    fundBalance: balance,
    fundInterest,
    fundContribution: contribution,
    fundOffset: offsetOut,
    fundWithdrawal: withdrawalOut,
    fundOutflow,
    isFundAnchor,
    nextAccrual,
  }
}

/**
 * 计算所有月份的储蓄结果（双账户：可支配储蓄 + 公积金账户）
 * @param plan 计划数据
 * @returns 月度结果数组
 */
export function calculate(plan: PlanData): MonthResult[] {
  const results: MonthResult[] = []
  const fund = plan.fund
  const fundRate = plan.systemParams.fundRate ?? 0
  const fundInterestMonth = plan.systemParams.fundInterestMonth ?? 7
  const fundInitialBalance = Number(plan.systemParams.fundInitialBalance) || 0
  let fundAccrual = 0 // 公积金应计利息，跨月维护

  // 期限由 startMonth + endMonth 动态决定；endMonth 缺失兜底为 5 年，clamp 到 [1, 360]
  const start = plan.systemParams.startMonth
  const end = Number.isFinite(plan.systemParams.endMonth) ? plan.systemParams.endMonth : addMonths(start, 59)
  const totalMonths = projectionMonths(start, end)

  for (let index = 0; index < totalMonths; index++) {
    const month = addMonths(start, index)

    // —— 可支配部分 ——
    const prevCum = index === 0
      ? (Number(plan.systemParams.initialDeposit) || 0)
      : results[index - 1].cumSavings

    const columnValues = plan.columns.map(col => resolveColumnValue(col, month))

    // 注入虚拟「专项」列值
    const monthEvents = plan.events.filter(e => e.month === month)
    if (monthEvents.length > 0) {
      const eventsNet = monthEvents.reduce((sum, e) => sum + e.amount, 0)
      columnValues.push({
        id: EVENT_COLUMN_ID,
        name: '专项',
        amount: eventsNet,
        isEdited: false,
        enabled: true,
      })
    }

    // 房贷月供纳入可支配统计（不出现在 columnValues，专区单独渲染）
    const mortgageValue = fund ? resolveColumnValue(fund.mortgage, month).amount : 0

    const activeValues = columnValues.filter(col => col.enabled !== false)
    const totalFlow = activeValues.reduce((sum, col) => sum + col.amount, 0) + mortgageValue
    const investReturn = (prevCum * plan.systemParams.annualRate) / 12
    // 现金流正负项分流（房贷由公积金专区 shortfall 单独计入支出，不再并入此处）
    const flowIncome = activeValues.reduce((sum, col) => col.amount > 0 ? sum + col.amount : sum, 0)
    const flowExpense = activeValues.reduce((sum, col) => col.amount < 0 ? sum + Math.abs(col.amount) : sum, 0)

    // —— 公积金部分 ——
    let fundBalance = 0, fundInterest = 0, fundContribution = 0
    let fundOffset = 0, fundOffsetShortfall = 0, fundWithdrawal = 0, fundOutflow = 0, isFundAnchor = false
    if (fund) {
      const prevFundBalance = index === 0 ? fundInitialBalance : results[index - 1].fundBalance
      const fr = processFund(fund, month, prevFundBalance, fundAccrual, fundRate, fundInterestMonth)
      fundAccrual = fr.nextAccrual
      fundBalance = fr.fundBalance
      fundInterest = fr.fundInterest
      fundContribution = fr.fundContribution
      fundOffset = fr.fundOffset
      fundWithdrawal = fr.fundWithdrawal
      fundOutflow = fr.fundOutflow
      isFundAnchor = fr.isFundAnchor
      // 房贷月供中公积金月冲没冲满、改由可支配存款承担的缺口（≥0）
      fundOffsetShortfall = Math.max(0, Math.abs(mortgageValue) - fundOffset)
    }

    // —— 汇总（新口径：收入含理财+公积金提取+月冲超额，支出含存款补扣，结余=收入−支出）——
    // 月冲超出房贷月供的部分（手填月冲 > 房贷时）等同一笔转入可支配，计入收入，
    // 使 cumSavings 与旧口径 totalFlow + investReturn + fundOutflow 对所有输入完全一致
    const offsetSurplus = fund ? Math.max(0, fundOffset - Math.abs(mortgageValue)) : 0
    const monthlyIncome = flowIncome + investReturn + fundWithdrawal + offsetSurplus
    const monthlyExpense = flowExpense + fundOffsetShortfall
    const monthlyBalance = monthlyIncome - monthlyExpense
    const anchor = plan.anchors.find(item => item.month === month)
    const cumSavings = anchor ? anchor.actualSavings : prevCum + monthlyBalance
    const totalAssets = cumSavings + fundBalance

    results.push({
      month,
      columnValues,
      totalFlow,
      investReturn,
      monthlyIncome,
      monthlyExpense,
      monthlyBalance,
      cumSavings,
      isAnchor: Boolean(anchor),
      fundBalance,
      fundInterest,
      fundContribution,
      fundOffset,
      fundOffsetShortfall,
      fundWithdrawal,
      fundOutflow,
      isFundAnchor,
      totalAssets,
    })
  }

  return results
}

export interface SnapshotComparison {
  month: number
  predicted: number | null   // 该月当时预计；快照无该月则 null
  actual: number             // 实际/当前累计（= MonthResult.cumSavings）
  diff: number | null        // actual - predicted；仅当该月 isAnchor 且 predicted 非空时有值
}

/**
 * 把选中的计划快照叠加到月度结果，逐月给出预计/实际/差额。
 * @param results 当前计算出的月度结果
 * @param snapshot 选中的计划快照；null 表示未选中
 */
export function buildComparison(
  results: MonthResult[],
  snapshot: PlanSnapshot | null,
): SnapshotComparison[] {
  return results.map(r => {
    const predicted =
      snapshot && r.month in snapshot.projection ? snapshot.projection[r.month] : null
    const diff =
      predicted !== null && r.isAnchor ? r.cumSavings - predicted : null
    return {
      month: r.month,
      predicted,
      actual: r.cumSavings,
      diff,
    }
  })
}

export interface YearlyPoint {
  year: number
  income: number      // 该自然年 monthlyIncome 求和
  expense: number     // 该自然年 monthlyExpense 求和（正数）
  cumSavings: number  // 该自然年最后一月的 cumSavings（年末存款）
  totalAssets: number // 该自然年最后一月的 totalAssets（年末总资产）
  fundBalance: number // 该自然年最后一月的 fundBalance（年末公积金）
}

/**
 * 按自然年聚合月度结果，供图表「按年」粒度使用。
 * 口径与 AnnualTable 一致：Math.floor(month/100) 分组，年末取该年最后一月 cumSavings。
 */
export function aggregateByYear(results: MonthResult[]): YearlyPoint[] {
  const sorted = [...results].sort((left, right) => left.month - right.month)
  const groups = new Map<number, MonthResult[]>()

  for (const result of sorted) {
    const year = Math.floor(result.month / 100)
    const arr = groups.get(year)
    if (arr) {
      arr.push(result)
    } else {
      groups.set(year, [result])
    }
  }

  return Array.from(groups.entries())
    .sort(([leftYear], [rightYear]) => leftYear - rightYear)
    .map(([year, months]) => ({
      year,
      income: months.reduce((sum, r) => sum + r.monthlyIncome, 0),
      expense: months.reduce((sum, r) => sum + r.monthlyExpense, 0),
      cumSavings: months[months.length - 1].cumSavings,
      totalAssets: months[months.length - 1].totalAssets,
      fundBalance: months[months.length - 1].fundBalance,
    }))
}
