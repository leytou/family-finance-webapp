export function addMonths(yyyymm: number, offset: number): number {
  const year = Math.floor(yyyymm / 100)
  const month = yyyymm % 100
  const zeroBasedMonth = year * 12 + month - 1 + offset
  const nextYear = Math.floor(zeroBasedMonth / 12)
  const nextMonth = (zeroBasedMonth % 12) + 1

  return nextYear * 100 + nextMonth
}

export function monthRange(start: number, end: number): number[] {
  const months: number[] = []

  for (let month = start; compareMonth(month, end) <= 0; month = addMonths(month, 1)) {
    months.push(month)
  }

  return months
}

export function isInRange(month: number, start: number, end: number): boolean {
  return compareMonth(month, start) >= 0 && compareMonth(month, end) <= 0
}

export function compareMonth(a: number, b: number): number {
  return a - b
}

export function formatMonth(yyyymm: number): string {
  const year = Math.floor(yyyymm / 100)
  const month = String(yyyymm % 100).padStart(2, '0')

  return `${year}-${month}`
}

export function getCurrentMonth(): number {
  const now = new Date()

  return now.getFullYear() * 100 + now.getMonth() + 1
}

/**
 * 是否为合法的 6 位整数 YYYYMM（年份隐含 1000–9999）。
 * 仅校验位数；月份越界（如 13 月、0 月）交给 normalizeMonth 进位处理。
 */
export function isValidYyyyMm(value: number): boolean {
  return Number.isInteger(value) && value >= 100000 && value <= 999999
}

/**
 * 规范化 YYYYMM：6 位整数则按「年*12+月」原地进位（202613→202701、202600→202512），否则返回 null。
 * 复用 addMonths(offset=0) 实现原地进位，保证与全项目进位规则一致。
 */
export function normalizeMonth(value: number): number | null {
  return isValidYyyyMm(value) ? addMonths(value, 0) : null
}

/**
 * YYYYMM → 「2026年1月」中文友好格式（紧凑显示与面板头部共用）。
 * 与 formatMonth（YYYY-MM）并存：快照名等仍用 formatMonth。
 */
export function formatMonthZh(yyyymm: number): string {
  const year = Math.floor(yyyymm / 100)
  const month = yyyymm % 100
  return `${year}年${month}月`
}
