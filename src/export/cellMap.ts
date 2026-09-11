export const PRESUPUESTO_ROWS = [41, 42, 43, 44, 45, 46];

export const SEGSOCIAL_ROWS = {
  salud: 50,
  pension: 52,
  arp: 54
};

export const LIQUIDACION_ROW = 61;

export const CELDAS_CON_FORMULA = [
  'F36',
  'W61',
  'C70',
  'O70',
  'R70',
  'B71',
  'N71',
  'Q71',
  'L75'
];

export interface CellMapping {
  // 1. Información contractual
  contratistaNombre: string;      // I8
  tipoContrato: string;           // I10
  contratoNro: string;            // I12
  contratoAno: string;            // O12
  tipoDocumento: string;          // I14
  contratistaDocumento: string;   // L14
  supervisorNombre: string;       // I16
  supervisorCargo: string;        // I18
  clausulaNro: string;            // O22

  // 2. Información financiera
  numeroCuenta: string;           // G26
  banco: string;                  // R26
  tipoCuenta: string;             // AA26
  fechaInicio: string;            // J28
  plazoMeses: string;             // V28
  plazoDias: string;              // Z28
  fechaTerminacion: string;       // J30
  valorInicial: string;           // F32
  adicion1: string;               // F33
  adicion2: string;               // F34
  adicion3: string;               // F35
  prorroga1Dias: string;          // Q33
  prorroga2Dias: string;          // Q34
  prorroga3Dias: string;          // Q35

  // 5. Liquidación del pago
  pagoNro: string;                // C61
  periodoDesde: string;           // E61
  periodoHasta: string;           // H61
  porcentajeEjecucion: string;    // K61
  valorPagadoAcumulado: string;   // N61
  valorAPagarSinIva: string;      // Q61
  iva: string;                    // T61
  saldoPorPagar: string;          // AA61

  // 6. Certificación
  observacionesLiquidacion: string; // C64

  // 7. Fecha de expedición
  expedicionDia: string;          // N77
  expedicionMes: string;          // Q77
  expedicionAno: string;          // U77
}

export const CELL_MAP: CellMapping = {
  contratistaNombre: 'I8',
  tipoContrato: 'I10',
  contratoNro: 'I12',
  contratoAno: 'O12',
  tipoDocumento: 'I14',
  contratistaDocumento: 'L14',
  supervisorNombre: 'I16',
  supervisorCargo: 'I18',
  clausulaNro: 'O22',

  numeroCuenta: 'G26',
  banco: 'R26',
  tipoCuenta: 'AA26',
  fechaInicio: 'J28',
  plazoMeses: 'V28',
  plazoDias: 'Z28',
  fechaTerminacion: 'J30',
  valorInicial: 'F32',
  adicion1: 'F33',
  adicion2: 'F34',
  adicion3: 'F35',
  prorroga1Dias: 'Q33',
  prorroga2Dias: 'Q34',
  prorroga3Dias: 'Q35',

  pagoNro: 'C61',
  periodoDesde: 'E61',
  periodoHasta: 'H61',
  porcentajeEjecucion: 'K61',
  valorPagadoAcumulado: 'N61',
  valorAPagarSinIva: 'Q61',
  iva: 'T61',
  saldoPorPagar: 'AA61',

  observacionesLiquidacion: 'C64',

  expedicionDia: 'N77',
  expedicionMes: 'Q77',
  expedicionAno: 'U77',
};
