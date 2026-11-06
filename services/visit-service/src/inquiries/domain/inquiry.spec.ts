import { Inquiry, InvalidInquiryError } from './inquiry.js';

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
  it('normaliza el mensaje y el nombre, y admite omitir el teléfono', () => {
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
  ])('rechaza texto inválido: %o', (invalid) => {
    expect(() => Inquiry.receive({ ...input, ...invalid })).toThrow(
      InvalidInquiryError,
    );
  });
});
