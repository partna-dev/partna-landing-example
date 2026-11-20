import catalog from "../../data/catalog.json";

export type Service = {
  serviceId: string;
  title: string;
  category: string;
  categoryTitle: string;
  priceMinor: number;
  note: string;
};

export type Certificate = {
  remainingMinor: number;
  expiresAt: string;
};

export const BRAND = catalog.brand;
export const TENANT_ID = catalog.tenantId;
export const CURRENCY = catalog.currency;
export const PARTNERS: Record<string, number> = catalog.partners;
export const CERTIFICATES: Record<string, Certificate> = catalog.certificates;
export const DISCOUNT_LIMIT_BP = catalog.discount.limitBp;

export function services(): Service[] {
  return catalog.services;
}

export function findService(serviceId: string | undefined): Service | undefined {
  return catalog.services.find((item) => item.serviceId === serviceId);
}

export function partnerCode(value: string | null | undefined): string {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

export function partnerDiscount(discountBp: number | undefined): number {
  return Math.max(0, Math.min(Math.trunc(Number(discountBp) || 0), DISCOUNT_LIMIT_BP));
}

export function certificateRemaining(code: string | null | undefined): number {
  const normalized = partnerCode(code);
  if (!normalized) {
    return 0;
  }
  const certificate = CERTIFICATES[normalized];
  if (!certificate) {
    return 0;
  }
  if (certificate.expiresAt && new Date(certificate.expiresAt) < new Date()) {
    return 0;
  }
  return certificate.remainingMinor || 0;
}
