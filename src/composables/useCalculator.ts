import { ref, watch, type Ref } from 'vue'

import { MORTGAGE_TERMS, type MortgageTerm } from '../utils/calculator'

const STORAGE_KEY = 'family-finance-calculator'
let sharedState: Ref<CalculatorState> | null = null
let saveTimeout: ReturnType<typeof setTimeout> | null = null

export interface CalculatorState {
  version: number
  loanAmount: number
  rates: Record<MortgageTerm, number>
  fundBase: number
  personalRate: number
  employerRate: number
}

function createDefault(): CalculatorState {
  const rates = {} as Record<MortgageTerm, number>
  for (const t of MORTGAGE_TERMS) rates[t] = 0
  return {
    version: 1,
    loanAmount: 0,
    rates,
    fundBase: 0,
    personalRate: 0,
    employerRate: 0,
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidState(value: unknown): value is CalculatorState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.version !== 1) return false
  if (!isFiniteNumber(v.loanAmount)) return false
  if (!isFiniteNumber(v.fundBase)) return false
  if (!isFiniteNumber(v.personalRate)) return false
  if (!isFiniteNumber(v.employerRate)) return false
  if (typeof v.rates !== 'object' || v.rates === null) return false
  const rates = v.rates as Record<string, unknown>
  for (const t of MORTGAGE_TERMS) {
    if (!isFiniteNumber(rates[t])) return false
  }
  return true
}

// 合法存档重建为完整 CalculatorState（防止多余/缺键）；非法回退默认
function normalizeState(value: unknown): CalculatorState {
  if (isValidState(value)) {
    const rates = {} as Record<MortgageTerm, number>
    for (const t of MORTGAGE_TERMS) rates[t] = value.rates[t]
    return {
      version: 1,
      loanAmount: value.loanAmount,
      rates,
      fundBase: value.fundBase,
      personalRate: value.personalRate,
      employerRate: value.employerRate,
    }
  }
  // 同上：坏档不立即写盘，见 loadState
  return createDefault()
}

function loadState(): CalculatorState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createDefault()
  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    // 坏档不立即写盘：首次有效写入或页面卸载时自然落盘；与 useStore 不同（useStore 需抹平旧格式迁移痕迹），calculator 无迁移需求
    return createDefault()
  }
}

export function useCalculator() {
  if (!sharedState) {
    sharedState = ref<CalculatorState>(loadState())
    watch(
      sharedState,
      () => {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState?.value))
          saveTimeout = null
        }, 300)
      },
      { deep: true },
    )
  }

  // 非法（NaN/Infinity）归 0；负数原样存（显示层 calc 统一按 0 参与计算）
  function setLoanAmount(v: number) {
    sharedState!.value.loanAmount = Number.isFinite(v) ? v : 0
  }
  function setRate(term: MortgageTerm, v: number) {
    sharedState!.value.rates[term] = Number.isFinite(v) ? v : 0
  }
  function setFundBase(v: number) {
    sharedState!.value.fundBase = Number.isFinite(v) ? v : 0
  }
  function setPersonalRate(v: number) {
    sharedState!.value.personalRate = Number.isFinite(v) ? v : 0
  }
  function setEmployerRate(v: number) {
    sharedState!.value.employerRate = Number.isFinite(v) ? v : 0
  }
  function save() {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState!.value))
  }

  return {
    state: sharedState,
    setLoanAmount,
    setRate,
    setFundBase,
    setPersonalRate,
    setEmployerRate,
    save,
  }
}
