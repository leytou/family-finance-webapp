import { describe, expect, it } from 'vitest'

import { calculate } from '../../src/composables/useCalculation'
import type { PlanData } from '../../src/types'

function makePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    version: 1,
    systemParams: {
      currentSavings: 100000,
      startMonth: 202601,
      annualRate: 0,
    },
    items: [],
    anchors: [],
    ...overrides,
  }
}

describe('calculate', () => {
  it('returns 60 months with unchanged savings when there are no income or expense items', () => {
    const results = calculate(makePlan())

    expect(results).toHaveLength(60)
    expect(results[0]).toMatchObject({
      month: 202601,
      incomeItems: [],
      expenseItems: [],
      totalIncome: 0,
      totalExpense: 0,
      investReturn: 0,
      netSavings: 0,
      cumSavings: 100000,
      isAnchor: false,
    })
    expect(results[59]).toMatchObject({
      month: 203012,
      cumSavings: 100000,
    })
  })

  it('adds a single income item to monthly income, net savings, and cumulative savings', () => {
    const results = calculate(
      makePlan({
        items: [
          {
            id: 'salary',
            name: 'Salary',
            type: 'income',
            segments: [{ amount: 10000, startMonth: 202601, endMonth: 203012 }],
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      incomeItems: [{ name: 'Salary', amount: 10000 }],
      expenseItems: [],
      totalIncome: 10000,
      totalExpense: 0,
      netSavings: 10000,
      cumSavings: 110000,
    })
    expect(results[1]).toMatchObject({
      totalIncome: 10000,
      netSavings: 10000,
      cumSavings: 120000,
    })
  })

  it('combines income and expense items into totals, net savings, and cumulative savings', () => {
    const results = calculate(
      makePlan({
        items: [
          {
            id: 'salary',
            name: 'Salary',
            type: 'income',
            segments: [{ amount: 10000, startMonth: 202601, endMonth: 203012 }],
          },
          {
            id: 'rent',
            name: 'Rent',
            type: 'expense',
            segments: [{ amount: 3000, startMonth: 202601, endMonth: 203012 }],
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      incomeItems: [{ name: 'Salary', amount: 10000 }],
      expenseItems: [{ name: 'Rent', amount: 3000 }],
      totalIncome: 10000,
      totalExpense: 3000,
      netSavings: 7000,
      cumSavings: 107000,
    })
    expect(results[1]).toMatchObject({
      totalIncome: 10000,
      totalExpense: 3000,
      netSavings: 7000,
      cumSavings: 114000,
    })
  })

  it('calculates investment return recursively from previous cumulative savings', () => {
    const results = calculate(
      makePlan({
        systemParams: {
          currentSavings: 120000,
          startMonth: 202601,
          annualRate: 0.12,
        },
      }),
    )

    expect(results[0].investReturn).toBe(1200)
    expect(results[0].cumSavings).toBe(121200)
    expect(results[1].investReturn).toBeCloseTo(1212)
  })

  it('overwrites cumulative savings with monthly anchors and continues from the anchor value', () => {
    const results = calculate(
      makePlan({
        items: [
          {
            id: 'salary',
            name: 'Salary',
            type: 'income',
            segments: [{ amount: 10000, startMonth: 202601, endMonth: 203012 }],
          },
        ],
        anchors: [{ month: 202603, actualSavings: 200000 }],
      }),
    )

    expect(results[2]).toMatchObject({
      month: 202603,
      cumSavings: 200000,
      isAnchor: true,
    })
    expect(results[3]).toMatchObject({
      month: 202604,
      cumSavings: 210000,
      isAnchor: false,
    })
  })

  it('uses later matching segments when multiple segments are active in the same month', () => {
    const results = calculate(
      makePlan({
        items: [
          {
            id: 'salary',
            name: 'Salary',
            type: 'income',
            segments: [
              { amount: 10000, startMonth: 202601, endMonth: 203012 },
              { amount: 15000, startMonth: 202607, endMonth: 203012 },
            ],
          },
        ],
      }),
    )

    expect(results[0].totalIncome).toBe(10000)
    expect(results[5].totalIncome).toBe(10000)
    expect(results[6].totalIncome).toBe(15000)
  })
})
