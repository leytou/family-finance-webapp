import { describe, expect, it } from 'vitest'

import {
  addMonths,
  compareMonth,
  formatMonth,
  getCurrentMonth,
  isInRange,
  isValidYyyyMm,
  monthRange,
  normalizeMonth,
} from '../../src/utils/month'

describe('month utils', () => {
  describe('addMonths', () => {
    it('adds positive offsets within the same year', () => {
      expect(addMonths(202603, 2)).toBe(202605)
    })

    it('adds positive offsets across years', () => {
      expect(addMonths(202611, 3)).toBe(202702)
    })

    it('adds negative offsets across years', () => {
      expect(addMonths(202702, -3)).toBe(202611)
    })
  })

  describe('monthRange', () => {
    it('returns an inclusive sequential list across years', () => {
      expect(monthRange(202611, 202702)).toEqual([
        202611,
        202612,
        202701,
        202702,
      ])
    })

    it('returns a single element for the same start and end month', () => {
      expect(monthRange(202606, 202606)).toEqual([202606])
    })
  })

  describe('isInRange', () => {
    it('returns true for a month inside the range', () => {
      expect(isInRange(202612, 202611, 202702)).toBe(true)
    })

    it('returns true for inclusive boundaries', () => {
      expect(isInRange(202611, 202611, 202702)).toBe(true)
      expect(isInRange(202702, 202611, 202702)).toBe(true)
    })

    it('returns false for months outside the range', () => {
      expect(isInRange(202610, 202611, 202702)).toBe(false)
      expect(isInRange(202703, 202611, 202702)).toBe(false)
    })
  })

  describe('compareMonth', () => {
    it('returns less than 0 for an earlier month', () => {
      expect(compareMonth(202605, 202606)).toBeLessThan(0)
    })

    it('returns 0 for equal months', () => {
      expect(compareMonth(202606, 202606)).toBe(0)
    })

    it('returns less than 0 across years', () => {
      expect(compareMonth(202612, 202701)).toBeLessThan(0)
    })
  })

  describe('formatMonth', () => {
    it('formats YYYYMM as YYYY-MM', () => {
      expect(formatMonth(202606)).toBe('2026-06')
    })
  })

  describe('getCurrentMonth', () => {
    it('returns the current month as a valid YYYYMM number', () => {
      const currentMonth = getCurrentMonth()
      const monthPart = currentMonth % 100

      expect(currentMonth).toBeGreaterThan(202000)
      expect(monthPart).toBeGreaterThanOrEqual(1)
      expect(monthPart).toBeLessThanOrEqual(12)
    })
  })

  describe('isValidYyyyMm', () => {
    it('6 位整数返回 true', () => {
      expect(isValidYyyyMm(202601)).toBe(true)
      expect(isValidYyyyMm(202613)).toBe(true)   // 位数合法即可，月份越界由 normalize 处理
    })

    it('位数不足返回 false', () => {
      expect(isValidYyyyMm(2026)).toBe(false)
      expect(isValidYyyyMm(20261)).toBe(false)
      expect(isValidYyyyMm(202)).toBe(false)
    })

    it('负数、0、非整数、NaN 返回 false', () => {
      expect(isValidYyyyMm(-202601)).toBe(false)
      expect(isValidYyyyMm(0)).toBe(false)
      expect(isValidYyyyMm(202601.5)).toBe(false)
      expect(isValidYyyyMm(NaN)).toBe(false)
    })
  })

  describe('normalizeMonth', () => {
    it('合法月份原样返回', () => {
      expect(normalizeMonth(202612)).toBe(202612)
      expect(normalizeMonth(202601)).toBe(202601)
    })

    it('13 月进位为次年 1 月', () => {
      expect(normalizeMonth(202613)).toBe(202701)
    })

    it('0 月进位为上年 12 月', () => {
      expect(normalizeMonth(202600)).toBe(202512)
    })

    it('大额越界月份整体进位', () => {
      expect(normalizeMonth(202699)).toBe(203403)   // 2026 年 99 月 → 2034 年 3 月
    })

    it('位数不足返回 null', () => {
      expect(normalizeMonth(2026)).toBeNull()
      expect(normalizeMonth(20261)).toBeNull()
    })

    it('负数、0、非整数、NaN 返回 null', () => {
      expect(normalizeMonth(-5)).toBeNull()
      expect(normalizeMonth(0)).toBeNull()
      expect(normalizeMonth(1.5)).toBeNull()
      expect(normalizeMonth(NaN)).toBeNull()
    })

    it('边界 100000（1000 年 0 月）进位为 99912（记录行为，不额外约束）', () => {
      expect(normalizeMonth(100000)).toBe(99912)
    })

    it('边界 999999（9999 年 99 月）进位为 1000703（记录行为，不额外约束）', () => {
      expect(normalizeMonth(999999)).toBe(1000703)
    })
  })
})
