import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  advancedFilterCount,
  catalogQuery,
  filtersFromSearch,
  filtersToSearch,
  hasActiveFilters,
} from './catalogFilters'

describe('catalog filters in the URL', () => {
  it('reads the valid filters from the URL', () => {
    const filters = filtersFromSearch(
      new URLSearchParams(
        'zone=Equipetrol&type=HOUSE&operation=SALE&minPrice=50000&maxPrice=150000&bedrooms=3&features=GARAGE,POOL&sort=price,asc&page=2',
      ),
    )

    expect(filters).toEqual({
      zone: 'Equipetrol',
      type: 'HOUSE',
      operation: 'SALE',
      minPrice: 50000,
      maxPrice: 150000,
      bedrooms: 3,
      features: ['GARAGE', 'POOL'],
      sort: 'price,asc',
      page: 2,
    })
  })

  it('discards invalid values instead of breaking the page', () => {
    const filters = filtersFromSearch(
      new URLSearchParams(
        'type=CASTILLO&minPrice=-5&bedrooms=2.5&features=GARAGE,SPA&sort=title,asc&page=0',
      ),
    )

    expect(filters).toEqual({ ...DEFAULT_FILTERS, features: ['GARAGE'] })
  })

  it('writes only what differs from the default value', () => {
    expect(filtersToSearch(DEFAULT_FILTERS).toString()).toBe('')
    expect(
      filtersToSearch({
        ...DEFAULT_FILTERS,
        zone: 'Norte',
        features: ['POOL'],
        page: 3,
      }).toString(),
    ).toBe('zone=Norte&features=POOL&page=3')
  })

  it('builds the contract query with sort, page and size', () => {
    const query = new URLSearchParams(catalogQuery({ ...DEFAULT_FILTERS, operation: 'RENT' }))

    expect(query.get('operation')).toBe('RENT')
    expect(query.get('sort')).toBe('publishedAt,desc')
    expect(query.get('page')).toBe('1')
    expect(query.get('size')).toBe('12')
  })

  it('is reversible: URL → filters → URL', () => {
    const search = 'zone=Centro&operation=RENT&bedrooms=1&features=FURNISHED,PET_FRIENDLY&page=2'

    const roundTrip = filtersToSearch(filtersFromSearch(new URLSearchParams(search))).toString()

    // URLSearchParams escribe la coma como %2C: es la misma URL.
    expect(decodeURIComponent(roundTrip)).toBe(search)
  })
})

describe('applied filters', () => {
  it('without filters nothing is active, even if the sort or page changes', () => {
    const filters = { ...DEFAULT_FILTERS, sort: 'price,asc' as const, page: 3 }

    expect(hasActiveFilters(filters)).toBe(false)
    expect(advancedFilterCount(filters)).toBe(0)
  })

  it('counts price, bedrooms and each feature as advanced filters', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      minPrice: 0,
      maxPrice: 5000,
      bedrooms: 2,
      features: ['POOL' as const, 'GARAGE' as const],
    }

    expect(hasActiveFilters(filters)).toBe(true)
    expect(advancedFilterCount(filters)).toBe(5)
  })

  it('zone, type and operation are active filters, but not advanced ones', () => {
    const filters = { ...DEFAULT_FILTERS, zone: 'Urubó', type: 'HOUSE' as const }

    expect(hasActiveFilters(filters)).toBe(true)
    expect(advancedFilterCount(filters)).toBe(0)
  })
})
