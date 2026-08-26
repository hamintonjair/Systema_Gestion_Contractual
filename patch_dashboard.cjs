const fs = require('fs');
let content = fs.readFileSync('src/components/ContratistaDashboard.tsx', 'utf8');

content = content.replace(
  "import SoporteFiduciariaDoc from './SoporteFiduciariaDoc';",
  "import SoporteFiduciariaDoc from './SoporteFiduciariaDoc';\nimport DeclaracionRentaDoc from './DeclaracionRentaDoc';"
);

const oldBlock = `      {/* VISTA DEL MÓDULO 4: DECLARACIÓN BAJO JURAMENTO */}
      {activeModuleTab === 'juramento' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                <Scale size={18} />
                <span>Régimen de Contratación Pública</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Declaración Bajo la Gravedad de Juramento
              </h3>
              <p className="text-xs text-slate-500">
                Manifestación expresa de cumplimiento de obligaciones legales, fiscales y ausencia de inhabilidades o incompatibilidades.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4 text-xs text-slate-700 leading-relaxed">
            <p className="font-semibold text-slate-900 text-sm">
              Yo, <strong>{user.nombreCompleto}</strong>, identificado(a) con C.C. Nro. <strong>{user.documentoIdentidad}</strong>, en mi condición de contratista de prestación de servicios de la <strong>Alcaldía Municipal de Quibdó</strong> (Contrato #{activeContractNro} de 2026), declaro bajo la gravedad de juramento que:
            </p>

            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>He cumplido a cabalidad con los aportes al Sistema de Seguridad Social Integral (Salud, Pensión y Riesgos Laborales) correspondientes al periodo facturado.</li>
              <li>No me encuentro incurso(a) en causales de inhabilidad, incompatibilidad o conflicto de intereses de conformidad con la Constitución Política y la Ley 80 de 1993.</li>
              <li>Las actividades descritas en el informe mensual reflejan fielmente la labor desempeñada en el cumplimiento del objeto contractual.</li>
            </ul>

            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span>Constancia digital vinculada al perfil del contratista</span>
              <span className="font-mono font-bold text-emerald-800">Radicado Electrónico Vigencia 2026</span>
            </div>
          </div>
        </div>
      )}`;

const newBlock = `      {/* VISTA DEL MÓDULO 4: DECLARACIÓN BAJO JURAMENTO */}
      {activeModuleTab === 'juramento' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-[#006b33] font-bold text-xs uppercase tracking-wider">
                <Scale size={18} />
                <span>Régimen de Contratación Pública</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 mt-1">
                Declaración Bajo la Gravedad de Juramento (Retención en la fuente)
              </h3>
              <p className="text-xs text-slate-500">
                Certificación para efectos de retención en la fuente ley 1819 de 2016 - Rentas de Trabajo.
              </p>
            </div>
          </div>

          {/* DOCUMENTO OFICIAL DECLARACIÓN RENTA */}
          <div className="bg-slate-100 p-3 sm:p-6 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center">
            <DeclaracionRentaDoc
              reportData={reportsList[0] || initialMockData}
              storageKey={\`dec_renta_\${user.documentoIdentidad || ''}_\${(reportsList[0])?.informeNro || '1'}\`}
              isEditable={true}
            />
          </div>
        </div>
      )}`;

if(content.indexOf("VISTA DEL MÓDULO 4") > -1) {
    let before = content.substring(0, content.indexOf("{/* VISTA DEL MÓDULO 4"));
    let afterIndex = content.indexOf("{/* VISTA DEL MÓDULO 5");
    let after = content.substring(afterIndex);
    content = before + newBlock + "\n\n      " + after;
    fs.writeFileSync('src/components/ContratistaDashboard.tsx', content);
    console.log("Replaced successfully");
} else {
    console.log("Could not find block");
}
