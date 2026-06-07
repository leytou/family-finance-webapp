import type { FlowColumn, MonthResult, PlanData } from '../types'
import { addMonths } from '../utils/month'

const PROJECTION_MONTHS = 60

/**
 * 解析某列在指定月份的显示值
 * @param column 现金流列
 * @param month 当前月（YYYYMM格式）
 * @returns 列值信息
 */
export function resolveColumnValue(
  column: FlowColumn,
  month: number,
): { id: string; name: string; amount: number; isEdited: boolean } {
  // 规则1: 若该月存在编辑值，直接返回
  if (month in column.entries) {
    return {
      id: column.id,
      name: column.name,
      amount: column.entries[month],
      isEdited: true,
    }
  }

  // 规则2: 向前查找最近的 entry（key < month）
  const entryKeys = Object.keys(column.entries).map(Number).filter(key => key < month)

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
    }
  }

  // 规则3: 未找到任何 entry → 显示 0
  return {
    id: column.id,
    name: column.name,
    amount: 0,
    isEdited: false,
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

    // 首月 prevCum = 0（无 currentSavings，靠锚点设置初始值）
    const prevCum = index === 0 ? 0 : results[index - 1].cumSavings

    // 解析各列在该月的值
    const columnValues = plan.columns.map(col => resolveColumnValue(col, month))

    // 汇总现金流
    const totalFlow = columnValues.reduce((sum, col) => sum + col.amount, 0)

    // 计算投资收益
    const investReturn = (prevCum * plan.systemParams.annualRate) / 12

    // 计算净储蓄
    const netSavings = totalFlow + investReturn

    // 查找锚点
    const anchor = plan.anchors.find(item => item.month === month)

    // 计算累计储蓄
    const cumSavings = anchor ? anchor.actualSavings : prevCum + netSavings

    results.push({
      month,
      columnValues,
      totalFlow,
      investReturn,
      netSavings,
      cumSavings,
      isAnchor: Boolean(anchor),
    })
  }

  return results
}
