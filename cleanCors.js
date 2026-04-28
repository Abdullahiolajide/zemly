const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('supabase/functions/**/index.ts', { absolute: true });

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix imports
  content = content.replace(/import\s+\{\s*([^}]*)\s*\}\s+from\s+['\"].*\/?_shared\/cors\.ts['\"];?\n?/g, '');
  
  if (!content.includes('serveWithCors')) {
      content = content.replace(/import \{ serve \} from 'https:\/\/deno\.land\/std\@0\.168\.0\/http\/server\.ts';/, 
        "import { serveWithCors } from '../_shared/server.ts';"
      );
  }

  // Ensure "serveWithCors" isn't incorrectly doubling up if it was manually replaced
  content = content.replace(/serveWithCorsWithCors/g, 'serveWithCors');

  // Remove the OPTIONS check
  content = content.replace(/if\s*\(req\.method\s*===\s*'OPTIONS'\)\s*return\s*handleCors(\([^\)]*\))?;\n?/g, '');
  content = content.replace(/if\s*\(req\.method\s*===\s*'OPTIONS'\)\s*\{\s*return\s*handleCors(\([^\)]*\))?;\s*\}\n?/g, '');

  content = content.replace(/serve\(\s*async/g, 'serveWithCors(async');

  // Remove ...corsHeaders,
  content = content.replace(/\.\.\.corsHeaders,\s*/g, '');
  content = content.replace(/\.\.\.getCorsHeaders\(req\),\s*/g, '');

  fs.writeFileSync(file, content);
}
console.log('Fixed all functions');