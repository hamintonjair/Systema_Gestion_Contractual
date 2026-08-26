const fs = require('fs');
let content = fs.readFileSync('src/services/supabaseService.ts', 'utf8');
content = content.replace(
  /return null;\s*}\s*\/\/\ 17\.\ Guardar Declaracion Renta/g,
  "return null;\n  },\n  // 17. Guardar Declaracion Renta"
);
fs.writeFileSync('src/services/supabaseService.ts', content);
