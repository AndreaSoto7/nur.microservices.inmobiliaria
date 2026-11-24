import L from 'leaflet'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link } from 'react-router'
import { gatewayUrl } from '../../../core/config'
import type { PropertySummary } from '../../../core/models/listing'
import { formatPrice, formatPriceShort } from '../../../shared/format/property'
import {
  CITY_ZOOM,
  coordinatesOf,
  escapeHtml,
  SANTA_CRUZ,
  STREET_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from '../../../shared/map/mapConfig'

interface CatalogMapProps {
  properties: PropertySummary[]
  hrefFor: (property: PropertySummary) => string
  activeId: string | null
  onActivate: (propertyId: string | null) => void
  onSelect: (propertyId: string) => void
}

interface LocatedProperty {
  property: PropertySummary
  position: [number, number]
}

/**
 * Dumb: el mapa del catálogo con el precio de cada propiedad como marcador. Encuadra los marcadores cada
 * vez que cambian los resultados; las propiedades sin coordenadas no aparecen (la lista lo avisa).
 */
export const CatalogMap = memo(function CatalogMap({
  properties,
  hrefFor,
  activeId,
  onActivate,
  onSelect,
}: CatalogMapProps) {
  const located = useMemo(() => locate(properties), [properties])

  return (
    <div className="catalog-map" role="region" aria-label="Mapa de propiedades">
      <MapContainer center={SANTA_CRUZ} zoom={CITY_ZOOM} className="catalog-map__canvas">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToMarkers located={located} />
        {located.map(({ property, position }) => (
          <PriceMarker
            key={property.id}
            property={property}
            position={position}
            href={hrefFor(property)}
            active={property.id === activeId}
            onActivate={onActivate}
            onSelect={onSelect}
          />
        ))}
      </MapContainer>
    </div>
  )
})

function locate(properties: PropertySummary[]): LocatedProperty[] {
  return properties.flatMap((property) => {
    const coordinates = coordinatesOf(property)
    return coordinates
      ? [{ property, position: [coordinates.latitude, coordinates.longitude] as [number, number] }]
      : []
  })
}

interface PriceMarkerProps {
  property: PropertySummary
  position: [number, number]
  href: string
  active: boolean
  onActivate: (propertyId: string | null) => void
  onSelect: (propertyId: string) => void
}

const PriceMarker = memo(function PriceMarker({
  property,
  position,
  href,
  active,
  onActivate,
  onSelect,
}: PriceMarkerProps) {
  const markerRef = useRef<L.Marker>(null)
  const label = formatPriceShort(property.price, property.operationType)
  // El ícono solo cambia con el precio: recrearlo al encenderse haría perder el foco del teclado.
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'price-pin',
        html: `<span class="price-pin__label">${escapeHtml(label)}</span>`,
        iconSize: [0, 0],
      }),
    [label],
  )
  const handlers = useMemo(
    () => ({
      click: () => onSelect(property.id),
      mouseover: () => onActivate(property.id),
      mouseout: () => onActivate(null),
    }),
    [onActivate, onSelect, property.id],
  )

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    marker.getElement()?.classList.toggle('is-active', active)
    marker.setZIndexOffset(active ? 1000 : 0)
  }, [active])

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      title={`${property.title}, ${formatPrice(property.price, property.operationType)}`}
      eventHandlers={handlers}
    >
      <Popup className="map-card-popup" closeButton={false} offset={[0, -14]}>
        <Link to={href} className="map-card">
          {property.coverImageUrl && (
            <img className="map-card__image" src={gatewayUrl(property.coverImageUrl)} alt="" />
          )}
          <span className="map-card__body">
            <span className="map-card__price">
              {formatPrice(property.price, property.operationType)}
            </span>
            <span className="map-card__title">{property.title}</span>
            <span className="map-card__zone">{property.zone}</span>
          </span>
        </Link>
      </Popup>
    </Marker>
  )
})

/**
 * Encuadra los marcadores cuando cambian los resultados y cuando el mapa aparece: en el celular empieza
 * oculto, y Leaflet necesita saber su tamaño real para calcular el zoom.
 */
function FitToMarkers({ located }: { located: LocatedProperty[] }) {
  const map = useMap()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const container = map.getContainer()
    const observer = new ResizeObserver(() => {
      map.invalidateSize()
      setVisible(container.clientWidth > 0 && container.clientHeight > 0)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    if (!visible) return
    // Sin animación: el encuadre se repite en cada búsqueda, y si la persona sale de la página a mitad
    // de un zoom animado, Leaflet falla al desmontar el mapa.
    if (located.length === 0) map.setView(SANTA_CRUZ, CITY_ZOOM, { animate: false })
    else if (located.length === 1)
      map.setView(located[0].position, STREET_ZOOM - 1, { animate: false })
    else
      map.fitBounds(L.latLngBounds(located.map((item) => item.position)), {
        padding: [56, 56],
        maxZoom: STREET_ZOOM,
        animate: false,
      })
  }, [map, located, visible])

  return null
}
