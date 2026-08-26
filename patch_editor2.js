import fs from 'fs';
let content = fs.readFileSync('src/components/ReportEditor.tsx', 'utf-8');

content = content.replace(
  `                      <p className="text-[10px] text-gray-500 mt-1">Sube el fondo institucional (hoja membretada). Una vez subido, será el mismo para todos los contratistas.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}`,
  `                      <p className="text-[10px] text-gray-500 mt-1">Sube el fondo institucional (hoja membretada). Una vez subido, será el mismo para todos los contratistas.</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="lg:hidden bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-3">
               <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-gray-100">
                  <span className="flex items-center gap-1.5"><Printer size={14} className="text-emerald-700" /> Vista Previa (Móvil)</span>
               </h3>
               <p className="text-[10px] text-gray-500">
                  Usa el botón "Imprimir / Descargar PDF" de la barra superior. Si tu navegador móvil no soporta la descarga directa, usa esta vista para revisar.
               </p>
               <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 p-2 relative h-[450px] overflow-y-auto">
                  <div className="transform origin-top scale-[0.4] sm:scale-[0.55] w-[215mm] bg-white shadow-sm mx-auto">
                     <ReportPreview data={data} />
                  </div>
               </div>
            </div>
          </div>
        )}`
);

if (!content.includes('import ReportPreview')) {
  content = content.replace(
    `import FieldCommentModal from './FieldCommentModal';`,
    `import FieldCommentModal from './FieldCommentModal';\nimport ReportPreview from './ReportPreview';`
  );
}

fs.writeFileSync('src/components/ReportEditor.tsx', content);
