import { PHONE_PATTERN } from '../../inquiries/domain/inquiry.js';

/** Cómo contactar a un interesado: lo último que dio al consultar o pedir una visita. */
export type ClientContact = { name?: string; email?: string; phone?: string };

const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

/** Misma regla que el teléfono de una consulta: dígitos con + inicial opcional; de 7 a 15 dígitos. */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/gu, '').length;
  return (
    PHONE_PATTERN.test(trimmed) &&
    digits >= MIN_PHONE_DIGITS &&
    digits <= MAX_PHONE_DIGITS
  );
}

/** Sin los datos vacíos: lo que falta no se muestra. */
export function compactContact(contact: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): ClientContact | undefined {
  const entries = Object.entries(contact).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].trim() !== '',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
