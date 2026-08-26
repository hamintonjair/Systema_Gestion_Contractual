import fs from 'fs';
let content = fs.readFileSync('src/components/ReportEditor.tsx', 'utf-8');

content = content.replace(
  `<p className="text-gray-500 italic mb-2">Para ver cómo quedará el documento final, utiliza la vista previa en pantallas grandes o descárgalo/imprímelo directamente.</p>`,
  `<p className="text-gray-500 italic mb-2 hidden lg:block">Para ver cómo quedará el documento final, utiliza la vista previa en pantallas grandes o descárgalo/imprímelo directamente.</p>
                  
                  <div className="lg:hidden mt-4 mb-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-2 relative h-[500px] overflow-y-auto">
                    <p className="text-xs text-center text-gray-400 mb-2 font-bold uppercase tracking-widest">Vista Previa Móvil</p>
                    <div className="transform origin-top scale-[0.45] sm:scale-[0.6] w-[215mm] bg-white shadow-sm mx-auto">
                       <ReportPreview data={data} />
                    </div>
                  </div>`
);

// We need to import ReportPreview in ReportEditor.tsx if it's not imported.
if (!content.includes('import ReportPreview')) {
  content = content.replace(
    `import FieldCommentModal from './FieldCommentModal';`,
    `import FieldCommentModal from './FieldCommentModal';\nimport ReportPreview from './ReportPreview';`
  );
}

fs.writeFileSync('src/components/ReportEditor.tsx', content);
