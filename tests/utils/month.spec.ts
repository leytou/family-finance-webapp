import { describe, expect, it } from 'vitest'

import {
  addMonths,
  compareMonth,
  formatMonth,
  getCurrentMonth,
  isInRange,
  monthRange,
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
})
