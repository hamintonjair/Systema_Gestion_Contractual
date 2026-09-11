import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `<div className="hidden lg:flex flex-1 h-full overflow-y-auto p-6 xl:p-8 bg-gray-200 justify-center print:block print:p-0 print:overflow-visible print:bg-white print:w-full">`,
  `<div className={\`\${isGeneratingPDF ? 'flex absolute inset-0 z-0 opacity-0 lg:static lg:opacity-100 lg:z-auto' : 'hidden lg:flex'} flex-1 h-full overflow-y-auto p-6 xl:p-8 bg-gray-200 justify-center print:block print:p-0 print:overflow-visible print:bg-white print:w-full\`}>`
);

fs.writeFileSync('src/App.tsx', content);
