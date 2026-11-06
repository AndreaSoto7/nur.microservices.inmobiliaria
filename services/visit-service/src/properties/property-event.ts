import { isISO8601 } from 'class-validator';
import { uuidPattern } from '../shared/http-contract.js';

const statuses = {
  PropertyPublished: ['PUBLISHED'],
  PropertyUpdated: ['PUBLISHED', 'RESERVED'],
  PropertyPaused: ['PAUSED'],
  PropertyReserved: ['RESERVED'],
  PropertySold: ['SOLD'],
  PropertyRented: ['RENTED'],
} as const;
type PropertyEventType = keyof typeof statuses;

export type PropertyEvent = {
  eventId: string;
  type: PropertyEventType;
  propertyId: string;
  agentId: string;
  status: string;
  occurredAt: string;
  correlationId: string;
  details?: { title: string; zone: string; operationType: 'SALE' | 'RENT' };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function parsePropertyEvent(value: unknown): PropertyEvent | undefined {
  if (
    !isObject(value) ||
    typeof value.eventType !== 'string' ||
    !Number.isInteger(value.eventVersion) ||
    Number(value.eventVersion) < 1
  ) {
    throw new Error('Envelope de propiedad inválido');
  }
  if (value.eventVersion !== 1 || !Object.hasOwn(statuses, value.eventType))
    return;

  const type = value.eventType as PropertyEventType;
  const { payload, eventId, occurredAt, aggregateId } = value;
  if (
    value.producer !== 'listing-service' ||
    value.aggregateType !== 'Property' ||
    !isUuid(eventId) ||
    !isUuid(aggregateId) ||
    !isObject(payload) ||
    !isUuid(payload.propertyId) ||
    payload.propertyId.toLowerCase() !== aggregateId.toLowerCase() ||
    !isUuid(payload.agentId) ||
    typeof occurredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(occurredAt) ||
    !isISO8601(occurredAt, { strict: true }) ||
    typeof payload.status !== 'string' ||
    !(statuses[type] as readonly string[]).includes(payload.status)
  ) {
    throw new Error('Evento de propiedad v1 inválido');
  }

  const event = {
    eventId,
    type,
    propertyId: aggregateId,
    agentId: payload.agentId,
    occurredAt,
    correlationId:
      typeof value.correlationId === 'string' &&
      /^[A-Za-z0-9._-]{1,128}$/.test(value.correlationId)
        ? value.correlationId
        : eventId,
    status: payload.status,
  };
  if (type !== 'PropertyPublished' && type !== 'PropertyUpdated') return event;

  const { title, location, operationType } = payload;
  if (
    typeof title !== 'string' ||
    !title ||
    [...title].length > 150 ||
    !isObject(location) ||
    typeof location.zone !== 'string' ||
    !location.zone ||
    [...location.zone].length > 100 ||
    (operationType !== 'SALE' && operationType !== 'RENT')
  ) {
    throw new Error('Datos de proyección de la propiedad inválidos');
  }
  return { ...event, details: { title, zone: location.zone, operationType } };
}
