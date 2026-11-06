import type {
  LeadContact,
  VisitTransaction,
} from '../../visits/domain/visit.repository.js';

export async function openLeadOnContact(
  transaction: Pick<VisitTransaction, 'openLead' | 'enqueue'>,
  contact: LeadContact,
  correlationId: string,
  causationId: string,
): Promise<void> {
  const leadId = await transaction.openLead(contact);
  if (!leadId) return;
  const { openedAt, ...participants } = contact;
  await transaction.enqueue({
    type: 'LeadOpened',
    aggregateId: leadId,
    occurredAt: openedAt,
    correlationId,
    causationId,
    payload: { ...participants, leadId },
  });
}
