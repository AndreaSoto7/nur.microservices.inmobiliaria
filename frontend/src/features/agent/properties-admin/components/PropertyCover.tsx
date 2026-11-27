import { memo, useState } from 'react'
import { HouseIcon } from '../../../../shared/ui/icons'
import type { PropertyCoverSource } from '../usePropertyCovers'

interface PropertyCoverProps extends PropertyCoverSource {
  title: string
}

/** Presentación estable cuando falta una foto, se está cargando o no se puede recuperar. */
export const PropertyCover = memo(function PropertyCover({
  src,
  loading,
  title,
}: PropertyCoverProps) {
  const [failedSource, setFailedSource] = useState<string>()
  return (
    <div className="property-admin__cover">
      {loading ? (
        <div className="skeleton property-admin__placeholder" aria-label="Cargando portada" />
      ) : src && src !== failedSource ? (
        <img
          src={src}
          alt={`Portada de ${title}`}
          loading="lazy"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div className="property-admin__placeholder">
          <HouseIcon className="property-admin__placeholder-icon" />
          <span>Sin foto</span>
        </div>
      )}
    </div>
  )
})
