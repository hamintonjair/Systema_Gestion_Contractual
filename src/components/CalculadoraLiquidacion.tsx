import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Sparkles, 
  Copy, 
  Check, 
  FileText, 
  Calendar, 
  DollarSign, 
  Percent, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Layers,
  ArrowRight,
  Maximize2,
  X
} from 'lucide-react';
import { 
  calcularLiquidacionEstatal, 
  formatearMonedaCol, 
  formatearPorcentajeCol, 
  formatearNumeroTablaCol, 
  limpiarNumeroMoneda,
  parsearFecha,
  LiquidacionDetalladaResult 
} from '../utils/paymentPlanUtils';
import { convertirNumeroALetras } from '../utils/numberToWords';

export interface CalculadoraLiquidacionProps {
  valorTotalContrato?: string | number;
  valorMensual?: string | number;
  fechaInicioPago?: string;
  fechaFinPago?: string;
  pagosAcumuladosAnteriores?: string | number;
  informeNro?: string | number;
  fechaFinContrato?: string;
  esUltimoPago?: boolean;
  onAplicar?: (resultado: LiquidacionDetalladaResult, textoCertificado: string) => void;
  className?: string;
  titulo?: string;
  textoBoton?: string;
  modoCompacto?: boolean;
  permitirEdicionDirecta?: boolean;
}

export default function CalculadoraLiquidacion({
  valorTotalContrato = '$ 16.200.000',
  valorMensual = '$ 3.600.000',
  fechaInicioPago = '13/08/2026',
  fechaFinPago = '31/08/2026',
  pagosAcumuladosAnteriores = '$ 0',
  informeNro = '1',
  fechaFinContrato,
  esUltimoPago,
  onAplicar,
  className = '',
  titulo = 'Liquidación del Período (Norma 30 Días)',
  textoBoton,
  modoCompacto = false,
  permitirEdicionDirecta = false,
}: CalculadoraLiquidacionProps) {
  // Estados para simulación / edición directa
  const [vTotalManual, setVTotalManual] = useState<string>('');
  const [vMensualManual, setVMensualManual] = useState<string>('');
  const [fInicioManual, setFInicioManual] = useState<string>('');
  const [fFinManual, setFFinManual] = useState<string>('');
  const [pagosPreviosManual, setPagosPreviosManual] = useState<string>('');
  const [mostrarDetalleProcedimiento, setMostrarDetalleProcedimiento] = useState<boolean>(false);
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [copiado, setCopiado] = useState<boolean>(false);
  const [aplicado, setAplicado] = useState<boolean>(false);

  // Valores efectivos a utilizar en el cálculo
  const effectiveVTotal = vTotalManual || valorTotalContrato;
  const effectiveVMensual = vMensualManual || valorMensual;
  const effectiveFInicio = fInicioManual || fechaInicioPago;
  const effectiveFFin = fFinManual || fechaFinPago;
  const effectivePagosPrevios = pagosPreviosManual || pagosAcumuladosAnteriores;

  // Ejecutar el cálculo dinámico obligatorio
  const liquidacion = useMemo<LiquidacionDetalladaResult>(() => {
    return calcularLiquidacionEstatal({
      valorTotalContrato: effectiveVTotal,
      valorMensual: effectiveVMensual || undefined,
      fechaInicioPago: String(effectiveFInicio),
      fechaFinPago: String(effectiveFFin),
      pagosAcumuladosAnteriores: effectivePagosPrevios,
      fechaFinContrato,
      esUltimoPago,
    });
  }, [effectiveVTotal, effectiveVMensual, effectiveFInicio, effectiveFFin, effectivePagosPrevios, fechaFinContrato, esUltimoPago]);

  // Texto en letras y números para certificación
  const textoCertificacion = useMemo(() => {
    if (!liquidacion) return '';
    const letras = convertirNumeroALetras(liquidacion.valorAPagarSinIva);
    return `${letras.toUpperCase()} ($${liquidacion.valorAPagarTabla})`;
  }, [liquidacion]);

  // Texto completo con formato de salida para copiar o exportar
  const textoMemoriaCalculo = useMemo(() => {
    if (!liquidacion) return '';
    return `PROCEDIMIENTO DE CÁLCULO:
- Valor Diario: $ ${formatearNumeroTablaCol(liquidacion.valorDiario)}
- Días Liquidados: ${liquidacion.diasLiquidados} días
- Valor a Pagar en el Período: $ ${formatearNumeroTablaCol(liquidacion.valorAPagarSinIva)}${liquidacion.pagosAcumuladosAnteriores > 0 ? `\n- Pagos Anteriores Acumulados: $ ${formatearNumeroTablaCol(liquidacion.pagosAcumuladosAnteriores)}\n- Total Acumulado Pagado: $ ${formatearNumeroTablaCol(liquidacion.totalAcumuladoPagado)}` : ''}
- Porcentaje del Período: ${liquidacion.porcentajePeriodo.toFixed(2).replace('.', ',')} %
- Porcentaje de Ejecución (Acumulado): ${liquidacion.porcentajeAcumulado.toFixed(2).replace('.', ',')} %
- Saldo por Pagar: $ ${formatearNumeroTablaCol(liquidacion.saldoPorPagar)}

VALORES FINAL PARA CERTIFICADO DE SUPERVISIÓN:
- Días Liquidados: ${liquidacion.diasLiquidados}
- Valor Pagado Acumulado Anterior: $ ${formatearNumeroTablaCol(liquidacion.pagosAcumuladosAnteriores)}
- Valor a Pagar Sin IVA: $ ${formatearNumeroTablaCol(liquidacion.valorAPagarSinIva)}
- Porcentaje de Ejecución: ${liquidacion.porcentajeAcumulado.toFixed(2).replace('.', ',')}%
- Valor Total a Pagar: $ ${formatearNumeroTablaCol(liquidacion.valorTotalAPagar)}
- Saldo por Pagar: $ ${formatearNumeroTablaCol(liquidacion.saldoPorPagar)}`;
  }, [liquidacion]);

  const handleCopiar = () => {
    if (!textoMemoriaCalculo) return;
    navigator.clipboard.writeText(textoMemoriaCalculo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleAplicar = () => {
    if (onAplicar && liquidacion) {
      onAplicar(liquidacion, textoCertificacion);
      setAplicado(true);
      setTimeout(() => setAplicado(false), 2500);
    }
  };

  // Desglose del cálculo de días para transparencia matemática
  const infoDiasCalculo = useMemo(() => {
    try {
      const inicio = parsearFecha(String(effectiveFInicio));
      const fin = parsearFecha(String(effectiveFFin));
      if (inicio.year === fin.year && inicio.month === fin.month) {
        if (inicio.day === 1 && fin.day >= 28) {
          return {
            tipo: 'Mes Completo',
            explicacion: 'Día 1 al final del mes = 30 días comerciales exactos.',
            formula: '30 días comerciales',
          };
        } else if (fin.day >= 28) {
          return {
            tipo: 'Fracción Inicial a Fin de Mes',
            explicacion: `(30 - ${inicio.day}) + 1 = ${(30 - inicio.day) + 1} días`,
            formula: `(30 - ${inicio.day}) + 1 = ${(30 - inicio.day) + 1} días`,
          };
        } else {
          const d = Math.max(1, (Math.min(fin.day, 30) - inicio.day) + 1);
          return {
            tipo: 'Fracción Intermedia',
            explicacion: `(${fin.day} - ${inicio.day}) + 1 = ${d} días`,
            formula: `(${fin.day} - ${inicio.day}) + 1 = ${d} días`,
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      tipo: 'Cálculo Comercial 30 Días',
      explicacion: `${liquidacion.diasLiquidados} días comerciales liquidados.`,
      formula: `${liquidacion.diasLiquidados} días`,
    };
  }, [effectiveFInicio, effectiveFFin, liquidacion.diasLiquidados]);

  return (
    <div className={`bg-white border border-slate-300 rounded-xl p-3.5 shadow-xs space-y-3 ${className}`}>
      {/* Encabezado adaptable */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-emerald-700 text-white rounded-lg shadow-xs shrink-0">
            <Calculator size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-slate-900 tracking-tight truncate">
              {titulo}
            </h3>
            <span className="text-[10px] text-emerald-800 font-medium block truncate">
              Norma comercial colombiana (meses de 30 días)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded text-xs transition-colors cursor-pointer"
            title="Abrir memoria completa en ventana ampliada"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Tarjeta Principal de Valor a Pagar (Hero) */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-300 rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
              Valor a Pagar en el Período
            </span>
            <div className="text-xl font-black text-emerald-900 font-mono tracking-tight mt-0.5">
              {formatearMonedaCol(liquidacion.valorAPagarSinIva)}
            </div>
          </div>
          <span className="px-2 py-0.5 bg-emerald-700 text-white font-bold text-[10px] rounded-full shadow-2xs shrink-0">
            {liquidacion.diasLiquidados} días
          </span>
        </div>

        <div className="text-[11px] text-emerald-950 font-medium flex items-center justify-between border-t border-emerald-200/80 pt-1.5 gap-1">
          <span className="text-emerald-800 text-[10px]">
            Período: <strong className="font-mono">{liquidacion.fechaInicioPeriodo}</strong> al <strong className="font-mono">{liquidacion.fechaFinPeriodo}</strong>
          </span>
          <span className="text-emerald-900 font-mono font-bold text-[10px]">
            {liquidacion.porcentajeEjecucion.toFixed(2).replace('.', ',')}% ejecución
          </span>
        </div>
      </div>

      {/* Cuadrícula 2x2 Limpia y Espaciosa (Nunca se aprieta) */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* 1. Valor Diario */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block truncate">
            1. Valor Diario
          </span>
          <span className="text-xs font-extrabold text-slate-900 font-mono block mt-0.5">
            {formatearMonedaCol(liquidacion.valorDiario)}
          </span>
          <span className="text-[9px] text-slate-500 block truncate mt-0.5 font-mono">
            {formatearMonedaCol(liquidacion.valorMensual)} / 30
          </span>
        </div>

        {/* 2. Días Liquidados */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block truncate">
            2. Días Liquidados
          </span>
          <span className="text-xs font-extrabold text-emerald-800 font-mono block mt-0.5">
            {liquidacion.diasLiquidados} días
          </span>
          <span className="text-[9px] text-emerald-700 block truncate mt-0.5 font-medium" title={infoDiasCalculo.formula}>
            {infoDiasCalculo.formula}
          </span>
        </div>

        {/* 3. Porcentaje de Ejecución */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block truncate">
            3. % Ejecución Acum.
          </span>
          <span className="text-xs font-extrabold text-slate-900 font-mono block mt-0.5">
            {liquidacion.porcentajeAcumulado.toFixed(2).replace('.', ',')} %
          </span>
          <span className="text-[9px] text-slate-500 block truncate mt-0.5" title={`Período: ${liquidacion.porcentajePeriodo.toFixed(2).replace('.', ',')} %`}>
            Período: {liquidacion.porcentajePeriodo.toFixed(2).replace('.', ',')} %
          </span>
        </div>

        {/* 4. Saldo por Pagar */}
        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block truncate">
            4. Saldo por Pagar
          </span>
          <span className="text-xs font-extrabold text-slate-900 font-mono block mt-0.5 truncate">
            {formatearMonedaCol(liquidacion.saldoPorPagar)}
          </span>
          <span className="text-[9px] text-slate-500 block truncate mt-0.5" title={`Pagado acum.: ${formatearMonedaCol(liquidacion.totalAcumuladoPagado)}`}>
            Acum: {formatearMonedaCol(liquidacion.totalAcumuladoPagado)}
          </span>
        </div>
      </div>

      {/* Botones de Acción directos */}
      <div className="space-y-1.5 pt-1">
        {onAplicar && (
          <button
            type="button"
            onClick={handleAplicar}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer ${
              aplicado
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                : 'bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white'
            }`}
            title="Insertar automáticamente en el campo de certificación del informe"
          >
            {aplicado ? (
              <>
                <Check size={13} className="text-amber-300" />
                <span>¡Aplicado al Valor a Pagar de los Documentos!</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>{textoBoton || `Aplicar al Certificado (${liquidacion.valorAPagarTabla})`}</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopiar}
            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
          >
            {copiado ? (
              <>
                <Check size={12} className="text-emerald-600" />
                <span className="text-emerald-700 font-bold">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copiar Memoria</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMostrarDetalleProcedimiento(!mostrarDetalleProcedimiento)}
            className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-200"
          >
            <FileText size={12} />
            <span>{mostrarDetalleProcedimiento ? 'Ocultar' : 'Ver Detalle'}</span>
            {mostrarDetalleProcedimiento ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Desglose Colapsable estructurado en 1 sola columna vertical (sin apiñamientos) */}
      {mostrarDetalleProcedimiento && (
        <div className="pt-2 border-t border-slate-200 space-y-2.5 text-xs">
          {/* Bloque 1: Procedimiento */}
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
            <span className="font-bold text-[10px] text-slate-700 uppercase tracking-wider block">
              Procedimiento de Cálculo:
            </span>
            <div className="font-mono text-[11px] space-y-1 text-slate-800">
              <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                <span className="text-slate-600 font-sans text-[10px]">Valor Diario:</span>
                <strong>$ {formatearNumeroTablaCol(liquidacion.valorDiario)}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                <span className="text-slate-600 font-sans text-[10px]">Días Liquidados:</span>
                <strong>{liquidacion.diasLiquidados} días</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                <span className="text-slate-600 font-sans text-[10px]">Valor a Pagar (Período):</span>
                <strong className="text-emerald-800">$ {formatearNumeroTablaCol(liquidacion.valorAPagarSinIva)}</strong>
              </div>
              {liquidacion.pagosAcumuladosAnteriores > 0 && (
                <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                  <span className="text-slate-600 font-sans text-[10px]">Pagos Anteriores Acum.:</span>
                  <strong>$ {formatearNumeroTablaCol(liquidacion.pagosAcumuladosAnteriores)}</strong>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                <span className="text-slate-600 font-sans text-[10px]">% Ejecución Período:</span>
                <strong>{liquidacion.porcentajePeriodo.toFixed(2).replace('.', ',')} %</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-0.5">
                <span className="text-slate-600 font-sans text-[10px]">% Ejecución Acumulado:</span>
                <strong className="text-emerald-900 font-bold">{liquidacion.porcentajeAcumulado.toFixed(2).replace('.', ',')} %</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 font-sans text-[10px]">Saldo por Pagar:</span>
                <strong>$ {formatearNumeroTablaCol(liquidacion.saldoPorPagar)}</strong>
              </div>
            </div>
          </div>

          {/* Bloque 2: Transcripción en letras */}
          <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 space-y-1">
            <span className="font-bold text-[10px] text-emerald-950 uppercase tracking-wider block">
              Texto Formal para el Certificado:
            </span>
            <p className="font-mono text-[10px] text-emerald-950 select-all font-semibold leading-relaxed">
              {textoCertificacion}
            </p>
          </div>
        </div>
      )}

      {/* Modal Ampliado para Pantalla Completa */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-700 text-white rounded-xl">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Memoria de Liquidación Contractual
                  </h3>
                  <p className="text-xs text-slate-500">
                    Norma comercial de meses de 30 días (Contratación Estatal Colombia)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuadrícula amplia */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">1. Valor Diario</span>
                <span className="text-base font-extrabold text-slate-900 font-mono block mt-1">
                  {formatearMonedaCol(liquidacion.valorDiario)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {formatearMonedaCol(liquidacion.valorMensual)} / 30
                </span>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300">
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">2. Días Liquidados</span>
                <span className="text-base font-extrabold text-emerald-900 font-mono block mt-1">
                  {liquidacion.diasLiquidados} días
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  {infoDiasCalculo.formula}
                </span>
              </div>

              <div className="bg-emerald-100/60 p-3 rounded-xl border border-emerald-400">
                <span className="text-[10px] text-emerald-900 font-bold uppercase block">3. Valor a Pagar</span>
                <span className="text-base font-extrabold text-emerald-950 font-mono block mt-1">
                  {formatearMonedaCol(liquidacion.valorAPagarSinIva)}
                </span>
                <span className="text-[10px] text-emerald-800 block mt-0.5">
                  {liquidacion.diasLiquidados}d × {formatearMonedaCol(liquidacion.valorDiario)}
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">4. % Ejecución</span>
                <span className="text-base font-extrabold text-slate-900 font-mono block mt-1">
                  {liquidacion.porcentajeAcumulado.toFixed(2).replace('.', ',')} %
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Período: {liquidacion.porcentajePeriodo.toFixed(2).replace('.', ',')}% | Acumulado
                </span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 col-span-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">5. Saldo por Pagar</span>
                <span className="text-base font-extrabold text-slate-900 font-mono block mt-1">
                  {formatearMonedaCol(liquidacion.saldoPorPagar)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Contrato ({formatearMonedaCol(liquidacion.valorTotalContrato)}) - Total Acumulado ({formatearMonedaCol(liquidacion.totalAcumuladoPagado)})
                </span>
              </div>
            </div>

            {/* Texto de memoria copiable */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs space-y-1 select-all overflow-x-auto">
              <pre className="whitespace-pre-wrap">{textoMemoriaCalculo}</pre>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCopiar}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copiado ? '¡Copiado!' : 'Copiar Memoria'}</span>
              </button>
              {onAplicar && (
                <button
                  type="button"
                  onClick={() => {
                    handleAplicar();
                    setModalAbierto(false);
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles size={14} />
                  <span>Aplicar al Certificado</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
