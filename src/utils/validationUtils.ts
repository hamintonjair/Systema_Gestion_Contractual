import { ReportData } from '../types';

export interface RadicacionValidationError {
  type: 'general' | 'actividades' | 'fotos';
  field?: string;
  obligacionNum?: number | string;
  message: string;
}

export function validateReportForRadicacion(report: ReportData): { isValid: boolean; errors: RadicacionValidationError[] } {
  const errors: RadicacionValidationError[] = [];

  // 1. Campos Generales del Contrato
  const requiredGeneralFields: { key: keyof ReportData; label: string }[] = [
    { key: 'contratoNro', label: 'Número de Contrato' },
    { key: 'objeto', label: 'Objeto del Contrato' },
    { key: 'valorContrato', label: 'Valor Total del Contrato' },
    { key: 'periodoDesde', label: 'Período Desde' },
    { key: 'periodoHasta', label: 'Período Hasta' },
    { key: 'supervisorNombre', label: 'Nombre del Supervisor' },
    { key: 'supervisorDocumento', label: 'C.C. del Supervisor' }
  ];

  for (const item of requiredGeneralFields) {
    const val = report[item.key];
    if (!val || typeof val !== 'string' || val.trim() === '') {
      errors.push({
        type: 'general',
        field: item.key,
        message: `El campo general "${item.label}" se encuentra vacío o incompleto.`
      });
    }
  }

  // 2. Obligaciones
  if (!report.obligaciones || report.obligaciones.length === 0) {
    errors.push({
      type: 'general',
      message: 'El informe debe contener al menos una (1) obligación contractual.'
    });
  } else {
    report.obligaciones.forEach((obs, index) => {
      const num = obs.num || (index + 1);

      // Validar descripción de la obligación
      if (!obs.descripcion || obs.descripcion.trim() === '') {
        errors.push({
          type: 'actividades',
          obligacionNum: num,
          message: `La Obligación #${num} no tiene una descripción definida.`
        });
      }

      // Validar actividades realizadas
      if (!obs.actividades || obs.actividades.trim() === '') {
        errors.push({
          type: 'actividades',
          obligacionNum: num,
          message: `La Obligación #${num} tiene el campo de actividades realizadas vacío.`
        });
      }

      // Validar evidencias fotográficas: REQUISITO INDISPENSABLE (al menos 2 fotos por obligación)
      const fotosCount = obs.fotos?.length || 0;
      if (fotosCount < 2) {
        errors.push({
          type: 'fotos',
          obligacionNum: num,
          message: `La Obligación #${num} tiene ${fotosCount} foto(s) adjunta(s). Requisito Indispensable: cada obligación debe tener al menos dos (2) evidencias fotográficas (mínimo 2, máximo 5).`
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
