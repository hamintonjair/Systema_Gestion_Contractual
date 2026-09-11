import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `<div className="w-full max-w-[215mm] min-h-[279mm] bg-white shadow-2xl p-[14mm] print:shadow-none print:p-0 print:mx-0 print:w-full border border-gray-300 print:border-none">`,
  `<div className={\`w-full max-w-[215mm] min-h-[279mm] \${isGeneratingPDF ? 'min-w-[800px]' : ''} bg-white shadow-2xl p-[14mm] print:shadow-none print:p-0 print:mx-0 print:w-full border border-gray-300 print:border-none\`}>`
);

fs.writeFileSync('src/App.tsx', content);
