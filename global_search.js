const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.angular') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lfContent = content.replace(/\r\n/g, '\n');
      const lines = lfContent.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('inject(Router)')) {
          console.log(`Found in ${fullPath} at line ${index + 1}: ${line}`);
        }
      });
    }
  }
}

searchDir('.');
