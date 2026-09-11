const fs = require('fs');
let content = fs.readFileSync('src/components/ContratistaDashboard.tsx', 'utf8');

if (!content.includes('selectedJuramentoReport')) {
  content = content.replace(
    /const \[selectedFidReport, setSelectedFidReport\] = useState<ReportData \| null>\(null\);/,
    "const [selectedFidReport, setSelectedFidReport] = useState<ReportData | null>(null);\n  const [selectedJuramentoReport, setSelectedJuramentoReport] = useState<ReportData | null>(null);"
  );
}

const oldBlockRegex = /\{\/\* VISTA DEL MÓDULO 4: DECLARACIÓN BAJO JURAMENTO \*\/\}[\s\S]*?\{\/\* VISTA DEL MÓDULO 5: AUTORIZACIÓN DE DESEMBOLSO \*\/\}/;

const newBlock = `{/* VISTA DEL MÓDULO 4: DECLARACIÓN BAJO JURAMENTO */}
      {activeModuleTab === 'juramento' && (
        <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Tarjeta de Control del Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                  <Scale size={18} />
                  <span>Régimen de Contratación Pública</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  Declaración Bajo la Gravedad de Juramento (Retención en la fuente)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Certificación para efectos de retención en la fuente ley 1819 de 2016 - Rentas de Trabajo.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Vigencia 2026
                </span>
              </div>
            </div>

            {/* Selector de Informes radicados para generar / ver su declaracion */}
            {reportsList.length > 0 && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700">Seleccionar Informe para Soporte:</span>
                  <select
                    value={(selectedJuramentoReport || reportsList[0])?.informeNro}
                    onChange={(e) => {
                      const found = reportsList.find(r => String(r.informeNro) === e.target.value);
                      if (found) setSelectedJuramentoReport(found);
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {reportsList.map(r => (
                      <option key={r.id || r.informeNro} value={r.informeNro}>
                        Informe #{r.informeNro} ({r.tipoInforme}) - Estado: {r.estado || 'Enviado'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedJuramentoReport || reportsList[0])?.estado === 'Aprobado' 
                    ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold border border-emerald-200">
                        <CheckCircle2 size={14} />
                        <span>Soporte Avalado por Supervisión</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
                        <AlertCircle size={14} />
                        <span>Requiere Aprobación Previa</span>
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>

          {/* DOCUMENTO OFICIAL DECLARACIÓN RENTA */}
          <div className="bg-slate-100 p-3 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center">
            <DeclaracionRentaDoc
              reportData={selectedJuramentoReport || reportsList[0] || initialMockData}
              storageKey={\`dec_renta_\${user.documentoIdentidad || ''}_\${(selectedJuramentoReport || reportsList[0])?.informeNro || '1'}\`}
              isEditable={true}
            />
          </div>

        </div>
      )}

      {/* VISTA DEL MÓDULO 5: AUTORIZACIÓN DE DESEMBOLSO */}`;

content = content.replace(oldBlockRegex, newBlock);
fs.writeFileSync('src/components/ContratistaDashboard.tsx', content);
