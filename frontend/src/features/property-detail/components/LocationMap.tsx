import { memo } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import type { Location } from '../../../core/models/listing'
import {
  coordinatesOf,
  LOCATION_PIN,
  STREET_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from '../../../shared/map/mapConfig'

interface LocationMapProps {
  location: Location
  title: string
}

/**
 * Dumb: dónde queda la propiedad. La rueda del mouse no hace zoom para no secuestrar el scroll de la
 * página; los botones + y − sí. Sin coordenadas, solo la zona y la dirección.
 */
export const LocationMap = memo(function LocationMap({ location, title }: LocationMapProps) {
  const coordinates = coordinatesOf(location)
  const place = [location.address, location.zone].filter(Boolean).join(' · ')

  return (
    <section className="detail__location" aria-labelledby="detail-location-title">
      <h2 id="detail-location-title">Ubicación</h2>
      <p className="detail__place">{place}</p>
      {coordinates ? (
        <div className="location-map" role="region" aria-label={`Mapa de ${title}`}>
          <MapContainer
            center={[coordinates.latitude, coordinates.longitude]}
            zoom={STREET_ZOOM}
            scrollWheelZoom
            className="location-map__canvas"
          >
            <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
            <Marker
              position={[coordinates.latitude, coordinates.longitude]}
              icon={LOCATION_PIN}
              title={title}
              keyboard={false}
            />
          </MapContainer>
        </div>
      ) : (
        <p className="detail__no-location">
          El agente todavía no marcó la ubicación exacta en el mapa.
        </p>
      )}
    </section>
  )
})
