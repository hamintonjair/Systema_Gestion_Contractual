import fs from 'fs';
let content = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf-8');

content = content.replace(
  `  const opt = {`,
  `  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);\n  if (isMobile) {\n    window.print();\n    return true;\n  }\n\n  const opt = {`
);
content = content.replace(`scale: 2,`, `scale: 1.5,`);

fs.writeFileSync('src/utils/pdfGenerator.ts', content);
