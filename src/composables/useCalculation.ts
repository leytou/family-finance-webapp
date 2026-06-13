import type { FlowColumn, MonthResult, PlanData, PlanSnapshot } from '../types'
import { addMonths } from '../utils/month'

const PROJECTION_MONTHS = 60

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
 * 计算所有月份的储蓄结果
 * @param plan 计划数据
 * @returns 月度结果数组
 */
export function calculate(plan: PlanData): MonthResult[] {
  const results: MonthResult[] = []

  for (let index = 0; index < PROJECTION_MONTHS; index++) {
    const month = addMonths(plan.systemParams.startMonth, index)

    // 首月 prevCum = 初始存款（起点本金，参与投资收益）；未设置或非法时视为 0
    const prevCum = index === 0
      ? (Number(plan.systemParams.initialDeposit) || 0)
      : results[index - 1].cumSavings

    // 解析各列在该月的值（含禁用列，供月表灰显）
    const columnValues = plan.columns.map(col => resolveColumnValue(col, month))

    // 注入虚拟「专项」列值：该月所有事件求和（仅事件月产生，空月不注入）
    // 事件是脉冲，不经 resolveColumnValue，故不受携带延续影响
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

    // 仅启用列参与统计；缺省(undefined)视为启用
    const activeValues = columnValues.filter(col => col.enabled !== false)

    // 汇总现金流（仅启用列）
    const totalFlow = activeValues.reduce((sum, col) => sum + col.amount, 0)

    // 计算投资收益
    const investReturn = (prevCum * plan.systemParams.annualRate) / 12

    // 计算本月收入（正数现金流合计）和本月支出（负数现金流绝对值合计），仅启用列
    const monthlyIncome = activeValues.reduce((sum, col) => col.amount > 0 ? sum + col.amount : sum, 0)
    const monthlyExpense = activeValues.reduce((sum, col) => col.amount < 0 ? sum + Math.abs(col.amount) : sum, 0)

    // 计算本月结余
    const monthlyBalance = totalFlow + investReturn

    // 查找锚点
    const anchor = plan.anchors.find(item => item.month === month)

    // 计算月末存款
    const cumSavings = anchor ? anchor.actualSavings : prevCum + monthlyBalance

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
  expense: number     // 该自然年 monthlyExpense 求和（正数；绘制时取负）
  cumSavings: number  // 该自然年最后一月的 cumSavings（年末存款）
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
    }))
}
