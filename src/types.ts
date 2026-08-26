import { extraerLetrasYNumeroDeValorPagar, formatearObjetoConPeriodo, formatFechaAnioMesDia, formatFechaFiduciaria } from './utils/numberToWords';

export type UserRole = 'super_admin' | 'secretaria_admin' | 'contratista';

export type EstadoInforme = 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'Devuelto';

export interface AuthUser {
  id: string;
  email: string;
  password?: string;
  nombreCompleto: string;
  documentoIdentidad: string;
  role: UserRole;
  secretariaId?: string;
  secretariaNombre?: string;
  secretariaCodigo?: string;
  cargo?: string;
  telefono?: string;
  contratoNro?: string;
  objetoContrato?: string;
  valorContrato?: string;
  valorMensual?: string;
  cdpNro?: string;
  crpNro?: string;
  polizaNro?: string;
  fechaPoliza?: string;
  plazo?: string;
  fechaInicio?: string;
  fechaTerminacion?: string;
  supervisorNombre?: string;
  supervisorCargo?: string;
  supervisorDocumento?: string;
  apoyoSupervisionNombre?: string;
  apoyoSupervisionDocumento?: string;
  createdAt?: string;
}

export const DEMO_USERS: AuthUser[] = [
  {
    id: 'usr-contratista-01',
    email: 'carlos.palacios@quibdo-ejemplo.gov.co',
    password: 'Contratista2026*',
    nombreCompleto: 'CARLOS ANDRÉS PALACIOS CÓRDOBA',
    documentoIdentidad: '1077456123',
    role: 'contratista',
    secretariaId: 'sec-inclusion-170',
    secretariaNombre: 'Secretaría de Inclusión y Cohesión Social',
    secretariaCodigo: '170',
    cargo: 'Contratista de Prestación de Servicios de Apoyo a la Gestión',
    telefono: '3104567890',
    contratoNro: '015',
    objetoContrato: 'PRESTAR LOS SERVICIOS PROFESIONALES DE APOYO A LA GESTIÓN EN EL ÁREA DE SISTEMAS Y TECNOLOGÍAS DE LA INFORMACIÓN...',
    valorContrato: '$25.000.000',
    cdpNro: '2026-00125',
    crpNro: '2026-00189',
    polizaNro: 'POL-998877',
    fechaInicio: '16/01/2026',
    fechaTerminacion: '15/07/2026',
    supervisorNombre: 'DIANA ANDREA MOSQUERA GARCIA',
    supervisorDocumento: '35.602.521',
    apoyoSupervisionNombre: 'YICELA BEJARANO CORDOBA',
    apoyoSupervisionDocumento: '1.077.441.597',
  },
  {
    id: 'usr-admin-sec-01',
    email: 'inclusion@quibdo-choco.gov.co',
    password: 'Inclusion2026*',
    nombreCompleto: 'DIANA ANDREA MOSQUERA GARCIA',
    documentoIdentidad: '35.602.521',
    role: 'secretaria_admin',
    secretariaId: 'sec-inclusion-170',
    secretariaNombre: 'Secretaría de Inclusión y Cohesión Social',
    secretariaCodigo: '170',
    cargo: 'Secretaria de Despacho / Supervisora',
    telefono: '3100000000',
  },
  {
    id: 'usr-superadmin-01',
    email: 'alcaldia@quibdo-choco.gov.co',
    password: 'Quibdo2026*',
    nombreCompleto: 'SUPER ADMINISTRADOR MUNICIPAL',
    documentoIdentidad: '891680011-0',
    role: 'super_admin',
    cargo: 'Administrador General de Plataforma Alcaldía de Quibdó',
  }
];

export interface Secretaria {
  id: string;
  nombre: string;
  nit: string;
  codigo: string;
  banner_url?: string;
  created_at?: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  secretaria_id?: string;
  nombre_completo: string;
  documento_identidad: string;
  telefono: string;
  correo?: string;
  created_at?: string;
}

export interface Contrato {
  id: string;
  contratista_id: string;
  secretaria_id: string;
  contrato_nro: string;
  objeto: string;
  valor_contrato: number | string;
  cdp_nro: string;
  crp_nro: string;
  poliza_nro: string;
  fecha_aprobacion_poliza: string;
  plazo_meses: number | string;
  fecha_inicio: string;
  fecha_terminacion: string;
  supervisor_nombre: string;
  supervisor_documento: string;
  apoyo_supervision_nombre: string;
  apoyo_supervision_documento: string;
  created_at?: string;
}

export interface Notificacion {
  id: string;
  user_id: string;
  mensaje: string;
  tipo: 'aprobacion' | 'devolucion' | 'radicado' | 'info' | 'sistema';
  leida: boolean;
  created_at?: string;
  informe_nro?: string;
  report_id?: string;
  titulo?: string;
}

export interface Obligacion {
  id: string;
  num?: number | string;
  descripcion: string;
  actividades: string;
  soportes: string;
  fotos?: Anexo[];
  isUpdated?: boolean;
  isTouched?: boolean;
  isClonedStructure?: boolean;
}

export interface Anexo {
  id: string;
  titulo: string;
  imagenUrl: string;
  file?: File;
  isPendingUpload?: boolean;
  obligacionId?: string;
  obligacionIndex?: number;
  isUpdated?: boolean;
}

export interface FieldComment {
  fieldId?: string;
  fieldName?: string;
  campoId?: string;
  nombreCampo?: string;
  comentario: string;
  autor?: string;
  fecha?: string;
  resuelto?: boolean;
  corregido?: boolean;
  fechaCorreccion?: string;
}

export interface ReportData {
  id?: string;
  contratoId?: string;
  secretariaId?: string;
  secretariaNombre?: string;
  secretariaCodigo?: string;
  secretariaNit?: string;
  estado?: EstadoInforme;
  syncedToDb?: boolean;
  watermarkImage?: string;
  nitAlcaldia?: string;
  isUpdated?: boolean;
  isTouched?: boolean;
  isClonedFromPrevious?: boolean;
  touchedFields?: Record<string, boolean>;
  updatedFields?: Record<string, boolean>;
  
  fechaAplicacion: string;
  tipoInforme: 'Mensual' | 'Final';
  informeNro: string;
  fechaPresentacion: string;
  periodoDesde: string;
  periodoHasta: string;
  contratistaNombre: string;
  contratistaDocumento: string;
  contratistaCorreo: string;
  contratistaTelefono: string;
  supervisorNombre: string;
  supervisorCargo?: string;
  supervisorDocumento: string;
  apoyoSupervisionNombre: string;
  apoyoSupervisionDocumento: string;
  valorContrato: string;
  valorMensual?: string;
  valorAdicion: string;
  contratoNro: string;
  objeto: string;
  cdpNro: string;
  crpNro: string;
  polizaNro: string;
  fechaPoliza: string;
  plazo: string;
  fechaInicio: string;
  fechaTerminacion: string;
  modificaciones: string;
  obligaciones: Obligacion[];
  observaciones: string;
  anexos: Anexo[];
  valorPagar: string;
  comentariosCampos?: Record<string, FieldComment>;
}

import { getDatosLiquidacionPeriodo, limpiarNumeroMoneda } from './utils/paymentPlanUtils';
import { formatDateSlash, quitarDecimales } from './utils/formatters';

export interface CertificadoSupervisionData {
  id?: string;
  reportId?: string;
  informeNro: string;
  contratistaNombre: string;
  tipoContrato: string;
  contratoNro: string;
  contratoAno: string;
  tipoDocumento: string;
  contratistaDocumento: string;
  supervisorNombre: string;
  supervisorCargo: string;
  objeto: string;
  
  clausulaNro: string;
  
  numeroCuenta: string;
  banco: string;
  tipoCuenta: string;
  fechaInicio: string;
  plazoMeses: string;
  plazoDias: string;
  fechaTerminacion: string;
  valorInicial: string;
  adicion1: string;
  adicion2: string;
  adicion3: string;
  valorTotal: string;
  prorroga1Dias: string;
  prorroga2Dias: string;
  prorroga3Dias: string;

  cdpNro: string;
  crpNro: string;
  fechaRegistroPresupuestal: string;
  codigoRubro: string;
  valorRubro: string;

  cdpNro2?: string;
  crpNro2?: string;
  fechaRegistroPresupuestal2?: string;
  codigoRubro2?: string;
  valorRubro2?: string;

  cdpNro3?: string;
  crpNro3?: string;
  fechaRegistroPresupuestal3?: string;
  codigoRubro3?: string;
  valorRubro3?: string;

  cdpNro4?: string;
  crpNro4?: string;
  fechaRegistroPresupuestal4?: string;
  codigoRubro4?: string;
  valorRubro4?: string;

  cdpNro5?: string;
  crpNro5?: string;
  fechaRegistroPresupuestal5?: string;
  codigoRubro5?: string;
  valorRubro5?: string;

  saludValor: string;
  saludEps: string;
  saludPlanilla: string;
  pensionValor: string;
  pensionFondo: string;
  pensionPlanilla: string;
  arpValor: string;
  arpAseguradora: string;
  arpPlanilla: string;

  pagoNro: string;
  periodoDesde: string;
  periodoHasta: string;
  porcentajeEjecucion: string;
  valorPagadoAcumulado: string;
  valorAPagarSinIva: string;
  iva: string;
  valorTotalAPagar: string;
  saldoPorPagar: string;
  observacionesLiquidacion?: string;

  valorAvalado: string;
  expedicionDia: string;
  expedicionMes: string;
  expedicionAno: string;
  supervisorFirma?: string;
}

export const createDefaultCertificadoData = (report?: ReportData): CertificadoSupervisionData => {
  const rep = report || initialMockData;
  const matchNum = rep.valorPagar ? rep.valorPagar.match(/\$?([\d.,]+)/) : null;
  const valorNumStr = matchNum ? matchNum[1] : '1.780.426,67';

  // Cálculo automático del plan financiero y liquidación de pago si hay datos contractuales
  let autoLiq: any = null;
  const numValTotal = limpiarNumeroMoneda(rep.valorContrato || '$ 20.029.800');
  const fInicio = rep.fechaInicio || '14/01/2026';
  const fFin = rep.fechaTerminacion || '14/07/2026';

  if (numValTotal > 0 && fInicio && fFin) {
    const valMensual = rep.valorMensual ? limpiarNumeroMoneda(rep.valorMensual) : undefined;
    autoLiq = getDatosLiquidacionPeriodo({
      valor_total_contrato: numValTotal,
      valor_mensual: valMensual,
      fecha_inicio: fInicio,
      fecha_fin: fFin,
    }, rep.informeNro || '1');
  }

  const pagoNroCalculado = autoLiq?.pagoNro || rep.informeNro || '1';
  const periodoDesdeCalculado = autoLiq?.periodoDesde || (rep.periodoDesde ? formatDateSlash(rep.periodoDesde) : '14/01/2026');
  const periodoHastaCalculado = autoLiq?.periodoHasta || (rep.periodoHasta ? formatDateSlash(rep.periodoHasta) : '31/01/2026');
  const porcentajeEjecucionCalculado = autoLiq?.porcentajeEjecucion || '8,89 %';
  const valorPagadoAcumuladoCalculado = quitarDecimales(autoLiq?.valorPagadoAcumulado || '0');
  const valorAPagarSinIvaCalculado = quitarDecimales(autoLiq?.valorAPagarSinIva || valorNumStr);
  const valorTotalAPagarCalculado = quitarDecimales(autoLiq?.valorTotalAPagar || valorNumStr);
  const saldoPorPagarCalculado = quitarDecimales(autoLiq?.saldoPorPagar || '18.249.373');

  let mesCalculado = 'julio';
  if (rep.fechaAplicacion) {
    const parts = rep.fechaAplicacion.trim().split(' ');
    if (parts.length > 0) {
      mesCalculado = parts[0].toLowerCase();
    }
  }

  let diaCalculado = '21';
  let anoCalculado = '2026';
  if (periodoHastaCalculado) {
    const pParts = periodoHastaCalculado.split('/');
    if (pParts.length >= 3) {
      diaCalculado = pParts[0];
      anoCalculado = pParts[2];
    }
  }

  return {
    reportId: rep.id,
    informeNro: rep.informeNro || '1',
    contratistaNombre: rep.contratistaNombre || 'HAMINTON MENA MENA',
    tipoContrato: 'PRESTACION DE SERVICIOS',
    contratoNro: rep.contratoNro || '025',
    contratoAno: '2026',
    tipoDocumento: 'C.C.',
    contratistaDocumento: rep.contratistaDocumento || '80.772.379',
    supervisorNombre: rep.supervisorNombre || 'Diana Andrea Mosquera Garcia',
    supervisorCargo: 'Secretaria de Inclusión y Cohesión Social',
    objeto: rep.objeto || 'PRESTAR LOS SERVICIOS PROFESIONALES EN EL AREA DE SISTEMAS PARA ADELANTAR, ACOMPAÑAR Y DESARROLLAR LAS ACCIONES QUE SE LLEVAN ACABO EN LA SECRETARIA DE INCLUSIÓN Y COHESIÓN SOCIAL DEL MUNICIPIO DE QUIBDÓ PARA LA POBLACIÓN MIGRANTE.',
    
    clausulaNro: '6',
    
    numeroCuenta: '53686186829',
    banco: 'Bancolombia',
    tipoCuenta: 'Ahorro',
    fechaInicio: rep.fechaInicio || '14-ene.-2026',
    plazoMeses: '6',
    plazoDias: '0',
    fechaTerminacion: rep.fechaTerminacion || '14-jul.-2026',
    valorInicial: rep.valorContrato || '$ 20.029.800',
    adicion1: '-',
    adicion2: '-',
    adicion3: '-',
    valorTotal: rep.valorContrato || '$ 20.029.800',
    prorroga1Dias: '',
    prorroga2Dias: '',
    prorroga3Dias: '',

    cdpNro: rep.cdpNro || '137',
    crpNro: rep.crpNro || '191',
    fechaRegistroPresupuestal: '14/01/2026',
    codigoRubro: '2.3.2.02.02.008.04.01.02',
    valorRubro: valorAPagarSinIvaCalculado,

    cdpNro2: '',
    crpNro2: '',
    fechaRegistroPresupuestal2: '',
    codigoRubro2: '',
    valorRubro2: '',

    cdpNro3: '',
    crpNro3: '',
    fechaRegistroPresupuestal3: '',
    codigoRubro3: '',
    valorRubro3: '',

    cdpNro4: '',
    crpNro4: '',
    fechaRegistroPresupuestal4: '',
    codigoRubro4: '',
    valorRubro4: '',

    cdpNro5: '',
    crpNro5: '',
    fechaRegistroPresupuestal5: '',
    codigoRubro5: '',
    valorRubro5: '',

    saludValor: '218.900',
    saludEps: 'COOSALUD',
    saludPlanilla: '87049978',
    pensionValor: '280.200',
    pensionFondo: 'COLFONDO',
    pensionPlanilla: '87049978',
    arpValor: '9.200',
    arpAseguradora: 'POSITIVA',
    arpPlanilla: '87049978',

    pagoNro: pagoNroCalculado,
    periodoDesde: periodoDesdeCalculado,
    periodoHasta: periodoHastaCalculado,
    porcentajeEjecucion: porcentajeEjecucionCalculado,
    valorPagadoAcumulado: valorPagadoAcumuladoCalculado,
    valorAPagarSinIva: valorAPagarSinIvaCalculado,
    iva: '-',
    valorTotalAPagar: valorTotalAPagarCalculado,
    saldoPorPagar: saldoPorPagarCalculado,
    observacionesLiquidacion: '',

    valorAvalado: `$ ${valorTotalAPagarCalculado}`,
    expedicionDia: diaCalculado,
    expedicionMes: mesCalculado,
    expedicionAno: anoCalculado,
    supervisorFirma: '',
  };
};

export interface InformeSummary {
  id: string;
  contrato_id: string;
  informe_nro: number | string;
  tipo_informe: 'Mensual' | 'Final';
  fecha_presentacion: string;
  periodo_desde: string;
  periodo_hasta: string;
  estado: EstadoInforme;
  contratista_nombre: string;
  contratista_documento: string;
  contrato_nro: string;
  secretaria_nombre: string;
  created_at: string;
  comentariosCampos?: Record<string, FieldComment>;
}

export const initialMockData: ReportData = {
  secretariaNombre: 'SECRETARÍA DE INCLUSIÓN Y COHESIÓN SOCIAL',
  secretariaCodigo: '170',
  secretariaNit: '891680011-0',
  fechaAplicacion: 'JULIO DE 2026',
  tipoInforme: 'Mensual',
  informeNro: '6',
  fechaPresentacion: '15/07/2026',
  periodoDesde: '01/07/2026',
  periodoHasta: '15/07/2026',
  contratistaNombre: 'CARLOS ANDRÉS PALACIOS CÓRDOBA',
  contratistaDocumento: '1077456123',
  contratistaCorreo: 'carlos.palacios@quibdo-ejemplo.gov.co',
  contratistaTelefono: '3104567890',
  supervisorNombre: 'DIANA ANDREA MOSQUERA GARCIA',
  supervisorDocumento: '35.602.521',
  apoyoSupervisionNombre: 'N/A',
  apoyoSupervisionDocumento: 'N/A',
  valorContrato: '$ 20.029.800',
  valorMensual: '$ 3.338.300',
  valorAdicion: '$ N/A',
  contratoNro: '015',
  objeto: 'PRESTAR LOS SERVICIOS PROFESIONALES EN EL AREA DE SISTEMAS PARA ADELANTAR, ACOMPAÑAR Y DESARROLLAR LAS ACCIONES QUE SE LLEVAN ACABO EN LA SECRETARIA DE INCLUSIÓN Y COHESIÓN SOCIAL DEL MUNICIPIO DE QUIBDÓ PARA LA POBLACIÓN BENEFICIARIA.',
  cdpNro: '137',
  crpNro: '191',
  polizaNro: 'N/A',
  fechaPoliza: 'N/A',
  plazo: 'SEIS(6) MESES',
  fechaInicio: '14/01/2026',
  fechaTerminacion: '14/07/2026',
  modificaciones: 'N/A',
  obligaciones: [
    {
      id: '1',
      descripcion: '1. Diseñar, implementar y actualizar una base de datos que permita registrar y gestionar información sobre la población beneficiaria de los programas de inclusión y cohesión social.',
      actividades: 'En el periodo anterior se realizó la actualización constante de la base de datos institucional mediante el software Red Inclusión, asegurando el registro y control oportuno del personal atendido. Este proceso permitió consolidar y organizar la información de manera confiable, fortaleciendo la centralización de los datos y la transparencia en la gestión operativa. A su vez, se garantizó la disponibilidad de insumos técnicos esenciales para el seguimiento, el análisis y el soporte en la toma de decisiones estratégicas orientadas al bienestar de la población beneficiaria.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '2',
      descripcion: '2. Entregar un cronograma de las actividades mensuales que se pretenden desarrollar.',
      actividades: 'Se presentó y envió al correo de contratista el cronograma mensual de actividades previstas para desarrollar en la Secretaría de Inclusión y Cohesión Social, el cual constituye una herramienta de planificación y seguimiento que permite organizar las acciones, distribuir responsabilidades y garantizar el cumplimiento oportuno de los objetivos establecidos durante el periodo de ejecución.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '3',
      descripcion: '3. Consolidar, recopilar y manejar todas las actas, listados y acciones que se realicen en la secretaría de inclusión y cohesión social, las cuales deben de estar actualizadas en una carpeta en la nube perteneciente a dicha dependencia.',
      actividades: 'El repositorio institucional en Google Drive fue fortalecido mediante la clasificación y carga ordenada de actas, listados de asistencia y reportes de gestión. Gracias a este proceso se consolidó la documentación técnica relacionada con el cumplimiento de las actividades del plan de acción, asegurando que los archivos permanecieran organizados, actualizados y disponibles en el entorno digital. Esta labor permitió mejorar la gestión documental, afianzar el control administrativo y promover la transparencia en el manejo de la información institucional.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '4',
      descripcion: '4. Entregar al finalizar el contrato una base de datos actualizada de la población migrante atendidas que se encuentran en el municipio.',
      actividades: 'Se finalizó con el registro constante de información en la base de datos destinada a la caracterización de la población migrante y de los beneficiarios del municipio, tomando como referencia los datos recopilados en el periodo correspondiente. Este trabajo permitió fortalecer la calidad y actualización del sistema de información de la Secretaría de Inclusión y Cohesión Social, garantizando una base organizada, confiable y depurada al cierre del ciclo contractual. Asimismo, se mejoró la gestión institucional, la trazabilidad de los procesos y el soporte técnico requerido para la formulación y seguimiento de acciones estratégicas orientadas al bienestar de la población atendida.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '5',
      descripcion: '5. Presentar de manera mensual un porcentaje de los avances y el personal atendido en la secretaría de inclusión y cohesión social.',
      actividades: 'Se finalizó con la elaboración y entrega oportuna de los reportes semanales de gestión, en los cuales se evidenció de manera detallada el progreso de las actividades y los principales hitos alcanzados. Estos documentos integraron las acciones ejecutadas junto con la relación de participantes, respaldada en registros de asistencia debidamente verificados. La preparación de los informes se realizó conforme a los lineamientos técnicos establecidos, lo que permitió una presentación clara y estructurada que fortaleció la transparencia y la comunicación de los resultados obtenidos durante la ejecución contractual. Al cierre del periodo, la Secretaría de Inclusión y Cohesión Social registra un total de 3.306 usuarios vinculados a los diferentes programas institucionales.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '6',
      descripcion: '6. Formar a los funcionarios de la Secretaría en el uso adecuado de las herramientas tecnológicas donde se les capacite de manera mensual en el uso y manejo de una estrategia tecnológica.',
      actividades: 'Se impartió capacitación a la funcionaria sobre el uso adecuado de las herramientas ofimáticas, con el propósito de fortalecer sus conocimientos y aumentar la eficiencia en el manejo de aplicaciones como procesadores de texto, hojas de cálculo y presentaciones. Gracias a esta formación se optimizó el desarrollo de las tareas laborales, se redujeron los errores en el tratamiento de la información y se facilitó la elaboración de documentos y reportes institucionales.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '7',
      descripcion: '7. Consolidar, recopilar y manejar todas las actas, listados y acciones que se realicen en la coordinación de juventudes, las cuales deben de estar actualizadas en una carpeta de la nube perteneciente a dicha dependencia.',
      actividades: 'Se continuó con la gestión y actualización del repositorio digital de la Secretaría de Inclusión y Cohesión Social en Google Drive, a través de la organización y carga permanente de actas, listados de asistencia y documentos generados por la Coordinación de Juventudes. Esta labor aseguró que la información permaneciera centralizada, ordenada y disponible en la nube, lo que facilitó el acceso oportuno a los soportes y fortaleció los procesos de seguimiento, control administrativo y transparencia en la gestión institucional.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '8',
      descripcion: '8. Proponer e implementar mejoras tecnológicas que optimicen la gestión y la prestación de servicios en la Secretaría.',
      actividades: 'Se finalizó con las mejoras de la plataforma, logrando su migración de un entorno exclusivamente web hacia una aplicación móvil disponible en distintos dispositivos y perfeccionando su interfaz para ofrecer una experiencia más amigable. Al mismo tiempo, se reforzaron las medidas de seguridad y protección de la información mediante la implementación de controles de acceso y la configuración de respaldos automáticos. También se aplicaron mecanismos de verificación técnica orientados a garantizar la integridad, disponibilidad y confidencialidad de los datos, lo que redujo riesgos operativos y aseguró la estabilidad de los activos digitales institucionales durante el periodo reportado. Estas acciones permitieron optimizar la administración del software, fortalecer la transparencia en el manejo de la información y consolidar la confiabilidad de los procesos institucionales.',
      soportes: 'Anexo fotográfico',
    },
    {
      id: '9',
      descripcion: '9. Las demás que asigne la administración, de acuerdo con el nivel, la naturaleza y el área de prestación del servicio, en el marco del objeto del contrato.',
      actividades: 'Se finalizó con la reunión de articulación y preparación orientada a la creación de la ruta de atención integral para la población refugiada y migrante venezolana residente en el municipio de Quibdó. Este espacio permitió coordinar esfuerzos interinstitucionales, definir lineamientos estratégicos y establecer mecanismos de cooperación que servirán de base para garantizar una atención organizada, efectiva y ajustada a las necesidades de esta población.\n\nSe brindó acompañamiento inmediato a la comunidad del barrio Pablo Sexto tras la emergencia presentada, mediante la articulación del equipo de la Secretaría de Inclusión y Cohesión Social. La labor incluyó la presencia de personal uniformado en el territorio, la entrega de ayudas básicas disponibles, y la realización de actividades de contención psicosocial, charlas y acompañamiento a las familias afectadas.',
      soportes: 'Anexo fotográfico',
    }
  ],
  observaciones: '',
  anexos: [],
  valorPagar: 'UN MILLON QUINIENTOS CINCUENTA Y SIETE MIL OCHOCIENTOS SETENTA Y TRES PESOS M/CTE ($1.557.873)',
  estado: 'Enviado'
};

export interface SoporteFiduciariaData {
  id?: string;
  reportId?: string;
  docSoporteNro: string;
  ciudad: string;
  fecha: string;
  nombresApellidos: string;
  cedula: string;
  direccion: string;
  telefono: string;
  sumaTotal: string;
  valorLetras: string;
  cantidad: string;
  descripcionBienServicio: string;
  subTotal: string;
  total: string;
  totalGeneral: string;
  nota?: string;
}

export const createDefaultFiduciariaData = (report?: ReportData): SoporteFiduciariaData => {
  const rep = report || initialMockData;
  const { valorNumeroFormateado, valorLetras } = extraerLetrasYNumeroDeValorPagar(rep.valorPagar);
  const fechaFiduciaria = formatFechaFiduciaria(rep);

  return {
    reportId: rep.id,
    docSoporteNro: '',
    ciudad: 'Quibdó',
    fecha: fechaFiduciaria,
    nombresApellidos: rep.contratistaNombre || 'Haminton Mena Mena',
    cedula: rep.contratistaDocumento || '80.772.379',
    direccion: 'Barrio buenos aires',
    telefono: rep.contratistaTelefono || '3124943527',
    sumaTotal: `${valorNumeroFormateado},00`,
    valorLetras: valorLetras,
    cantidad: '1',
    descripcionBienServicio: rep.objeto || 'Prestar los servicios de apoyo a la gestión para adelantar, acompañar y desarrollar las acciones que se llevan acabo en la secretaria de inclusión y cohesión social del municipio de Quibdó.',
    subTotal: valorNumeroFormateado,
    total: valorNumeroFormateado,
    totalGeneral: valorNumeroFormateado,
    nota: 'RUT adjunto',
  };
};

export interface DeclaracionRentaData {
  id?: string;
  reportId?: string;
  fecha: string;
  senores: string;
  nombresApellidos: string;
  cedula: string;
  expedicionCedula: string;
  aplicaRetencion: boolean;
  firmaNombre: string;
  firmaCedula: string;
  firmaExpedicion: string;
}

export const createDefaultDeclaracionRentaData = (report?: ReportData): DeclaracionRentaData => {
  const rawDate = report?.periodoHasta || report?.fechaPresentacion || '2026-07-14';
  const fechaFormatted = formatFechaAnioMesDia(rawDate);

  return {
    reportId: report?.id,
    fecha: `Quibdó, ${fechaFormatted}`,
    senores: 'ALCALDIA\nCiudad.',
    nombresApellidos: report?.contratistaNombre || 'HAMINTON MENA MENA',
    cedula: report?.contratistaDocumento || '80.772.379',
    expedicionCedula: 'Bogotá D.C',
    aplicaRetencion: false,
    firmaNombre: report?.contratistaNombre || 'HAMINTON MENA MENA',
    firmaCedula: report?.contratistaDocumento || '80.772.379',
    firmaExpedicion: 'Quibdó',
  };
};

export interface AutorizacionDesembolsoData {
  id?: string;
  reportId?: string;
  fechaExpedicion: string;
  consecutivoNro: string;
  nombre: string;
  nitCc: string;
  nroCuenta: string;
  tipoCuenta: string;
  banco: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  concepto?: string;
  contratoNro?: string;
  conceptoNro: string;
  objeto: string;
  valorNumeros: string;
  subtotal: string;
  ivaAsumido: string;
  total: string;
  valorLetras: string;
  endoso1Beneficiario: string;
  endoso1NitCc: string;
  endoso1Cuenta: string;
  endoso1Banco: string;
  endoso1Tipo: string;
  endoso1Concepto: string;
  endoso1Valor: string;
  endoso2Beneficiario: string;
  endoso2NitCc: string;
  endoso2Cuenta: string;
  endoso2Banco: string;
  endoso2Tipo: string;
  endoso2Concepto: string;
  endoso2Valor: string;
}

export const createDefaultAutorizacionDesembolsoData = (report?: ReportData): AutorizacionDesembolsoData => {
  const rep = report || initialMockData;
  const { valorNumeroFormateado, valorLetras } = extraerLetrasYNumeroDeValorPagar(rep.valorPagar);
  const objetoConPeriodo = formatearObjetoConPeriodo(
    rep?.objeto,
    rep?.fechaAplicacion,
    rep?.fechaInicio,
    rep?.fechaTerminacion,
    rep?.fechaPresentacion,
    rep?.periodoDesde,
    rep?.periodoHasta
  );

  const rawExp = rep?.periodoHasta || rep?.fechaPresentacion || '2026-07-14';
  const fechaExpedicion = formatFechaAnioMesDia(rawExp);

  return {
    reportId: rep?.id,
    fechaExpedicion: fechaExpedicion,
    consecutivoNro: rep?.informeNro || '1',
    nombre: rep?.contratistaNombre || 'HAMINTON MENA MENA',
    nitCc: rep?.contratistaDocumento || '80.772.379',
    nroCuenta: '53686186829',
    tipoCuenta: 'AHORRO',
    banco: 'BANCOLOMBIA',
    ciudad: 'CHOCÓ',
    direccion: 'BARRIO BUENOS AIRES',
    telefono: rep?.contratistaTelefono || '3124943527',
    concepto: 'PRESTACION DE SERVICIOS',
    contratoNro: rep?.contratoNro || '283',
    conceptoNro: rep?.contratoNro || '283',
    objeto: objetoConPeriodo,
    valorNumeros: valorNumeroFormateado,
    subtotal: valorNumeroFormateado,
    ivaAsumido: '',
    total: valorNumeroFormateado,
    valorLetras: valorLetras,
    endoso1Beneficiario: '',
    endoso1NitCc: '',
    endoso1Cuenta: '',
    endoso1Banco: '',
    endoso1Tipo: '',
    endoso1Concepto: '',
    endoso1Valor: '$ 0',
    endoso2Beneficiario: '',
    endoso2NitCc: '',
    endoso2Cuenta: '',
    endoso2Banco: '',
    endoso2Tipo: '',
    endoso2Concepto: '',
    endoso2Valor: '$ 0',
  };
};
