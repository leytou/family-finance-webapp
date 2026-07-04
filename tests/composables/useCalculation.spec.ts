import { describe, expect, it } from 'vitest'
import { calculate, resolveColumnValue, resolveColumnItems, hasColumnValue, resolveFundOffset, buildComparison, aggregateByYear } from '../../src/composables/useCalculation'
import type { PlanData, FlowColumn, MonthResult, PlanSnapshot, FundConfig } from '../../src/types'

function makePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    version: 2,
    systemParams: {
      startMonth: 202601,
      annualRate: 0,
      fundRate: 0,
      fundInterestMonth: 7,
    },
    columns: [],
    corrections: [],
    snapshots: [],
    events: [],
    ...overrides,
  }
}

function makeResult(overrides: Partial<MonthResult> = {}): MonthResult {
  return {
    month: 202601,
    columnValues: [],
    totalFlow: 0,
    investReturn: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    monthlyBalance: 0,
    cumSavings: 0,
    isCorrected: false,
    fundBalance: 0,
    fundInterest: 0,
    fundContribution: 0,
    fundOffset: 0,
    fundWithdrawal: 0,
    fundOutflow: 0,
    isFundCorrected: false,
    totalAssets: 0,
    ...overrides,
  }
}

describe('resolveColumnValue', () => {
  it('直接编辑值标记 isEdited=true，默认 enabled=true', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
    }

    const result = resolveColumnValue(column, 202601)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: true,
      enabled: true,
    })
  })

  it('延续值标记 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
    }

    const result = resolveColumnValue(column, 202602)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
      enabled: true,
    })
  })

  it('未找到任何 entry 时返回 0 且 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: {},
    }

    const result = resolveColumnValue(column, 202601)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
      enabled: true,
    })
  })

  it('entry 为 0 时延续 0 并标记 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }], 202603: [{ id: "i1", name: "", amount: 0 }] },
    }

    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202603)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: true,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
      enabled: true,
    })
  })

  it('0 之后再填非零重新开始延续', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }], 202603: [{ id: "i1", name: "", amount: 0 }], 202606: [{ id: "i1", name: "", amount: 15000 }] },
    }

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202605)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202606)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: true,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202607)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: false,
      enabled: true,
    })
  })

  it('查找最近的 entry（最大的 key）', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }], 202603: [{ id: "i1", name: "", amount: 10000 }], 202605: [{ id: "i1", name: "", amount: 15000 }] },
    }

    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 5000,
      isEdited: false,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
      enabled: true,
    })

    expect(resolveColumnValue(column, 202606)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: false,
      enabled: true,
    })
  })

  it('yearly 标记的月不向前延续，其后非同月归 0', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '年终奖',
      itemSets: { 202612: [{ id: "i1", name: "", amount: 50000 }] },
      yearlyMonths: { 202612: true },
    }

    // 202612 自身：直接 entry
    expect(resolveColumnValue(column, 202612)).toEqual({
      id: 'col1', name: '年终奖', amount: 50000, isEdited: true, enabled: true,
    })
    // 202701：跳过 yearly 的 202612，无源 → 0
    expect(resolveColumnValue(column, 202701)).toEqual({
      id: 'col1', name: '年终奖', amount: 0, isEdited: false, enabled: true,
    })
    // 202706：仍跳过 → 0
    expect(resolveColumnValue(column, 202706)).toEqual({
      id: 'col1', name: '年终奖', amount: 0, isEdited: false, enabled: true,
    })
  })

  it('无 yearlyMonths 字段时延续行为不变（回归）', () => {
    const column: FlowColumn = {
      id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
    }
    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1', name: '工资', amount: 10000, isEdited: false, enabled: true,
    })
  })

  it('yearly 与非 yearly 混合：非 yearly 仍延续，yearly 不作为延续源', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '混合',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }], 202612: [{ id: "i1", name: "", amount: 50000 }] },
      yearlyMonths: { 202612: true },
    }
    // 202602 延续非 yearly 的 202601
    expect(resolveColumnValue(column, 202602).amount).toBe(1000)
    // 202612 自身 yearly 值
    expect(resolveColumnValue(column, 202612).amount).toBe(50000)
    // 202701：跳过 yearly 202612，回退到非 yearly 202601 → 1000
    expect(resolveColumnValue(column, 202701).amount).toBe(1000)
  })

  it('enabled:false 的禁用列仍返回解析值，但 enabled=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '旅游',
      itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }] },
      enabled: false,
    }

    // 直接编辑值：amount 照常返回，仅 enabled 标记为 false
    expect(resolveColumnValue(column, 202601)).toEqual({
      id: 'col1',
      name: '旅游',
      amount: 5000,
      isEdited: true,
      enabled: false,
    })

    // 延续值同理
    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1',
      name: '旅游',
      amount: 5000,
      isEdited: false,
      enabled: false,
    })
  })
})

describe('hasColumnValue', () => {
  it('该月有直接编辑值 → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: { 202601: [{ id: "i1", name: "", amount: 100 }] } }
    expect(hasColumnValue(column, 202601)).toBe(true)
  })

  it('该月向前延续到非零 entry → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: { 202601: [{ id: "i1", name: "", amount: 100 }] } }
    expect(hasColumnValue(column, 202603)).toBe(true)
  })

  it('该月向前延续到 0 entry → true（0 也是有效输入）', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: { 202601: [{ id: "i1", name: "", amount: 0 }] } }
    expect(hasColumnValue(column, 202603)).toBe(true)
  })

  it('完全无任何 entry → false', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: {} }
    expect(hasColumnValue(column, 202601)).toBe(false)
  })

  it('仅有 yearly 标记月、其后非同月 → false（yearly 不作延续源）', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: { 202612: [{ id: "i1", name: "", amount: 500 }] }, yearlyMonths: { 202612: true } }
    expect(hasColumnValue(column, 202701)).toBe(false)
  })

  it('yearly 月本身 → true', () => {
    const column: FlowColumn = { id: 'c1', name: 'x', itemSets: { 202612: [{ id: "i1", name: "", amount: 500 }] }, yearlyMonths: { 202612: true } }
    expect(hasColumnValue(column, 202612)).toBe(true)
  })
})

describe('resolveFundOffset', () => {
  function makeFund(overrides: Partial<FundConfig> = {}): FundConfig {
    return {
      mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }] } },
      contribution: { id: 'c', name: '公积金缴存', itemSets: {} },
      monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
      withdrawals: [],
      corrections: [],
      ...overrides,
    }
  }

  it('月冲未手填 → 默认取房贷月供', () => {
    const fund = makeFund()
    expect(resolveFundOffset(fund, 202601)).toBe(5000)
    expect(resolveFundOffset(fund, 202603)).toBe(5000) // 房贷延续
  })

  it('月冲有直接编辑值 → 用月冲自身值', () => {
    const fund = makeFund({ monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: { 202601: [{ id: "i1", name: "", amount: 3000 }] } } })
    expect(resolveFundOffset(fund, 202601)).toBe(3000)
  })

  it('月冲向前延续 → 用延续值', () => {
    const fund = makeFund({ monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: { 202601: [{ id: "i1", name: "", amount: 3000 }] } } })
    expect(resolveFundOffset(fund, 202603)).toBe(3000)
  })

  it('月冲与房贷都无值 → 0', () => {
    const fund = makeFund({
      mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
    })
    expect(resolveFundOffset(fund, 202601)).toBe(0)
  })
})

describe('calculate', () => {
  it('期限由 endMonth 决定：3 年 = 36 个月', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7, endMonth: 202812 },
      columns: [],
    }))

    expect(results).toHaveLength(36)
    expect(results[0].month).toBe(202601)
    expect(results[35].month).toBe(202812)
  })

  it('endMonth == startMonth 时期限为 1 个月', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7, endMonth: 202601 },
    }))

    expect(results).toHaveLength(1)
    expect(results[0].month).toBe(202601)
  })

  it('endMonth 缺失时兜底为 5 年（60 个月）——兼容无 endMonth 的存量数据', () => {
    const results = calculate(makePlan())

    expect(results).toHaveLength(60)
    expect(results[59].month).toBe(203012)
  })

  it('endMonth 超出 30 年上限时 clamp 到 360 个月', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7, endMonth: 206001 },
    }))

    expect(results).toHaveLength(360)
  })

  it('空 columns 产生 60 个月全零', () => {
    const results = calculate(makePlan())

    expect(results).toHaveLength(60)
    expect(results[0]).toMatchObject({
      month: 202601,
      columnValues: [],
      totalFlow: 0,
      investReturn: 0,
      monthlyBalance: 0,
      cumSavings: 0,
      isCorrected: false,
    })
    expect(results[59]).toMatchObject({
      month: 203012,
      totalFlow: 0,
      investReturn: 0,
      monthlyBalance: 0,
      cumSavings: 0,
    })
  })

  it('单列单 entry 延续到后续月份', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      month: 202601,
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
      totalFlow: 10000,
      monthlyBalance: 10000,
      cumSavings: 10000,
    })

    expect(results[1]).toMatchObject({
      month: 202602,
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: false }],
      totalFlow: 10000,
      monthlyBalance: 10000,
      cumSavings: 20000,
    })

    expect(results[5]).toMatchObject({
      month: 202606,
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: false }],
      totalFlow: 10000,
      monthlyBalance: 10000,
      cumSavings: 60000,
    })
  })

  it('entry 为 0 终止延续（后续月份显示 0）', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }], 202604: [{ id: "i1", name: "", amount: 0 }] },
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: true }],
      totalFlow: 10000,
      cumSavings: 10000,
    })

    expect(results[1]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: false }],
      totalFlow: 10000,
      cumSavings: 20000,
    })

    expect(results[2]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 10000, isEdited: false }],
      totalFlow: 10000,
      cumSavings: 30000,
    })

    expect(results[3]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 0, isEdited: true }],
      totalFlow: 0,
      cumSavings: 30000,
    })

    expect(results[4]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 0, isEdited: false }],
      totalFlow: 0,
      cumSavings: 30000,
    })
  })

  it('0 之后再填非零重新开始延续', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }], 202604: [{ id: "i1", name: "", amount: 0 }], 202607: [{ id: "i1", name: "", amount: 15000 }] },
          },
        ],
      }),
    )

    expect(results[3]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 0, isEdited: true }],
      totalFlow: 0,
    })

    expect(results[4]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 0, isEdited: false }],
      totalFlow: 0,
    })

    expect(results[5]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 0, isEdited: false }],
      totalFlow: 0,
    })

    expect(results[6]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 15000, isEdited: true }],
      totalFlow: 15000,
    })

    expect(results[7]).toMatchObject({
      columnValues: [{ id: 'col1', name: '工资', amount: 15000, isEdited: false }],
      totalFlow: 15000,
    })
  })

  it('多列正确汇总现金流', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
          {
            id: 'col2',
            name: '房租',
            itemSets: { 202601: [{ id: "i1", name: "", amount: -3000 }] },
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      columnValues: [
        { id: 'col1', name: '工资', amount: 10000, isEdited: true },
        { id: 'col2', name: '房租', amount: -3000, isEdited: true },
      ],
      totalFlow: 7000,
      monthlyBalance: 7000,
      cumSavings: 7000,
    })

    expect(results[1]).toMatchObject({
      columnValues: [
        { id: 'col1', name: '工资', amount: 10000, isEdited: false },
        { id: 'col2', name: '房租', amount: -3000, isEdited: false },
      ],
      totalFlow: 7000,
      monthlyBalance: 7000,
      cumSavings: 14000,
    })
  })

  it('投资收益基于上月累计', () => {
    const results = calculate(
      makePlan({
        systemParams: {
          startMonth: 202601,
          annualRate: 0.12,
        },
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
        ],
      }),
    )

    // 首月无投资收益（上月累计为0）
    expect(results[0].investReturn).toBe(0)
    expect(results[0].cumSavings).toBe(10000)

    // 第二个月投资收益 = 10000 * 0.12 / 12 = 100
    expect(results[1].investReturn).toBe(100)
    expect(results[1].cumSavings).toBe(20100)

    // 第三个月投资收益 = 20100 * 0.12 / 12 = 201
    expect(results[2].investReturn).toBe(201)
    expect(results[2].cumSavings).toBe(30301)
  })

  it('修正覆盖累计', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
        ],
        corrections: [{ month: 202603, actualSavings: 200000 }],
      }),
    )

    // 前两个月正常累计
    expect(results[0].cumSavings).toBe(10000)
    expect(results[1].cumSavings).toBe(20000)

    // 第三个月修正覆盖
    expect(results[2]).toMatchObject({
      month: 202603,
      cumSavings: 200000,
      isCorrected: true,
    })

    // 第四个月从修正继续
    expect(results[3]).toMatchObject({
      month: 202604,
      cumSavings: 210000,
      isCorrected: false,
    })
  })

  it('投资收益和修正协同工作', () => {
    const results = calculate(
      makePlan({
        systemParams: {
          startMonth: 202601,
          annualRate: 0.12,
        },
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
        ],
        corrections: [{ month: 202603, actualSavings: 50000 },
        { month: 202606, actualSavings: 100000 }],
      }),
    )

    // 第一月: 10000
    expect(results[0].cumSavings).toBe(10000)

    // 第二月: 10000 + 10000 + 100(投资收益) = 20100
    expect(results[1].cumSavings).toBe(20100)

    // 第三月: 修正覆盖为 50000
    expect(results[2].cumSavings).toBe(50000)
    expect(results[2].isCorrected).toBe(true)

    // 第四月: 50000 + 10000 + 500(投资收益) = 60500
    expect(results[3].cumSavings).toBe(60500)

    // 第五月: 60500 + 10000 + 605(投资收益) = 71105
    expect(results[4].cumSavings).toBe(71105)

    // 第六月: 修正覆盖为 100000
    expect(results[5].cumSavings).toBe(100000)
    expect(results[5].isCorrected).toBe(true)

    // 第七月: 100000 + 10000 + 1000(投资收益) = 111000
    expect(results[6].cumSavings).toBe(111000)
  })

  it('负值现金流正确处理', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] },
          },
          {
            id: 'col2',
            name: '房租',
            itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] },
          },
          {
            id: 'col3',
            name: '投资亏损',
            itemSets: { 202602: [{ id: "i1", name: "", amount: -2000 }] },
          },
        ],
      }),
    )

    expect(results[0]).toMatchObject({
      totalFlow: 5000,
      monthlyBalance: 5000,
      cumSavings: 5000,
    })

    expect(results[1]).toMatchObject({
      totalFlow: 3000,
      monthlyBalance: 3000,
      cumSavings: 8000,
    })

    expect(results[2]).toMatchObject({
      totalFlow: 3000,
      monthlyBalance: 3000,
      cumSavings: 11000,
    })
  })

  it('初始存款作为首月起点并参与投资收益', () => {
    const results = calculate(
      makePlan({
        systemParams: {
          startMonth: 202601,
          annualRate: 0.12,
          initialDeposit: 100000,
        },
        columns: [],
      }),
    )

    // 首月：理财收益 = 100000 * 0.12 / 12 = 1000；月末存款 = 100000 + 1000 = 101000
    expect(results[0].investReturn).toBe(1000)
    expect(results[0].cumSavings).toBe(101000)

    // 次月：理财收益 = 101000 * 0.12 / 12 = 1010；月末存款 = 101000 + 1010 = 102010
    expect(results[1].investReturn).toBe(1010)
    expect(results[1].cumSavings).toBe(102010)
  })

  it('未设置初始存款时首月起点为 0（回归）', () => {
    const results = calculate(
      makePlan({
        systemParams: { startMonth: 202601, annualRate: 0.12 },
        columns: [],
      }),
    )

    expect(results[0].investReturn).toBe(0)
    expect(results[0].cumSavings).toBe(0)
  })

  it('initialDeposit 为空串（输入框清空）时首月起点视为 0', () => {
    const results = calculate(
      makePlan({
        systemParams: {
          startMonth: 202601,
          annualRate: 0.12,
          initialDeposit: '' as unknown as number,
        },
        columns: [],
      }),
    )

    expect(results[0].investReturn).toBe(0)
    expect(results[0].cumSavings).toBe(0)
  })

  it('禁用列仍出现在 columnValues 但不计入汇总', () => {
    const results = calculate(
      makePlan({
        columns: [
          { id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
          { id: 'col2', name: '旅游', itemSets: { 202601: [{ id: "i1", name: "", amount: -3000 }] }, enabled: false },
        ],
      }),
    )

    // 禁用列的值仍保留在 columnValues（供灰显），且 enabled=false
    expect(results[0].columnValues).toHaveLength(2)
    expect(results[0].columnValues[1]).toMatchObject({ id: 'col2', amount: -3000, enabled: false })

    // 但 totalFlow 只含启用列：10000（不含 -3000）
    expect(results[0].totalFlow).toBe(10000)
    expect(results[0].monthlyIncome).toBe(10000)
    expect(results[0].monthlyExpense).toBe(0)   // -3000 属禁用列，不计入支出
    expect(results[0].monthlyBalance).toBe(10000)
    expect(results[0].cumSavings).toBe(10000)
  })

  it('全部列禁用时汇总为 0，累计仅含初始存款与理财收益', () => {
    const results = calculate(
      makePlan({
        systemParams: { startMonth: 202601, annualRate: 0.12, initialDeposit: 100000 },
        columns: [
          { id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] }, enabled: false },
        ],
      }),
    )

    expect(results[0].totalFlow).toBe(0)
    expect(results[0].monthlyIncome).toBe(1000)   // 全部列禁用，但理财 1000 计入收入
    expect(results[0].monthlyExpense).toBe(0)
    // 初始存款 100000 参与理财：100000 * 0.12 / 12 = 1000；月末 = 101000
    expect(results[0].investReturn).toBe(1000)
    expect(results[0].cumSavings).toBe(101000)
  })

  it('未显式设置 enabled 的列按启用计入（回归）', () => {
    const results = calculate(
      makePlan({
        columns: [
          { id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
        ],
      }),
    )
    expect(results[0].totalFlow).toBe(10000)
    expect(results[0].columnValues[0].enabled).toBe(true)
  })

  it('无 fund 时公积金字段全为 0，totalAssets === cumSavings', () => {
    const results = calculate(makePlan({
      columns: [{ id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
    }))
    const r = results[0]
    expect(r.fundBalance).toBe(0)
    expect(r.fundOutflow).toBe(0)
    expect(r.totalAssets).toBe(r.cumSavings)
    expect(r.isFundCorrected).toBe(false)
  })

  it('totalAssets === cumSavings + fundBalance（不变量，含 fund 场景）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0.015, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [],
        corrections: [],
      },
    }))
    for (const r of results) {
      expect(r.totalAssets).toBe(r.cumSavings + r.fundBalance)
    }
  })

  it('公积金缴存逐月累积到 fundBalance', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [],
        corrections: [],
      },
    }))
    expect(results[0].fundBalance).toBe(1000)
    expect(results[0].fundContribution).toBe(1000)
    expect(results[1].fundBalance).toBe(2000)
    expect(results[2].fundBalance).toBe(3000)
  })

  it('按年结息：结息月并入余额并计入 fundInterest，非结息月为 0', () => {
    const results = calculate(makePlan({
      // fundRate=0.12 便于手算：每月应计 = 余额*0.01
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0.12, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [],
        corrections: [],
      },
    }))
    for (let i = 0; i < 6; i++) {
      expect(results[i].fundInterest).toBe(0)
    }
    // 结息月(7月,index=6)：前6月应计(10000..60000各*0.01=2100) + 7月自身(70000*0.01=700) = 2800；余额 70000+2800=72800
    expect(results[6].fundInterest).toBe(2800)
    expect(results[6].fundBalance).toBe(72800)
    expect(results[7].fundInterest).toBe(0)
  })

  it('月冲默认联动房贷月供：公积金全额抵扣，可支配净效果为 0', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} }, // 未填，默认取房贷月供 5000
        withdrawals: [],
        corrections: [],
      },
    }))
    const r = results[0]
    expect(r.fundContribution).toBe(5000)
    expect(r.fundOffset).toBe(5000)
    expect(r.fundBalance).toBe(0)
    expect(r.monthlyExpense).toBe(0)   // shortfall = 5000 − 5000 = 0
    expect(r.fundOutflow).toBe(5000)
    expect(r.cumSavings).toBe(0)
  })

  it('月冲超余额截断：差额由可支配承担', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 2000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [],
        corrections: [],
      },
    }))
    const r = results[0]
    expect(r.fundOffset).toBe(2000)
    expect(r.fundBalance).toBe(0)
    expect(r.cumSavings).toBe(-3000)
  })

  it('提取从公积金出、转入可支配，总资产不变', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 100000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [{ id: 'w1', name: '买房提取', month: 202602, amount: 30000 }],
        corrections: [],
      },
    }))
    // 首月：缴存 100000，无提取 → fundBalance=100000，可支配 0
    expect(results[0].fundBalance).toBe(100000)
    expect(results[0].cumSavings).toBe(0)
    expect(results[0].totalAssets).toBe(100000)
    // 次月：期初 100000 + 缴存 100000 = 200000，提取 30000 → fundBalance=170000；
    //       提取款转入可支配 → cumSavings=30000；总资产=170000+30000=200000
    expect(results[1].fundWithdrawal).toBe(30000)
    expect(results[1].fundBalance).toBe(170000)
    expect(results[1].fundOutflow).toBe(30000)
    expect(results[1].cumSavings).toBe(30000)
    expect(results[1].totalAssets).toBe(200000)
  })

  it('提取超余额截断到余额', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [{ id: 'w1', name: '超额提取', month: 202602, amount: 999999 }],
        corrections: [],
      },
    }))
    // 次月期初 10000 + 缴存 10000 = 20000；提取截断到 20000
    expect(results[1].fundWithdrawal).toBe(20000)
    expect(results[1].fundBalance).toBe(0)
    expect(results[1].cumSavings).toBe(20000)
  })

  it('公积金余额修正覆盖 fundBalance', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [],
        corrections: [{ month: 202603, actualBalance: 500000 }],
      },
    }))
    expect(results[1].fundBalance).toBe(2000)
    expect(results[2]).toMatchObject({ month: 202603, fundBalance: 500000, isFundCorrected: true })
    expect(results[3].fundBalance).toBe(501000)
  })

  it('收入含理财收益与公积金提取（新口径）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0.12, fundRate: 0, fundInterestMonth: 7 },
      columns: [{ id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 50000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [{ id: 'w1', name: '买房提取', month: 202602, amount: 30000 }],
        corrections: [],
      },
    }))
    // 202601：工资 10000，理财 0（首月无上月存款），无提取 → 收入 = 10000
    expect(results[0].monthlyIncome).toBe(10000)
    // 202602：工资 10000 + 理财(上月存款10000*0.12/12=100) + 提取 30000 = 40100
    expect(results[1].monthlyIncome).toBe(40100)
  })

  it('支出用存款补扣而非房贷全额（月冲抵房贷）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 2000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} }, // 默认联动 5000，余额只够 2000
        withdrawals: [], corrections: [],
      },
    }))
    // shortfall = 房贷 5000 − 月冲 2000 = 3000；支出 = 3000
    expect(results[0].monthlyExpense).toBe(3000)
  })

  it('结余 = 收入 − 支出（新口径，数值与旧口径等价）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0.12, fundRate: 0, fundInterestMonth: 7 },
      columns: [
        { id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
        { id: 'col2', name: '房租', itemSets: { 202601: [{ id: "i1", name: "", amount: -3000 }] } },
      ],
    }))
    for (const r of results) {
      expect(r.monthlyBalance).toBe(r.monthlyIncome - r.monthlyExpense)
    }
  })

  it('手填月冲超过房贷月供时，超出部分计入收入（cumSavings 与旧口径一致）', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -3000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 100000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }] } }, // 手填 5000 > 房贷 3000
        withdrawals: [], corrections: [],
      },
    }))
    // 月冲扣 5000：3000 抵房贷、2000 转入可支配（计入收入）
    expect(results[0].fundOffset).toBe(5000)
    expect(results[0].fundOffsetShortfall).toBe(0)
    expect(results[0].monthlyIncome).toBe(2000)
    expect(results[0].monthlyExpense).toBe(0)
    expect(results[0].monthlyBalance).toBe(2000)
  })
})

describe('存款补扣 fundOffsetShortfall（= 房贷月供 − 公积金实际月冲，由可支配存款承担）', () => {
  it('月冲充足冲满房贷 → shortfall 为 0', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 5000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },   // 默认联动房贷 5000
        withdrawals: [], corrections: [],
      },
    }))
    expect(results[0].fundOffset).toBe(5000)
    expect(results[0].fundOffsetShortfall).toBe(0)
  })

  it('月冲因余额不足被截断 → shortfall = 房贷月供 − 实际月冲', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 2000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },   // 联动 5000，但余额只够 2000
        withdrawals: [], corrections: [],
      },
    }))
    expect(results[0].fundOffset).toBe(2000)
    expect(results[0].fundOffsetShortfall).toBe(3000)
  })

  it('无房贷月供 → shortfall 为 0', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: {} },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 1000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: {} },
        withdrawals: [], corrections: [],
      },
    }))
    expect(results[0].fundOffsetShortfall).toBe(0)
  })

  it('月冲手填且小于房贷月供 → shortfall = 房贷月供 − 实际月冲', () => {
    const results = calculate(makePlan({
      systemParams: { startMonth: 202601, annualRate: 0, fundRate: 0, fundInterestMonth: 7 },
      fund: {
        mortgage: { id: 'm', name: '房贷月供', itemSets: { 202601: [{ id: "i1", name: "", amount: -5000 }] } },
        contribution: { id: 'c', name: '公积金缴存', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } },
        monthlyOffset: { id: 'o', name: '公积金月冲', itemSets: { 202601: [{ id: "i1", name: "", amount: 3000 }] } },   // 手填 3000
        withdrawals: [], corrections: [],
      },
    }))
    expect(results[0].fundOffset).toBe(3000)
    expect(results[0].fundOffsetShortfall).toBe(2000)
  })

  it('无 fund → shortfall 为 0', () => {
    const results = calculate(makePlan({
      columns: [{ id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
    }))
    expect(results[0].fundOffsetShortfall).toBe(0)
  })
})

describe('calculate 与专项事件', () => {
  it('单月单笔负数事件：净额计入支出与累计，columnValues 含专项虚拟值', () => {
    const results = calculate(
      makePlan({
        events: [{ id: 'e1', name: '买房', month: 202601, amount: -2000000 }],
      }),
    )

    expect(results[0]).toMatchObject({
      monthlyExpense: 2000000,
      monthlyIncome: 0,
      totalFlow: -2000000,
      monthlyBalance: -2000000,
      cumSavings: -2000000,
    })
    expect(results[0].columnValues).toContainEqual(
      expect.objectContaining({
        id: '__events__',
        name: '专项',
        amount: -2000000,
        isEdited: false,
        enabled: true,
      }),
    )
  })

  it('单月单笔正数事件：计入收入', () => {
    const results = calculate(
      makePlan({
        events: [{ id: 'e1', name: '奖金', month: 202601, amount: 50000 }],
      }),
    )
    expect(results[0].monthlyIncome).toBe(50000)
    expect(results[0].totalFlow).toBe(50000)
    expect(results[0].monthlyExpense).toBe(0)
  })

  it('单月多笔事件：净额为各笔之和', () => {
    const results = calculate(
      makePlan({
        events: [
          { id: 'e1', name: '买房', month: 202601, amount: -2000000 },
          { id: 'e2', name: '换车', month: 202601, amount: -200000 },
        ],
      }),
    )
    expect(results[0].columnValues.find((cv) => cv.name === '专项')?.amount).toBe(-2200000)
    expect(results[0].totalFlow).toBe(-2200000)
    expect(results[0].monthlyExpense).toBe(2200000)
  })

  it('无事件月不注入专项虚拟值', () => {
    const results = calculate(
      makePlan({
        events: [{ id: 'e1', name: '买房', month: 202602, amount: -2000000 }],
      }),
    )
    // 202601 无事件
    expect(results[0].columnValues.find((cv) => cv.name === '专项')).toBeUndefined()
    expect(results[0].totalFlow).toBe(0)
    // 202602 有事件
    expect(results[1].columnValues.find((cv) => cv.name === '专项')?.amount).toBe(-2000000)
  })

  it('事件不影响普通列携带延续', () => {
    const results = calculate(
      makePlan({
        columns: [{ id: 'col1', name: '工资', itemSets: { 202601: [{ id: "i1", name: "", amount: 10000 }] } }],
        events: [{ id: 'e1', name: '买房', month: 202602, amount: -500000 }],
      }),
    )
    // 202602：工资延续 10000 + 事件 -500000 = -490000
    expect(results[1].columnValues.find((cv) => cv.id === 'col1')?.amount).toBe(10000)
    expect(results[1].totalFlow).toBe(-490000)
  })

  it('事件参与累计储蓄递推', () => {
    const results = calculate(
      makePlan({
        events: [{ id: 'e1', name: '买房', month: 202602, amount: -100000 }],
      }),
    )
    expect(results[0].cumSavings).toBe(0)
    expect(results[1].cumSavings).toBe(-100000)
    expect(results[2].cumSavings).toBe(-100000)
  })
})

describe('buildComparison', () => {
  const results: MonthResult[] = [
    makeResult({ month: 202601, cumSavings: 5000, isCorrected: false }),
    makeResult({ month: 202602, cumSavings: 8500, isCorrected: true }),
    makeResult({ month: 202603, cumSavings: 12000, isCorrected: false }),
  ]

  const snapshot: PlanSnapshot = {
    id: 's1',
    name: '2026-01 计划',
    createdMonth: 202601,
    projection: { 202601: 5000, 202602: 9000 },
  }

  it('snapshot 为 null 时 predicted/diff 全为 null', () => {
    const cmp = buildComparison(results, null)
    expect(cmp.map(c => c.predicted)).toEqual([null, null, null])
    expect(cmp.map(c => c.diff)).toEqual([null, null, null])
    expect(cmp.map(c => c.actual)).toEqual([5000, 8500, 12000])
  })

  it('predicted 取自快照，缺失月为 null', () => {
    const cmp = buildComparison(results, snapshot)
    expect(cmp[0].predicted).toBe(5000)
    expect(cmp[1].predicted).toBe(9000)
    expect(cmp[2].predicted).toBeNull()
  })

  it('diff 仅在该月 isCorrected 且 predicted 非空时计算', () => {
    const cmp = buildComparison(results, snapshot)
    expect(cmp[0].diff).toBeNull()
    expect(cmp[1].diff).toBe(-500)
    expect(cmp[2].diff).toBeNull()
  })

  it('isCorrected 但 predicted 缺失时 diff 为 null', () => {
    const correctedNoPredict: MonthResult[] = [
      makeResult({ month: 202603, cumSavings: 12000, isCorrected: true }),
    ]
    const cmp = buildComparison(correctedNoPredict, snapshot)
    expect(cmp[0].predicted).toBeNull()
    expect(cmp[0].diff).toBeNull()
  })
})

describe('aggregateByYear', () => {
  it('单年多月：收入支出求和，累计取该年最后一月', () => {
    const results = [
      makeResult({ month: 202601, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 50000 }),
      makeResult({ month: 202602, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 55000 }),
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 6000, cumSavings: 120000 }),
    ]

    expect(aggregateByYear(results)).toEqual([
      { year: 2026, income: 30000, expense: 18000, cumSavings: 120000, totalAssets: 0, fundBalance: 0 },
    ])
  })

  it('跨自然年：按年份分组，各自取末月累计', () => {
    const results = [
      makeResult({ month: 202611, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 100000 }),
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 110000 }),
      makeResult({ month: 202701, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 120000 }),
      makeResult({ month: 202702, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 130000 }),
    ]

    expect(aggregateByYear(results)).toEqual([
      { year: 2026, income: 20000, expense: 10000, cumSavings: 110000, totalAssets: 0, fundBalance: 0 },
      { year: 2027, income: 24000, expense: 10000, cumSavings: 130000, totalAssets: 0, fundBalance: 0 },
    ])
  })

  it('乱序输入按年份升序输出', () => {
    const results = [
      makeResult({ month: 202701, monthlyIncome: 12000, monthlyExpense: 5000, cumSavings: 120000 }),
      makeResult({ month: 202612, monthlyIncome: 10000, monthlyExpense: 5000, cumSavings: 110000 }),
    ]

    expect(aggregateByYear(results).map(p => p.year)).toEqual([2026, 2027])
  })

  it('空数组返回空数组', () => {
    expect(aggregateByYear([])).toEqual([])
  })
})

describe('resolveColumnValue 明细组合计', () => {
  it('多笔明细取代数合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [
        { id: 'a', name: '年终奖', amount: 8000 },
        { id: 'b', name: '红包', amount: 3000 },
      ] },
    }
    expect(resolveColumnValue(column, 202601).amount).toBe(11000)
  })

  it('正负混排按代数和归入合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '杂项',
      itemSets: { 202601: [
        { id: 'a', name: '进账', amount: 5000 },
        { id: 'b', name: '支出', amount: -2000 },
      ] },
    }
    expect(resolveColumnValue(column, 202601).amount).toBe(3000)
  })

  it('空组视为手填过：合计 0、isEdited=true', () => {
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: { 202601: [] } }
    const r = resolveColumnValue(column, 202601)
    expect(r.amount).toBe(0)
    expect(r.isEdited).toBe(true)
  })

  it('延续整组：前月多笔，后月沿用其合计', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [
        { id: 'a', name: '项目奖', amount: 5000 },
        { id: 'b', name: '加班费', amount: 3000 },
      ] },
    }
    expect(resolveColumnValue(column, 202602).amount).toBe(8000)
    expect(resolveColumnValue(column, 202602).isEdited).toBe(false)
  })

  it('yearly 月不参与延续', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [{ id: 'a', name: '年度奖', amount: 9000 }] },
      yearlyMonths: { 202601: true },
    }
    expect(resolveColumnValue(column, 202602).amount).toBe(0)
  })
})

describe('resolveColumnItems', () => {
  it('返回该月生效的整组明细（手填）', () => {
    const column: FlowColumn = {
      id: 'col1', name: '奖金',
      itemSets: { 202601: [{ id: 'a', name: 'x', amount: 1 }] },
    }
    expect(resolveColumnItems(column, 202601)).toEqual([{ id: 'a', name: 'x', amount: 1 }])
  })

  it('返回沿用组（前月多笔）', () => {
    const group = [{ id: 'a', name: 'x', amount: 1 }, { id: 'b', name: 'y', amount: 2 }]
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: { 202601: group } }
    expect(resolveColumnItems(column, 202602)).toEqual(group)
  })

  it('无任何组返回空数组', () => {
    const column: FlowColumn = { id: 'col1', name: '奖金', itemSets: {} }
    expect(resolveColumnItems(column, 202601)).toEqual([])
  })
})
