export type InquiryInput = {
  propertyId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  message: string;
};

export type InquiryDetails = InquiryInput & { id: string; createdAt: Date };

export class InvalidInquiryError extends Error {}

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
      input.contactPhone === undefined
        ? undefined
        : text(input.contactPhone, 30),
      text(input.message, 2000),
    );
  }
}
