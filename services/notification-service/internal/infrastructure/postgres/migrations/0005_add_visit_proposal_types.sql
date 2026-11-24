-- Los avisos de la contrapropuesta de horario: sin esto, el CHECK rechazaría los tipos nuevos.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'WELCOME',
    'VISIT_REQUESTED',
    'PROPERTY_RESERVED',
    'INQUIRY_RECEIVED',
    'INQUIRY_REPLIED',
    'VISIT_SCHEDULED',
    'VISIT_TIME_PROPOSED',
    'VISIT_TIME_PROPOSED_BY_CLIENT',
    'VISIT_PROPOSAL_ACCEPTED',
    'VISIT_REJECTED',
    'VISIT_CANCELLED',
    'VISIT_CANCELLED_BY_CLIENT',
    'VISIT_COMPLETED'
));
