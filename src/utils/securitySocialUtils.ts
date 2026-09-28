import { CertificadoSupervisionData } from '../types';

/**
 * Mantiene la entrada del usuario intacta.
 * Anteriormente eliminaba palabras válidas como POSITIVA, COOSALUD, COLFONDO, valores y fechas realistas.
 */
export const isLegacyMockSocialSecurity = (val?: string | number | null): boolean => {
  return false;
};

export const isLegacyMockDate = (val?: string | number | null): boolean => {
  return false;
};

export const isLegacyMockCodigoRubro = (val?: string | number | null): boolean => {
  return false;
};

export const sanitizeSocialField = (val?: string | number | null): string => {
  return val !== undefined && val !== null ? String(val) : '';
};

export const sanitizeBudgetField = (val?: string | number | null, isDate = false): string => {
  return val !== undefined && val !== null ? String(val) : '';
};

/**
 * Devuelve los datos del certificado exactamente como fueron ingresados por el usuario,
 * asegurando la persistencia total de nombres de aseguradoras (POSITIVA, SURA, etc.), EPS,
 * fondos de pensión, planillas, valores y fechas presupuestales.
 */
export const sanitizeCertificadoData = <T extends Partial<CertificadoSupervisionData> | Record<string, any>>(
  cert: T | null | undefined
): T => {
  if (!cert || typeof cert !== 'object') {
    return (cert || {}) as T;
  }
  return { ...cert } as T;
};

