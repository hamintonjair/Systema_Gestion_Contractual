const fs = require('fs');
let content = fs.readFileSync('src/components/DeclaracionRentaDoc.tsx', 'utf8');

// Imports
content = content.replace(
  /import\s*{\s*Printer,\s*Download,\s*Save,\s*Check\s*}\s*from\s*'lucide-react';/,
  "import { Printer, Save, Check, Edit3 } from 'lucide-react';"
);

content = content.replace(/import html2canvas from 'html2canvas';\n/g, '');
content = content.replace(/import { jsPDF } from 'jspdf';\n/g, '');

// State
content = content.replace(
  /const\s*\[saveSuccess,\s*setSaveSuccess\]\s*=\s*useState<boolean>\(false\);/,
  "const [saveSuccess, setSaveSuccess] = useState<boolean>(false);\n  const [isEditing, setIsEditing] = useState<boolean>(false);"
);

// handleExportPDF remove
content = content.replace(/const handleExportPDF = async \(\) => {[\s\S]*?};\n/g, '');
content = content.replace(/const \[isExporting,\s*setIsExporting\]\s*=\s*useState<boolean>\(false\);\n/g, '');

// Print CSS
content = content.replace(
  /@page { size: letter; margin: 0; }/,
  `@page { size: letter; margin: 0; }` // already there
);
content = content.replace(
  /body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }/,
  `body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 10mm !important; }`
);


// Action Panel replace
const panelRegex = /<div className="flex gap-2">[\s\S]*?<\/div>\n\s*<\/div>/;
const newPanel = `<div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${
                isEditing 
                  ? 'bg-amber-400 text-gray-950 hover:bg-amber-300 shadow-xs' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
              }\`}
            >
              {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
              <span className="hidden sm:inline">{isEditing ? 'Modo Visualización' : 'Llenar / Editar Campos'}</span>
            </button>
            <button
              onClick={handleSave}
              className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all \${
                saveSuccess ? 'bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }\`}
            >
              {saveSuccess ? <Check size={14} /> : <Save size={14} />}
              <span className="hidden sm:inline">{saveSuccess ? 'Guardado' : 'Guardar Datos'}</span>
            </button>
            <button
              onClick={handleDirectPrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors"
              title="Imprimir Copia Oficial"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        </div>`;
content = content.replace(panelRegex, newPanel);

// Replace isEditable with isEditing inside the form inputs
// We need to be careful because `isEditable && handleFieldChange` might still rely on isEditable. Actually, `isEditing && handleFieldChange` is better, or both. Let's just globally replace `{isEditable ? (` with `{isEditing ? (`
// wait, the regex for `{isEditable ? (` in the file is very specific
content = content.replace(/{isEditable \? \(/g, '{isEditing ? (');
content = content.replace(/isEditable && handleFieldChange/g, 'isEditing && handleFieldChange');

fs.writeFileSync('src/components/DeclaracionRentaDoc.tsx', content);
console.log('patched DeclaracionRentaDoc.tsx');
