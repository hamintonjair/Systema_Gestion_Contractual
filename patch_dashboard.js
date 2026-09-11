import fs from 'fs';
let content = fs.readFileSync('src/components/ContratistaDashboard.tsx', 'utf-8');

// Replace the fallback condition to also handle deleted reports
content = content.replace(
  `      if (saved) {`,
  `      const isDeleted = localStorage.getItem(\`deleted_report_\${userDoc}_\${i}\`) === 'true' || localStorage.getItem(\`deleted_report_\${i}\`) === 'true';\n      if (saved && !isDeleted) {`
);

fs.writeFileSync('src/components/ContratistaDashboard.tsx', content);
