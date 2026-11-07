-- Los avisos de consultas y visitas (ADR 0007): sin esto, el CHECK rechazaría los tipos nuevos.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'WELCOME',
    'VISIT_REQUESTED',
    'PROPERTY_RESERVED',
    'INQUIRY_RECEIVED',
    'VISIT_SCHEDULED',
    'VISIT_REJECTED',
    'VISIT_CANCELLED',
    'VISIT_CANCELLED_BY_CLIENT'
));
