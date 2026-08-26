import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `        document.body?.focus();`,
  `        document.body?.focus();\n        window.dispatchEvent(new Event('resize'));`
);

fs.writeFileSync('src/App.tsx', content);
