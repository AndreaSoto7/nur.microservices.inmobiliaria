// Reflejo de contracts/openapi/visit-service.yaml. No agregues campos que no estén ahí.

export interface RequestVisitRequest {
  propertyId: string
  /** UTC, con Z al final. */
  proposedAt: string
  clientNote?: string
}

export interface SendInquiryRequest {
  propertyId: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  message: string
}

export interface CreatedResponse {
  id: string
}
