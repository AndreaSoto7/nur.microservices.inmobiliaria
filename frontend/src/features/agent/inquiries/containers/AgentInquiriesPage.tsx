import { useCallback, useState } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { EmptyState } from '../../../../shared/ui/EmptyState'
import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { Pagination } from '../../../../shared/ui/Pagination'
import { RowListSkeleton } from '../../../../shared/ui/RowListSkeleton'
import { usePropertyTitles } from '../../../my-visits/usePropertyTitles'
import { InquiryRow } from '../components/InquiryRow'
import { useAgentInquiries } from '../useAgentInquiries'
import { InquiryDetailSection } from './InquiryDetailSection'

export function AgentInquiriesPage() {
  const { goToPage, page, loading, error, retry } = useAgentInquiries()
  const titles = usePropertyTitles(
    (page?.data ?? []).map((inquiry) => inquiry.propertyId),
    'agent',
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const handleToggle = useCallback(
    (inquiryId: string) => setOpenId((current) => (current === inquiryId ? null : inquiryId)),
    [],
  )

  return (
    <section className="page">
      <h1 className="account__title">Consultas</h1>
      {loading ? (
        <RowListSkeleton label="Cargando las consultas…" />
      ) : error ? (
        <div className="stack">
          <ErrorMessage title="No se pudieron cargar las consultas" message={error} />
          <Button variant="secondary" onClick={() => retry()}>
            Reintentar
          </Button>
        </div>
      ) : page && page.data.length > 0 ? (
        <>
          <ul className="row-list">
            {page.data.map((inquiry) => (
              <InquiryRow
                key={inquiry.id}
                inquiry={inquiry}
                title={titles[inquiry.propertyId]}
                href={`/agent/properties/${inquiry.propertyId}`}
                expanded={openId === inquiry.id}
                onToggle={handleToggle}
              >
                {openId === inquiry.id && <InquiryDetailSection inquiryId={inquiry.id} />}
              </InquiryRow>
            ))}
          </ul>
          <Pagination
            page={page.page.number}
            totalPages={page.page.totalPages}
            onPageChange={goToPage}
          />
        </>
      ) : (
        <EmptyState title="Todavía no recibiste consultas">
          Cuando un interesado pregunte por una de tus propiedades, aparecerá aquí.
        </EmptyState>
      )}
    </section>
  )
}
