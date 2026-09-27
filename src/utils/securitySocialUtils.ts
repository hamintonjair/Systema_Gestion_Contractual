import { CertificadoSupervisionData } from '../types';

/**
 * Detecta si un valor corresponde a los datos estáticos/mock de demostración
 * de seguridad social (COOSALUD, COLFONDO, POSITIVA, 87049978, 218.900, 280.200, 9.200)
 * que quedaron guardados en la BD o en localStorage en versiones previas.
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

/**
 * Detecta si una fecha de registro presupuestal corresponde a una fecha estática/mock de ejemplo
 */
export const isLegacyMockDate = (val?: string | number | null): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toUpperCase();
  if (!str) return false;

  return (
    str === '13/08/2026' ||
    str === '31/08/2026' ||
    str === '14/01/2026' ||
    str === '15/01/2026' ||
    str === '16/01/2026' ||
    str === '14/07/2026' ||
    str === '15/07/2026' ||
    str === '01/07/2026' ||
    str === '01/01/2026' ||
    str === '31/12/2026' ||
    str === 'N/A' ||
    str === '-'
  );
};

/**
 * Detecta si un código de rubro presupuestal corresponde a un código estático/mock de ejemplo
 */
export const isLegacyMockCodigoRubro = (val?: string | number | null): boolean => {
  if (val === undefined || val === null) return false;
  const str = String(val).trim().toUpperCase();
  if (!str) return false;

  return (
    str === '2.3.2.02.02.008.04.01.02' ||
    str === '2.3.2.02.02' ||
    str === '2.3.2' ||
    str.includes('2.3.2.02.02.008') ||
    str === '0' ||
    str === '0000' ||
    str === 'N/A' ||
    str === '-' ||
    str === 'EJEMPLO' ||
    str === 'CODIGO-EJEMPLO'
  );
};

export const sanitizeSocialField = (val?: string | number | null): string => {
  if (isLegacyMockSocialSecurity(val)) {
    return '';
  }
  return val ? String(val) : '';
};

export const sanitizeBudgetField = (val?: string | number | null, isDate = false): string => {
  if (!val) return '';
  if (isDate && isLegacyMockDate(val)) return '';
  if (!isDate && isLegacyMockCodigoRubro(val)) return '';
  return String(val);
};

/**
 * Sanitiza cualquier objeto de Certificado de Supervisión para eliminar datos mock heredados
 * tanto de seguridad social como presupuestales (fecha y código rubro).
 */
export const sanitizeCertificadoData = <T extends Partial<CertificadoSupervisionData> | Record<string, any>>(
  cert: T | null | undefined
): T => {
  if (!cert || typeof cert !== 'object') {
    return (cert || {}) as T;
  }

  const cleaned: any = { ...cert };

  // 1. Seguridad Social
  if (isLegacyMockSocialSecurity(cleaned.saludValor)) cleaned.saludValor = '';
  if (isLegacyMockSocialSecurity(cleaned.saludEps)) cleaned.saludEps = '';
  if (isLegacyMockSocialSecurity(cleaned.saludPlanilla)) cleaned.saludPlanilla = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionValor)) cleaned.pensionValor = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionFondo)) cleaned.pensionFondo = '';
  if (isLegacyMockSocialSecurity(cleaned.pensionPlanilla)) cleaned.pensionPlanilla = '';
  if (isLegacyMockSocialSecurity(cleaned.arpValor)) cleaned.arpValor = '';
  if (isLegacyMockSocialSecurity(cleaned.arpAseguradora)) cleaned.arpAseguradora = '';
  if (isLegacyMockSocialSecurity(cleaned.arpPlanilla)) cleaned.arpPlanilla = '';

  // 2. Presupuestales: Fecha Registro Presupuestal y Código Rubro Presupuestal
  if (isLegacyMockDate(cleaned.fechaRegistroPresupuestal)) cleaned.fechaRegistroPresupuestal = '';
  if (isLegacyMockDate(cleaned.fechaRegistroPresupuestal2)) cleaned.fechaRegistroPresupuestal2 = '';
  if (isLegacyMockDate(cleaned.fechaRegistroPresupuestal3)) cleaned.fechaRegistroPresupuestal3 = '';
  if (isLegacyMockDate(cleaned.fechaRegistroPresupuestal4)) cleaned.fechaRegistroPresupuestal4 = '';
  if (isLegacyMockDate(cleaned.fechaRegistroPresupuestal5)) cleaned.fechaRegistroPresupuestal5 = '';

  if (isLegacyMockCodigoRubro(cleaned.codigoRubro)) cleaned.codigoRubro = '';
  if (isLegacyMockCodigoRubro(cleaned.codigoRubro2)) cleaned.codigoRubro2 = '';
  if (isLegacyMockCodigoRubro(cleaned.codigoRubro3)) cleaned.codigoRubro3 = '';
  if (isLegacyMockCodigoRubro(cleaned.codigoRubro4)) cleaned.codigoRubro4 = '';
  if (isLegacyMockCodigoRubro(cleaned.codigoRubro5)) cleaned.codigoRubro5 = '';

  return cleaned as T;
};
