import { ErrorMessage } from '../../../../shared/ui/ErrorMessage'
import { LoadingState } from '../../../../shared/ui/LoadingState'
import { LeadNotes } from '../components/LeadNotes'
import { useLeadNotes } from '../useAgentLeads'

/** Smart: se monta al abrir las notas, así que recién ahí las pide. */
export function LeadNotesSection({ leadId }: { leadId: string }) {
  const { notes, loading, error } = useLeadNotes(leadId)
  if (loading) return <LoadingState label="Cargando las notas…" />
  if (error || !notes) return <ErrorMessage message={error ?? 'Intenta de nuevo.'} />
  return <LeadNotes notes={notes} />
}
