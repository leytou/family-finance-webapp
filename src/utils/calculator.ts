// 固定贷款期限（年）
export const MORTGAGE_TERMS = [5, 10, 15, 20, 30] as const
export type MortgageTerm = (typeof MORTGAGE_TERMS)[number]

export interface EqualPaymentResult {
  monthlyPayment: number
  totalInterest: number
  totalRepayment: number
}

/**
 * 等额本息月供计算。
 * @param principal 贷款本金（元），非法/负数按 0
 * @param annualRatePct 年利率（百分比，3.5 = 3.5%），非法/负数按 0
 * @param years 期限（年）
 */
export function calcEqualPayment(
  principal: number,
  annualRatePct: number,
  years: number,
): EqualPaymentResult {
  const p = toNonNegFinite(principal)
  const ratePct = toNonNegFinite(annualRatePct)
  const n = Math.round(toNonNegFinite(years)) * 12
  if (n <= 0 || p === 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0 }
  }
  let monthlyPayment: number
  if (ratePct === 0) {
    // 0 利率特例：纯本金分摊，避免除零
    monthlyPayment = p / n
  } else {
    const r = ratePct / 100 / 12
    const factor = Math.pow(1 + r, n)
    monthlyPayment = (p * r * factor) / (factor - 1)
  }
  const totalRepayment = monthlyPayment * n
  const totalInterest = totalRepayment - p
  return { monthlyPayment, totalInterest, totalRepayment }
}

export interface HousingFundResult {
  personal: number
  employer: number
  total: number
  personalRate: number
  employerRate: number
}

/**
 * 公积金每月缴存计算。
 * @param base 缴存基数（元），非法/负数按 0
 * @param personalPct 个人比例（百分比），非法/负数按 0
 * @param employerPct 单位比例（百分比），非法/负数按 0
 */
export function calcHousingFund(
  base: number,
  personalPct: number,
  employerPct: number,
): HousingFundResult {
  const b = toNonNegFinite(base)
  const p = toNonNegFinite(personalPct)
  const e = toNonNegFinite(employerPct)
  const personal = (b * p) / 100
  const employer = (b * e) / 100
  return { personal, employer, total: personal + employer, personalRate: p, employerRate: e }
}

// 非法（NaN/Infinity）/负数统一归 0
function toNonNegFinite(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0
}
