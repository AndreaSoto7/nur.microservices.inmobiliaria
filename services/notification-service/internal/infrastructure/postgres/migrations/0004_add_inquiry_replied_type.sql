-- El aviso de consulta respondida: sin esto, el CHECK rechazaría el tipo nuevo.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'WELCOME',
    'VISIT_REQUESTED',
    'PROPERTY_RESERVED',
    'INQUIRY_RECEIVED',
    'INQUIRY_REPLIED',
    'VISIT_SCHEDULED',
    'VISIT_REJECTED',
    'VISIT_CANCELLED',
    'VISIT_CANCELLED_BY_CLIENT',
    'VISIT_COMPLETED'
));
