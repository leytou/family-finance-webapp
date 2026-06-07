import { describe, expect, it } from 'vitest'

import { formatCurrency } from '../../src/utils/format'

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

})
