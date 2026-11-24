import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../../shared/ui/Button'
import { EmptyState } from '../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../shared/ui/RowListSkeleton'
import { MyInquiryRow } from '../components/MyInquiryRow'
import { useCatalogTitles } from '../useCatalogTitles'
import { useMyInquiries } from '../useMyInquiries'
import { MyInquiryConversation } from './MyInquiryConversation'

/** Smart: las consultas que envió el interesado y, al abrir una, la respuesta del agente. */
export function MyInquiriesPage() {
  const { goToPage, page, loading, error, retry } = useMyInquiries()
  const titles = useCatalogTitles((page?.data ?? []).map((inquiry) => inquiry.propertyId))
  const [openId, setOpenId] = useState<string | null>(null)
  const handleToggle = useCallback(
    (inquiryId: string) => setOpenId((current) => (current === inquiryId ? null : inquiryId)),
    [],
  )

  return (
    <section className="page">
      <h1 className="account__title">Mis consultas</h1>
      {loading ? (
        <RowListSkeleton label="Cargando tus consultas…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar tus consultas" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((inquiry) => (
              <MyInquiryRow
                key={inquiry.id}
                inquiry={inquiry}
                title={titles[inquiry.propertyId]}
                href={`/properties/${inquiry.propertyId}`}
                expanded={openId === inquiry.id}
                onToggle={handleToggle}
              >
                {openId === inquiry.id && <MyInquiryConversation inquiryId={inquiry.id} />}
              </MyInquiryRow>
            ))}
          </ul>
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </>
      ) : (
        <EmptyState title="Todavía no enviaste consultas">
          Desde la ficha de una propiedad puedes preguntarle al agente.{' '}
          <Link to="/">Buscar propiedades</Link>
        </EmptyState>
      )}
    </section>
  )
}
