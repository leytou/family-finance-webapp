import { describe, expect, it } from 'vitest'
import { calculate, resolveColumnValue, buildComparison } from '../../src/composables/useCalculation'
import type { PlanData, FlowColumn, MonthResult, PlanSnapshot } from '../../src/types'

function makePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    version: 2,
    systemParams: {
      startMonth: 202601,
      annualRate: 0,
    },
    columns: [],
    anchors: [],
    snapshots: [],
    ...overrides,
  }
}

describe('resolveColumnValue', () => {
  it('直接编辑值标记 isEdited=true', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: { 202601: 10000 },
    }

    const result = resolveColumnValue(column, 202601)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: true,
    })
  })

  it('延续值标记 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: { 202601: 10000 },
    }

    const result = resolveColumnValue(column, 202602)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
    })
  })

  it('未找到任何 entry 时返回 0 且 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: {},
    }

    const result = resolveColumnValue(column, 202601)

    expect(result).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
    })
  })

  it('entry 为 0 时延续 0 并标记 isEdited=false', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: { 202601: 10000, 202603: 0 },
    }

    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
    })

    expect(resolveColumnValue(column, 202603)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: true,
    })

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
    })
  })

  it('0 之后再填非零重新开始延续', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: { 202601: 10000, 202603: 0, 202606: 15000 },
    }

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
    })

    expect(resolveColumnValue(column, 202605)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 0,
      isEdited: false,
    })

    expect(resolveColumnValue(column, 202606)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: true,
    })

    expect(resolveColumnValue(column, 202607)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: false,
    })
  })

  it('查找最近的 entry（最大的 key）', () => {
    const column: FlowColumn = {
      id: 'col1',
      name: '工资',
      entries: { 202601: 5000, 202603: 10000, 202605: 15000 },
    }

    expect(resolveColumnValue(column, 202602)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 5000,
      isEdited: false,
    })

    expect(resolveColumnValue(column, 202604)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 10000,
      isEdited: false,
    })

    expect(resolveColumnValue(column, 202606)).toEqual({
      id: 'col1',
      name: '工资',
      amount: 15000,
      isEdited: false,
    })
  })
})

describe('calculate', () => {
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
      isAnchor: false,
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
            entries: { 202601: 10000 },
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
            entries: { 202601: 10000, 202604: 0 },
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
            entries: { 202601: 10000, 202604: 0, 202607: 15000 },
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
            entries: { 202601: 10000 },
          },
          {
            id: 'col2',
            name: '房租',
            entries: { 202601: -3000 },
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
            entries: { 202601: 10000 },
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

  it('锚点覆盖累计', () => {
    const results = calculate(
      makePlan({
        columns: [
          {
            id: 'col1',
            name: '工资',
            entries: { 202601: 10000 },
          },
        ],
        anchors: [{ month: 202603, actualSavings: 200000 }],
      }),
    )

    // 前两个月正常累计
    expect(results[0].cumSavings).toBe(10000)
    expect(results[1].cumSavings).toBe(20000)

    // 第三个月锚点覆盖
    expect(results[2]).toMatchObject({
      month: 202603,
      cumSavings: 200000,
      isAnchor: true,
    })

    // 第四个月从锚点继续
    expect(results[3]).toMatchObject({
      month: 202604,
      cumSavings: 210000,
      isAnchor: false,
    })
  })

  it('投资收益和锚点协同工作', () => {
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
            entries: { 202601: 10000 },
          },
        ],
        anchors: [{ month: 202603, actualSavings: 50000 },
        { month: 202606, actualSavings: 100000 }],
      }),
    )

    // 第一月: 10000
    expect(results[0].cumSavings).toBe(10000)

    // 第二月: 10000 + 10000 + 100(投资收益) = 20100
    expect(results[1].cumSavings).toBe(20100)

    // 第三月: 锚点覆盖为 50000
    expect(results[2].cumSavings).toBe(50000)
    expect(results[2].isAnchor).toBe(true)

    // 第四月: 50000 + 10000 + 500(投资收益) = 60500
    expect(results[3].cumSavings).toBe(60500)

    // 第五月: 60500 + 10000 + 605(投资收益) = 71105
    expect(results[4].cumSavings).toBe(71105)

    // 第六月: 锚点覆盖为 100000
    expect(results[5].cumSavings).toBe(100000)
    expect(results[5].isAnchor).toBe(true)

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
            entries: { 202601: 10000 },
          },
          {
            id: 'col2',
            name: '房租',
            entries: { 202601: -5000 },
          },
          {
            id: 'col3',
            name: '投资亏损',
            entries: { 202602: -2000 },
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
})

describe('buildComparison', () => {
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
      isAnchor: false,
      ...overrides,
    }
  }

  const results: MonthResult[] = [
    makeResult({ month: 202601, cumSavings: 5000, isAnchor: false }),
    makeResult({ month: 202602, cumSavings: 8500, isAnchor: true }),
    makeResult({ month: 202603, cumSavings: 12000, isAnchor: false }),
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

  it('diff 仅在该月 isAnchor 且 predicted 非空时计算', () => {
    const cmp = buildComparison(results, snapshot)
    expect(cmp[0].diff).toBeNull()
    expect(cmp[1].diff).toBe(-500)
    expect(cmp[2].diff).toBeNull()
  })

  it('isAnchor 但 predicted 缺失时 diff 为 null', () => {
    const anchoredNoPredict: MonthResult[] = [
      makeResult({ month: 202603, cumSavings: 12000, isAnchor: true }),
    ]
    const cmp = buildComparison(anchoredNoPredict, snapshot)
    expect(cmp[0].predicted).toBeNull()
    expect(cmp[0].diff).toBeNull()
  })
})
