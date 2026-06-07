import { describe, expect, it } from 'vitest'

import { formatCurrency, formatPercent } from '../../src/utils/format'

describe('format utils', () => {
  describe('formatCurrency', () => {
    it('formats integers with thousands separators', () => {
      expect(formatCurrency(12345)).toBe('12,345')
    })

    it('formats negative integers with thousands separators', () => {
      expect(formatCurrency(-5000)).toBe('-5,000')
    })

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('0')
    })

    it('rounds decimals before formatting', () => {
      expect(formatCurrency(1234.56)).toBe('1,235')
    })
  })

  describe('formatPercent', () => {
    it('formats fractional percentages with one decimal place', () => {
      expect(formatPercent(0.025)).toBe('2.5%')
    })

    it('formats whole percentages without decimal places', () => {
      expect(formatPercent(0.1)).toBe('10%')
    })

    it('formats floating-point integer percentages without decimal places', () => {
      expect(formatPercent(0.07)).toBe('7%')
    })
  })
})
