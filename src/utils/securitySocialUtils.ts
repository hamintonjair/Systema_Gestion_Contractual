import { CertificadoSupervisionData } from '../types';

/**
 * Detecta si un valor corresponde a los datos estáticos/mock de demostración
 * (COOSALUD, COLFONDO, POSITIVA, 87049978, 218.900, 280.200, 9.200) que quedaron
 * guardados en la BD o en localStorage en versiones previas.
 */
export const isLegacyMockSocialSecurity = (val?: string | number | null): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toUpperCase();
  if (!str) return false;

  const cleanedNum = str.replace(/[^0-9]/g, '');

  return (
    str === 'COOSALUD' ||
    str.includes('COOSALUD') ||
    str === 'COLFONDO' ||
    str.includes('COLFONDO') ||
    str === 'POSITIVA' ||
    str === 'A.R.P POSITIVA' ||
    str === 'ARL POSITIVA' ||
    cleanedNum === '87049978' ||
    cleanedNum === '218900' ||
    cleanedNum === '280200' ||
    cleanedNum === '9200' ||
    str === '218.900' ||
    str === '280.200' ||
    str === '9.200' ||
    str === '$ 218.900' ||
    str === '$ 280.200' ||
    str === '$ 9.200'
  );
};

export const sanitizeSocialField = (val?: string | number | null): string => {
  if (isLegacyMockSocialSecurity(val)) {
    return '';
  }
  return val ? String(val) : '';
};

/**
 * Sanitiza cualquier objeto de Certificado de Supervisión para eliminar datos mock heredados.
 */
export const sanitizeCertificadoData = <T extends Partial<CertificadoSupervisionData> | Record<string, any>>(
  cert: T | null | undefined
): T => {
  if (!cert || typeof cert !== 'object') {
    return (cert || {}) as T;
  }

  const cleaned: any = { ...cert };

  if (isLegacyMockSocialSecurity(cleaned.saludValor)) cleaned.saludValor = '';
  if (isLegacyMockSocialSecurity(cleaned.saludEps)) cleaned.saludEps = '';
  if (isLegacyMockSocialSecurity(cleaned.saludPlanilla)) cleaned.saludPlanilla = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionValor)) cleaned.pensionValor = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionFondo)) cleaned.pensionFondo = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionPlanilla)) cleaned.pensionPlanilla = '';
  if (isLegacyMockSocialSecurity(cleaned.arpValor)) cleaned.arpValor = '';
  if (isLegacyMockSocialSecurity(cleaned.arpAseguradora)) cleaned.arpAseguradora = '';
  if (isLegacyMockSocialSecurity(cleaned.arpPlanilla)) cleaned.arpPlanilla = '';

  return cleaned as T;
};
