import { describe, expect, it } from 'vitest'
import { catalogQuery, DEFAULT_FILTERS, filtersFromSearch, filtersToSearch } from './catalogFilters'

describe('filtros del catálogo en la URL', () => {
  it('lee los filtros válidos de la URL', () => {
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

  it('descarta valores inválidos en vez de romper la página', () => {
    const filters = filtersFromSearch(
      new URLSearchParams(
        'type=CASTILLO&minPrice=-5&bedrooms=2.5&features=GARAGE,SPA&sort=title,asc&page=0',
      ),
    )

    expect(filters).toEqual({ ...DEFAULT_FILTERS, features: ['GARAGE'] })
  })

  it('escribe solo lo que difiere del valor por defecto', () => {
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

  it('arma la consulta del contrato con orden, página y tamaño', () => {
    const query = new URLSearchParams(catalogQuery({ ...DEFAULT_FILTERS, operation: 'RENT' }))

    expect(query.get('operation')).toBe('RENT')
    expect(query.get('sort')).toBe('publishedAt,desc')
    expect(query.get('page')).toBe('1')
    expect(query.get('size')).toBe('12')
  })

  it('es reversible: URL → filtros → URL', () => {
    const search = 'zone=Centro&operation=RENT&bedrooms=1&features=FURNISHED,PET_FRIENDLY&page=2'

    const roundTrip = filtersToSearch(filtersFromSearch(new URLSearchParams(search))).toString()

    // URLSearchParams escribe la coma como %2C: es la misma URL.
    expect(decodeURIComponent(roundTrip)).toBe(search)
  })
})
