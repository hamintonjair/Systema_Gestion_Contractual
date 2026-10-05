import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Calendar, 
  FileText, 
  Briefcase, 
  DollarSign, 
  Image as ImageIcon, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles,
  Info,
  Clock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  documentType?: 'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso';
}

export default function AIManualModal({ isOpen, onClose, documentType = 'informe' }: Props) {
  const [activeTab, setActiveTab] = useState<'informe' | 'supervision' | 'fiduciaria' | 'juramento' | 'desembolso'>(documentType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Encabezado */}
        <div className="bg-gradient-to-r from-[#005226] via-[#006b33] to-[#0b8043] px-5 py-4 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-inner">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] uppercase font-black tracking-widest text-emerald-200">
                  Alcaldía Municipal de Quibdó
                </span>
                <span className="text-[10px] px-2 py-0.2 bg-white/20 rounded-full font-bold">
                  Guía Oficial de Supervisión
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Manual de Auditoría e Inteligencia Artificial (Gemini)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
            title="Cerrar manual"
          >
            <X size={20} />
          </button>
        </div>

        {/* Pestañas de Documentos en el Manual */}
        <div className="bg-slate-100 px-5 py-2.5 border-b border-slate-200 flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('informe')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'informe'
                ? 'bg-[#006b33] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <FileText size={14} />
            <span>1. Informe Mensual</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('supervision')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'supervision'
                ? 'bg-[#006b33] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck size={14} />
            <span>2. Certificado de Supervisión</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fiduciaria')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'fiduciaria'
                ? 'bg-[#006b33] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Briefcase size={14} />
            <span>3. Soporte Fiduciaria</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('juramento')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'juramento'
                ? 'bg-[#006b33] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck size={14} />
            <span>4. Declaración Juramentada</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('desembolso')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'desembolso'
                ? 'bg-[#006b33] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <DollarSign size={14} />
            <span>5. Autorización de Desembolso</span>
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-slate-800 text-xs sm:text-sm">
          
          {/* TAB 1: INFORME MENSUAL */}
          {activeTab === 'informe' && (
            <>
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <Sparkles size={17} className="text-[#006b33]" />
                  <span>Auditoría del Informe Mensual de Actividades</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Evalúa la trazabilidad, redacción técnica y cumplimiento cronológico del informe presentado por el contratista.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck size={17} className="text-blue-700" />
                  <span>Criterios y Especificaciones Auditadas en el Informe</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <Calendar size={15} className="text-blue-600" />
                      <span>1. Fechas, Vigencia y Períodos</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px] leading-relaxed">
                      <li><strong>Periodo vs. Vigencia:</strong> <code>DESDE</code> no puede ser anterior a la fecha de inicio ni <code>HASTA</code> posterior a la terminación.</li>
                      <li><strong>Fecha de Presentación:</strong> Coherente con el corte de mes y no previa al inicio.</li>
                      <li><strong>Mensual vs. Final:</strong> Si finaliza el contrato o plazo, advierte marcarlo como <strong>Final</strong>.</li>
                      <li><strong>Número Consecutivo:</strong> Valida la secuencia cronológica de informes.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <FileText size={15} className="text-purple-600" />
                      <span>2. Integridad de Datos Contractuales</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px] leading-relaxed">
                      <li>Verificación de Contrato Nº, Objeto, CDP, CRP, Plazo, Valor y Fechas de Inicio y Terminación.</li>
                      <li>Alerta sobre casillas en blanco, textos genéricos o valores ficticios.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <Briefcase size={15} className="text-amber-600" />
                      <span>3. Calidad de Actividades</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px] leading-relaxed">
                      <li><strong>Filtro Anti-Frases Genéricas:</strong> Penaliza frases vagas (<em>"se apoyó"</em>, <em>"se cumplió"</em>).</li>
                      <li>Exige lenguaje formal, trazable, técnico y con evidencias frente a cada obligación.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <DollarSign size={15} className="text-emerald-600" />
                      <span>4. Consistencia Financiera</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px] leading-relaxed">
                      <li>Proporcionalidad del valor a pagar mensual respecto al valor total del contrato y plazo.</li>
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5 md:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <ImageIcon size={15} className="text-indigo-600" />
                      <span>5. Anexos Fotográficos por Cada Obligación</span>
                    </div>
                    <p className="text-slate-600 text-[11.5px] leading-relaxed">
                      La IA revisa que <strong>cada una de las obligaciones contractuales</strong> cuente con sus respectivos soportes o anexos fotográficos presentes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
                <Info size={17} className="text-blue-700 shrink-0 mt-0.5" />
                <p className="text-blue-900 text-[11.5px] leading-relaxed">
                  <strong>Aclaración:</strong> La <strong>firma del contratista no es evaluada por la IA</strong>; su revisión formal corresponde de manera directa al supervisor.
                </p>
              </div>
            </>
          )}

          {/* TAB 2: CERTIFICADO DE SUPERVISIÓN */}
          {activeTab === 'supervision' && (
            <>
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <ShieldCheck size={17} className="text-[#006b33]" />
                  <span>Auditoría del Certificado de Supervisión y Cumplimiento</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Garantiza el estricto control financiero, la verificación de aportes parafiscales y la validez legal del trámite de desembolso ante la Secretaría de Hacienda y Tesorería.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck size={17} className="text-blue-700" />
                  <span>Reglas Específicas Auditadas en el Certificado</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Control Financiero */}
                  <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-red-950 text-xs">
                      <DollarSign size={15} className="text-red-600" />
                      <span>1. Control Financiero y Límites de Pago</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Regla Estricta:</strong> Que la suma de <strong>[Pagos Acumulados + Pago Actual]</strong> <u>nunca supere</u> el valor total del contrato (saldo no negativo).</li>
                      <li><strong>Saldo por Pagar (Criterio si todo está bien):</strong>
                        <ul className="list-circle pl-3 space-y-0.5 mt-0.5 text-[11px] text-slate-600">
                          <li><em>En pagos intermedios / mensuales:</em> Debe ser mayor a $0 y coincidir con exactitud matemática con la resta <code>Valor Total - (Pagos Acumulados + Pago Actual)</code>.</li>
                          <li><em>En el último pago (Informe Final / cierre):</em> Debe ser exactamente <strong>$0</strong> y el porcentaje de ejecución <strong>100%</strong>.</li>
                        </ul>
                      </li>
                      <li>Coincidencia del valor liquidado con el valor avalado por el supervisor y el rubro presupuestal.</li>
                    </ul>
                  </div>

                  {/* Seguridad Social */}
                  <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-teal-950 text-xs">
                      <ShieldCheck size={15} className="text-teal-700" />
                      <span>2. Verificación de Seguridad Social</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Campos Llenos:</strong> Se revisa que los campos estén completos (no vacíos ni omitidos) en los 3 subsistemas (<strong>Salud, Pensión y ARL</strong>):
                        <ul className="list-circle pl-3 space-y-0.5 mt-0.5 text-[11px] text-slate-600">
                          <li>Valor cotizado en cada subsistema.</li>
                          <li>Nombre de la entidad (EPS, Fondo de Pensiones, ARL).</li>
                          <li>Número de planilla debidamente registrado.</li>
                        </ul>
                      </li>
                      <li><strong>Planilla Única Integrada:</strong> El número de planilla <u>debe ser exactamente el mismo para los 3 subsistemas</u> (Salud, Pensión y ARL). Si no coincide, se reporta la discrepancia.</li>
                      <li><em>No se calculan porcentajes del 40% ni fórmulas matemáticas</em>; con los campos llenos y la planilla unificada, se califica como correcto.</li>
                    </ul>
                  </div>

                  {/* Fechas, Prórrogas y Plazos */}
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-blue-950 text-xs">
                      <Calendar size={15} className="text-blue-700" />
                      <span>3. Fechas, Plazos y Prórrogas</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li>Concordancia de <strong>Fecha de Inicio</strong> y <strong>Fecha de Terminación</strong> según el plazo en meses y días.</li>
                      <li>Verificación de prórrogas o adiciones que afecten el plazo y el valor.</li>
                      <li>El período de pago <code>DESDE - HASTA</code> debe pertenecer a la vigencia contractual.</li>
                    </ul>
                  </div>

                  {/* Certificación a Satisfacción */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
                      <CheckCircle2 size={15} className="text-emerald-700" />
                      <span>4. Certificación a Satisfacción</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li>Certificación explícita de recibo a satisfacción del servicio conforme al informe mensual.</li>
                      <li>Aval formal del monto exacto a pagar y fecha de expedición oportuna.</li>
                    </ul>
                  </div>

                  {/* Datos Contractuales */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5 md:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                      <FileText size={15} className="text-purple-600" />
                      <span>5. Información Contractual y Presupuestal</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Campos Presupuestales Obligatorios:</strong> La <strong>Fecha de Registro Presupuestal</strong> y el <strong>Código del Rubro Presupuestal</strong> <u>no deben estar vacíos</u> ni en blanco.</li>
                      <li>Comprueba la coincidencia exacta de Contrato Nº, Objeto, Cédula del Contratista, Nombre y Cargo del Supervisor, CDP, CRP y datos bancarios (cuenta, banco y tipo).</li>
                    </ul>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* TAB 3: SOPORTE FIDUCIARIA / PAGOS */}
          {activeTab === 'fiduciaria' && (
            <>
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <Briefcase size={17} className="text-[#006b33]" />
                  <span>Auditoría del Documento Soporte Fiduciaria (La Previsora S.A. / Pagos)</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Verifica los requisitos del Documento Soporte en Adquisiciones Efectuadas a No Obligados a Facturar para autorizar el desembolso y giro fiduciario.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck size={17} className="text-blue-700" />
                  <span>Reglas Específicas Auditadas en el Soporte Fiduciaria</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Beneficiario y Cuentas */}
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs">
                      <Briefcase size={15} className="text-indigo-600" />
                      <span>1. Beneficiario y Datos Registrados</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Correspondencia exacta del beneficiario:</strong> Nombres y apellidos completos idénticos al contrato.</li>
                      <li><strong>Nº Cédula de Ciudadanía:</strong> Coincidencia exacta con el documento de identidad del contratista.</li>
                      <li><strong>Cuenta Bancaria:</strong> Verificación de número, entidad bancaria y tipo de cuenta (Ahorros / Corriente) registrada para dispersión.</li>
                      <li><strong>Datos de Ubicación:</strong> Ciudad y fecha, dirección y teléfono de contacto diligenciados.</li>
                    </ul>
                  </div>

                  {/* Consistencia Financiera */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
                      <DollarSign size={15} className="text-emerald-600" />
                      <span>2. Consistencia Financiera y Objeto</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li>Consistencia entre el <strong>valor bruto</strong> (Sub Total, Total, Total General), deducciones/retenciones y el <strong>valor neto a desembolsar</strong>.</li>
                      <li><strong>Cruce Estricto:</strong> El valor en números (ej. $3.800.000,00) debe coincidir con exactitud con el <strong>valor en letras</strong> (ej. TRES MILLONES OCHOCIENTOS MIL PESOS M/CTE).</li>
                      <li><strong>Descripción del Bien o Servicio:</strong> Coincidencia con el objeto contractual establecido.</li>
                    </ul>
                  </div>

                  {/* Reglas de Exclusión */}
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1 md:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                      <Info size={14} className="text-amber-700" />
                      <span>Campos Excluidos de la Auditoría Fiduciaria:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-slate-700 text-[11px] leading-relaxed">
                      <li><strong>N° Doc Soporte:</strong> <u>No se valida ni se penaliza</u> (puede permanecer en blanco).</li>
                      <li><strong>Información Presupuestal:</strong> En este formato físico <u>no aplican</u> códigos de CDP, CRP ni Código de Rubro Presupuestal.</li>
                    </ul>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* TAB 4: DECLARACIÓN BAJO JURAMENTO */}
          {activeTab === 'juramento' && (
            <>
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <ShieldCheck size={17} className="text-[#006b33]" />
                  <span>Auditoría de la Declaración Bajo Juramento (Ley 1819 / Art. 383 E.T.)</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Verifica exclusivamente los requisitos legales y formales de la certificación para efectos de retención en la fuente sobre rentas de trabajo y servicios personales.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <ShieldCheck size={17} className="text-blue-700" />
                  <span>Criterios Específicos Auditados en la Declaración</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Fecha y Destinatario */}
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-blue-950 text-xs">
                      <Calendar size={15} className="text-blue-700" />
                      <span>1. Fecha y Destinatario</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Fecha del Documento:</strong> Debe estar presente (ej. <em>Quibdó, 30 de septiembre de 2026</em>) y ser concordante con el período reportado.</li>
                      <li><strong>A quién va dirigido:</strong> Debe indicar claramente la entidad destinataria (ej. <em>Señores ALCALDÍA / Ciudad.</em>).</li>
                    </ul>
                  </div>

                  {/* Datos del Contratista */}
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs">
                      <Briefcase size={15} className="text-indigo-600" />
                      <span>2. Identificación del Contratista</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Nombre Completo:</strong> Coincidencia exacta con el contratista registrado en el contrato.</li>
                      <li><strong>Cédula y Lugar de Expedición:</strong> Número de cédula y municipio de expedición (ej. <em>1078920609 expedida en Lloró</em>).</li>
                    </ul>
                  </div>

                  {/* Coincidencia con Pie de Firma */}
                  <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-teal-950 text-xs">
                      <CheckCircle2 size={15} className="text-teal-700" />
                      <span>3. Coincidencia Idéntica con Pie de Firma</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li>El <strong>Nombre</strong>, la <strong>Cédula</strong> y el <strong>Lugar de expedición</strong> en el texto del juramento deben ser <u>exactamente iguales</u> a los del pie de firma (abajo: <em>ARLEIDA COPETE MACHADO, C.C. 1078920609 de Lloró</em>).</li>
                      <li><em>La rúbrica o imagen de la firma no se penaliza ni audita.</em></li>
                    </ul>
                  </div>

                  {/* Marcación Obligatoria en NO */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
                      <CheckCircle2 size={15} className="text-emerald-700" />
                      <span>4. Marcación de la Casilla NO ( X )</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>Marcación obligatoria:</strong> Debe tener la <strong>X</strong> marcada en <strong>NO ( X )</strong> y estar vacía en <strong>SI ( )</strong>.</li>
                      <li>Si está marcada en SI o no está marcada, se genera observación para corregir la casilla según el Parágrafo 2 del Art. 383 E.T.</li>
                    </ul>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* TAB 5: AUTORIZACIÓN DE DESEMBOLSO */}
          {activeTab === 'desembolso' && (
            <>
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                  <DollarSign size={17} className="text-[#006b33]" />
                  <span>Auditoría de la Autorización de Desembolso / Documento Equivalente</span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Verifica la integridad de datos contractuales, bancarios, consistencia financiera de valores en números y letras, y los datos de contacto en el pie de firma.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <DollarSign size={17} className="text-emerald-700" />
                  <span>Criterios Específicos Auditados en la Autorización</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  
                  {/* Fecha y Consecutivo */}
                  <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-blue-950 text-xs">
                      <Calendar size={15} className="text-blue-700" />
                      <span>1. Fecha y Consecutivo</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>FECHA DE EXPEDICIÓN:</strong> Debe estar debidamente diligenciada y no vacía.</li>
                      <li><strong>CONSECUTIVO NRO.:</strong> Número consecutivo de la cuenta/informe correspondiente.</li>
                    </ul>
                  </div>

                  {/* Datos del Contratista y Bancarios */}
                  <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs">
                      <Briefcase size={15} className="text-indigo-600" />
                      <span>2. Identificación y Datos Bancarios</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>NOMBRE y NIT. Ó C.C:</strong> Coincidencia exacta con el contratista registrado.</li>
                      <li><strong>NRO. DE CUENTA, BANCO y CIUDAD (CHOCÓ):</strong> Cuenta bancaria activa y ciudad registrada.</li>
                      <li><strong>DIRECCIÓN y TELÉFONO:</strong> Datos de contacto diligenciados en la tabla superior.</li>
                    </ul>
                  </div>

                  {/* Concepto y Objeto Contractual */}
                  <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-teal-950 text-xs">
                      <FileText size={15} className="text-teal-700" />
                      <span>3. Concepto, Contrato y Objeto</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>CONCEPTO y NRO.:</strong> 'PRESTACIÓN DE SERVICIOS' y número de contrato asignado.</li>
                      <li><strong>Cuyo objeto es:</strong> Descripción del objeto contractual y mención explícita al período correspondiente de ejecución.</li>
                    </ul>
                  </div>

                  {/* Consistencia Financiera */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs">
                      <DollarSign size={15} className="text-emerald-700" />
                      <span>4. Valores en Números y Letras</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>VALOR EN NÚMEROS, SUBTOTAL, IVA ASUMIDO y TOTAL:</strong> Coherencia financiera exacta con el valor liquidado del período.</li>
                      <li><strong>VALOR EN LETRAS:</strong> Coincidencia exacta en letras con el monto numérico en pesos M/CTE.</li>
                    </ul>
                  </div>

                  {/* Pie de Firma */}
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1.5 md:col-span-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                      <CheckCircle2 size={15} className="text-amber-700" />
                      <span>5. Validación al Pie de Firma</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700 text-[11.5px] leading-relaxed">
                      <li><strong>DIRECCIÓN y TELÉFONO al pie de firma:</strong> Deben estar diligenciados y coincidir con la información de contacto registrada en la tabla de datos del contratista.</li>
                      <li><em>La rúbrica o imagen digital de la firma no es penalizada si el documento se tramita de forma física.</em></li>
                    </ul>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* Cómo usar las observaciones */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <CheckCircle2 size={15} className="text-emerald-700" />
              <span>¿Cómo aplicar las observaciones de la IA?</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11.5px] leading-relaxed">
              <li><strong>Dejar Observación Individual:</strong> Clic en el botón al lado de cualquier hallazgo para insertar la recomendación técnica directamente en la casilla del documento.</li>
              <li><strong>Aplicar en Lote:</strong> El botón <em>«⚡ Aplicar Todas las Observaciones al Informe»</em> inserta de forma automática todas las alertas detectadas en las casillas correspondientes (resaltándolas en amarillo).</li>
            </ul>
          </div>

        </div>

        {/* Pie del Modal */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-medium">
            Alcaldía de Quibdó • Chocó
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#006b33] hover:bg-[#005226] text-white rounded-xl font-bold transition-colors shadow-xs cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
}
