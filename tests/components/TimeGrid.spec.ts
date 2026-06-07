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

  it('marks selected cells with selected class inclusively', () => {
    const wrapper = mountTimeGrid({
      selectedStart: 202603,
      selectedEnd: 202608,
    })
    const cells = wrapper.findAll('[data-testid="grid-cell"]')

    expect(cells[2].classes()).toContain('selected')
    expect(cells[7].classes()).toContain('selected')
    expect(cells[0].classes()).not.toContain('selected')
  })
})
