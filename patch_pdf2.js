import fs from 'fs';
let content = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf-8');

content = content.replace(
  `windowWidth: 800`,
  `windowWidth: 1024` // Better fit for A4 proportions when rendering
);

fs.writeFileSync('src/utils/pdfGenerator.ts', content);
