import {
  Inquiry,
  InquiryAlreadyRepliedError,
  InvalidInquiryError,
  replyToInquiry,
} from './inquiry.js';

const input = {
  id: 'inquiry',
  propertyId: 'property',
  clientId: 'client',
  agentId: 'agent',
  createdAt: new Date('2026-11-05T16:00:00Z'),
  contactName: '  María Pérez  ',
  contactEmail: 'maria@example.com',
  message: ' ¿Aceptan mascotas? ',
};

describe('Inquiry', () => {
  it('normalizes the message and the name, and allows omitting the phone', () => {
    expect(Inquiry.receive(input)).toMatchObject({
      contactName: 'María Pérez',
      message: '¿Aceptan mascotas?',
      contactPhone: undefined,
    });
  });

  it.each([
    { message: ' \n\t' },
    { contactName: 'a'.repeat(151) },
    { contactPhone: '123\0' },
  ])('rejects invalid text: %o', (invalid) => {
    expect(() => Inquiry.receive({ ...input, ...invalid })).toThrow(
      InvalidInquiryError,
    );
  });

  it.each(['+591 71234567', '71234567', '(3) 352-1234'])(
    'accepts a phone number: %s',
    (contactPhone) => {
      expect(Inquiry.receive({ ...input, contactPhone })).toMatchObject({
        contactPhone,
      });
    },
  );

  it.each([
    'llámame al 712',
    '123456',
    '+591 7123 4567 8901 234',
    '++591 71234567',
    '7123-',
  ])('rejects a phone that is not one: %s', (contactPhone) => {
    expect(() => Inquiry.receive({ ...input, contactPhone })).toThrow(
      InvalidInquiryError,
    );
  });

  describe('replyToInquiry', () => {
    const assigned = {
      id: 'inquiry',
      propertyId: 'property',
      clientId: 'client',
      agentId: 'agent',
      repliedAt: undefined,
    };
    const now = new Date('2026-11-24T12:00:00Z');

    it('keeps the trimmed reply and when it was written', () => {
      expect(replyToInquiry(assigned, '  Un mes de garantía. ', now)).toEqual({
        inquiryId: 'inquiry',
        message: 'Un mes de garantía.',
        repliedAt: now,
      });
    });

    it('rejects a second reply', () => {
      expect(() =>
        replyToInquiry({ ...assigned, repliedAt: now }, 'Otra', now),
      ).toThrow(InquiryAlreadyRepliedError);
    });

    it('rejects an empty reply', () => {
      expect(() => replyToInquiry(assigned, ' \n ', now)).toThrow(
        InvalidInquiryError,
      );
    });
  });
});
