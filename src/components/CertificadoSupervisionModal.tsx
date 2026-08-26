import React, { useState } from 'react';
import { CertificadoSupervisionData, ReportData, createDefaultCertificadoData } from '../types';
import CertificadoSupervisionDoc from './CertificadoSupervisionDoc';
import { X, ShieldCheck, Printer, Download, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reportData?: ReportData;
  initialCertData?: CertificadoSupervisionData;
  isEditable?: boolean;
}

export default function CertificadoSupervisionModal({
  isOpen,
  onClose,
  reportData,
  initialCertData,
  isEditable = true,
}: Props) {
  const [certData, setCertData] = useState<CertificadoSupervisionData>(() => {
    if (initialCertData) return initialCertData;
    return createDefaultCertificadoData(reportData);
  });

  React.useEffect(() => {
    if (initialCertData) {
      setCertData(initialCertData);
    } else if (reportData) {
      setCertData(createDefaultCertificadoData(reportData));
    }
  }, [initialCertData, reportData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible print:h-auto print:max-h-none print:block">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col border border-slate-300 overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none print:overflow-visible print:block">
        
        {/* Cabecera del Modal (No imprimible) */}
        <div className="bg-[#00381a] text-white px-5 py-3.5 flex items-center justify-between shadow-xs print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Certificado de Supervisión y Autorización de Desembolso</span>
                <span className="text-[10px] bg-amber-400 text-gray-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Oficial
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200">
                Alcaldía de Quibdó • Dependencia Supervisora: {certData.supervisorCargo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/80 transition-colors"
              title="Cerrar vista"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cuerpo con el Documento Oficial */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/70 print:p-0 print:bg-white print:overflow-visible print:block">
          <CertificadoSupervisionDoc
            data={certData}
            onChange={(updated) => setCertData(updated)}
            isEditable={isEditable}
          />
        </div>

      </div>
    </div>
  );
}
