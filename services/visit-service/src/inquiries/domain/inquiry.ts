export type InquiryInput = {
  propertyId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  message: string;
};

export type InquiryDetails = InquiryInput & {
  id: string;
  createdAt: Date;
  reply?: string;
  repliedAt?: Date;
};

/** Una fila de la bandeja del agente o de "Mis consultas" del cliente. */
export type AgentInquirySummary = Pick<
  InquiryDetails,
  'id' | 'propertyId' | 'contactName' | 'createdAt' | 'repliedAt'
>;

export class InvalidInquiryError extends Error {}
export class InquiryAlreadyRepliedError extends Error {}

/** Lo que el agente necesita de una consulta para responderla. */
export type AssignedInquiry = {
  id: string;
  propertyId: string;
  clientId: string;
  agentId: string;
  repliedAt: Date | undefined;
};

export type InquiryReply = {
  inquiryId: string;
  message: string;
  repliedAt: Date;
};

/** Una consulta se responde una vez: la respuesta cierra la conversación (el cliente puede volver a escribir). */
export function replyToInquiry(
  inquiry: AssignedInquiry,
  message: string,
  repliedAt: Date,
): InquiryReply {
  if (inquiry.repliedAt) throw new InquiryAlreadyRepliedError();
  return { inquiryId: inquiry.id, message: text(message, 2000), repliedAt };
}

/** Un teléfono: dígitos con un + inicial opcional y espacios, guiones o paréntesis; de 7 a 15 dígitos (E.164). */
export const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]*[0-9]$/u;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

function phone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/gu, '').length;
  if (
    !PHONE_PATTERN.test(trimmed) ||
    digits < MIN_PHONE_DIGITS ||
    digits > MAX_PHONE_DIGITS
  ) {
    throw new InvalidInquiryError();
  }
  return trimmed;
}

function text(value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed || value.includes('\0') || [...value].length > max) {
    throw new InvalidInquiryError();
  }
  return trimmed;
}

export class Inquiry {
  private constructor(
    readonly id: string,
    readonly propertyId: string,
    readonly clientId: string,
    readonly agentId: string,
    readonly createdAt: Date,
    readonly contactName: string,
    readonly contactEmail: string,
    readonly contactPhone: string | undefined,
    readonly message: string,
  ) {}

  static receive(
    input: InquiryInput & {
      id: string;
      clientId: string;
      agentId: string;
      createdAt: Date;
    },
  ): Inquiry {
    return new Inquiry(
      input.id,
      input.propertyId,
      input.clientId,
      input.agentId,
      input.createdAt,
      text(input.contactName, 150),
      text(input.contactEmail, 254),
      input.contactPhone === undefined ? undefined : phone(input.contactPhone),
      text(input.message, 2000),
    );
  }
}
