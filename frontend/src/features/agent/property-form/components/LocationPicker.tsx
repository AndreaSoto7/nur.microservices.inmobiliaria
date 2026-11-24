import type { LeafletEventHandlerFnMap, Marker as LeafletMarker } from 'leaflet'
import { memo, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import {
  CITY_ZOOM,
  LOCATION_PIN,
  SANTA_CRUZ,
  STREET_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
  type Coordinates,
} from '../../../../shared/map/mapConfig'
import { Button } from '../../../../shared/ui/Button'

interface LocationPickerProps {
  value: Coordinates | null
  onChange: (value: Coordinates | null) => void
}

/** Seis decimales: lo que guarda listing (numeric(9,6)), unos 10 cm. */
const round = (value: number) => Math.round(value * 1e6) / 1e6

/**
 * Dumb: el agente toca el mapa para marcar dónde está la propiedad y puede arrastrar el alfiler. Para el
 * teclado, las coordenadas también se pueden escribir.
 */
export const LocationPicker = memo(function LocationPicker({
  value,
  onChange,
}: LocationPickerProps) {
  const markerRef = useRef<LeafletMarker>(null)
  const markerHandlers = useMemo<LeafletEventHandlerFnMap>(
    () => ({
      dragend: () => {
        const position = markerRef.current?.getLatLng()
        if (position) onChange({ latitude: round(position.lat), longitude: round(position.lng) })
      },
    }),
    [onChange],
  )

  return (
    <fieldset className="field location-picker">
      <legend>Ubicación en el mapa (opcional)</legend>
      <p className="location-picker__hint" id="location-picker-hint">
        {value
          ? 'Arrastra el alfiler para ajustarlo o toca otro punto del mapa.'
          : 'Toca el mapa donde está la propiedad. Así aparece en el mapa del catálogo.'}
      </p>
      <div className="location-map location-map--picker" aria-describedby="location-picker-hint">
        <MapContainer
          center={value ? [value.latitude, value.longitude] : SANTA_CRUZ}
          zoom={value ? STREET_ZOOM : CITY_ZOOM}
          scrollWheelZoom
          className="location-map__canvas"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <PickOnClick onPick={onChange} />
          {value && (
            <Marker
              ref={markerRef}
              position={[value.latitude, value.longitude]}
              icon={LOCATION_PIN}
              draggable
              keyboard={false}
              eventHandlers={markerHandlers}
            />
          )}
        </MapContainer>
      </div>
      <div className="location-picker__footer">
        <p className="location-picker__coords">
          {value
            ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
            : 'Sin ubicación marcada'}
        </p>
        {value && (
          <Button variant="secondary" onClick={() => onChange(null)}>
            Quitar ubicación
          </Button>
        )}
      </div>
      <details className="location-picker__manual">
        <summary>Escribir las coordenadas</summary>
        <CoordinateInputs
          key={value ? `${value.latitude},${value.longitude}` : 'none'}
          value={value}
          onApply={onChange}
        />
      </details>
    </fieldset>
  )
})

function PickOnClick({ onPick }: { onPick: (value: Coordinates) => void }) {
  useMapEvents({
    click: (event) =>
      onPick({ latitude: round(event.latlng.lat), longitude: round(event.latlng.lng) }),
  })
  return null
}

function CoordinateInputs({
  value,
  onApply,
}: {
  value: Coordinates | null
  onApply: (value: Coordinates) => void
}) {
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '')
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '')
  const [error, setError] = useState<string>()

  // No es un <form>: vive dentro del formulario de datos y no puede anidarse otro.
  function apply() {
    const lat = Number(latitude)
    const lng = Number(longitude)
    const valid =
      latitude.trim() !== '' &&
      longitude.trim() !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    if (!valid) {
      setError('Escribe una latitud entre -90 y 90 y una longitud entre -180 y 180.')
      return
    }
    setError(undefined)
    onApply({ latitude: round(lat), longitude: round(lng) })
  }

  // Enter acá aplica las coordenadas; sin esto enviaría el formulario de datos que lo contiene.
  function applyOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    apply()
  }

  return (
    <div className="location-picker__inputs">
      <label className="field">
        Latitud
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="-17.7833"
          value={latitude}
          onKeyDown={applyOnEnter}
          onChange={(event) => setLatitude(event.target.value)}
        />
      </label>
      <label className="field">
        Longitud
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="-63.1821"
          value={longitude}
          onKeyDown={applyOnEnter}
          onChange={(event) => setLongitude(event.target.value)}
        />
      </label>
      <Button variant="secondary" onClick={apply}>
        Usar estas coordenadas
      </Button>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
