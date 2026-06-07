import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TimeGrid from '../../src/components/TimeGrid.vue'

function mountTimeGrid(props = {}) {
  return mount(TimeGrid, {
    props: {
      startMonth: 202601,
      selectedStart: null,
      selectedEnd: null,
      ...props,
    },
  })
}

describe('TimeGrid', () => {
  it('renders 60 cells', () => {
    const wrapper = mountTimeGrid()

    expect(wrapper.findAll('[data-testid="grid-cell"]')).toHaveLength(60)
  })

  it('emits the clicked month when mouse down and mouse up happen on one cell', async () => {
    const wrapper = mountTimeGrid()
    const firstCell = wrapper.findAll('[data-testid="grid-cell"]')[0]

    await firstCell.trigger('mousedown')
    await firstCell.trigger('mouseup')

    expect(wrapper.emitted('select')).toEqual([
      [{ startMonth: 202601, endMonth: 202601 }],
    ])
  })

  it('emits a normalized month range when dragging from the first cell to the sixth', async () => {
    const wrapper = mountTimeGrid()
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[0].trigger('mousedown')
    await cells[5].trigger('mousemove')
    await cells[5].trigger('mouseup')

    expect(wrapper.emitted('select')).toEqual([
      [{ startMonth: 202601, endMonth: 202606 }],
    ])
  })

  it('emits a normalized month range when dragging from a later cell to an earlier cell', async () => {
    const wrapper = mountTimeGrid()
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[5].trigger('mousedown')
    await cells[0].trigger('mousemove')
    await cells[0].trigger('mouseup')

    expect(wrapper.emitted('select')).toEqual([
      [{ startMonth: 202601, endMonth: 202606 }],
    ])
  })

  it('emits the drag range when mouseup happens on the grid container', async () => {
    const wrapper = mountTimeGrid()
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    await cells[0].trigger('mousedown')
    await cells[5].trigger('mousemove')
    await wrapper.trigger('mouseup')

    expect(wrapper.emitted('select')).toEqual([
      [{ startMonth: 202601, endMonth: 202606 }],
    ])
  })

  it('emits a single-cell range when pressing Enter or Space on a cell', async () => {
    const wrapper = mountTimeGrid()
    const thirdCell = wrapper.findAll('[data-testid="grid-cell"]')[2]

    await thirdCell.trigger('keydown', { key: 'Enter' })
    await thirdCell.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('select')).toEqual([
      [{ startMonth: 202603, endMonth: 202603 }],
      [{ startMonth: 202603, endMonth: 202603 }],
    ])
  })

  it('marks selected cells with selected class inclusively', () => {
    const wrapper = mountTimeGrid({
      selectedStart: 202603,
      selectedEnd: 202608,
    })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    expect(cells[2].classes()).toContain('selected')
    expect(cells[7].classes()).toContain('selected')
    expect(cells[0].classes()).not.toContain('selected')
    expect(cells[2].attributes('aria-selected')).toBe('true')
    expect(cells[7].attributes('aria-selected')).toBe('true')
    expect(cells[0].attributes('aria-selected')).toBe('false')
  })
})
