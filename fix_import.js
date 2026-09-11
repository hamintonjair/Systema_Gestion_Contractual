import fs from 'fs';
let content = fs.readFileSync('src/components/ReportEditor.tsx', 'utf-8');

if (!content.includes('import ReportPreview')) {
  content = content.replace(
    `import React, { useState, useEffect } from 'react';`,
    `import React, { useState, useEffect } from 'react';\nimport ReportPreview from './ReportPreview';`
  );
  fs.writeFileSync('src/components/ReportEditor.tsx', content);
}
