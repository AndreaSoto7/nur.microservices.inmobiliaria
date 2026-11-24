import { Link } from 'react-router'
import { ArrowLeftIcon } from '../../../../shared/ui/icons'
import { PropertyWizard } from './PropertyWizard'

export function PropertyCreatePage() {
  return (
    <section className="page page--wide">
      <Link to="/agent/properties" className="back-link">
        <ArrowLeftIcon className="back-link__icon" />
        Mis propiedades
      </Link>
      <div className="page-header page-header--stacked">
        <h1>Nueva propiedad</h1>
        <p className="row-card__meta">
          Se guarda como borrador: nadie la ve hasta que la publiques.
        </p>
      </div>
      <PropertyWizard />
    </section>
  )
}
