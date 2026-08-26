import fs from 'fs';
let content = fs.readFileSync('src/services/supabaseService.ts', 'utf-8');

content = content.replace(
  `async getContractorReports(contractorDocument?: string, contractorId?: string): Promise<ReportData[]> {`,
  `async getContractorReports(contractorDocument?: string, contractorId?: string): Promise<ReportData[] | null> {`
);

content = content.replace(
  `      console.warn('Error in getContractorReports from Supabase:', err);\n    }\n\n    return [];`,
  `      console.warn('Error in getContractorReports from Supabase:', err);\n      return null;\n    }\n\n    return [];`
);

fs.writeFileSync('src/services/supabaseService.ts', content);
