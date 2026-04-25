const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'src/modules/Food');

const replacements = [
  { from: /#EB590E/gi, to: '#FF3385' },
  { from: /#D94F0C/gi, to: '#D9266E' },
  { from: /#FFF2EB/gi, to: '#F9F9FB' },
  { from: /#FFF4ED/gi, to: '#FDF2F7' },
  { from: /primary-orange/g, to: 'primary' }
];

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      walk(fullPath);
    } else {
      if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.tsx') || fullPath.endsWith('.css')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        let originalContent = content;
        
        replacements.forEach(({ from, to }) => {
          content = content.replace(from, to);
        });

        if (content !== originalContent) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated: ${fullPath.replace(__dirname, '')}`);
        }
      }
    }
  });
}

console.log('Modernizing Food module theme...');
walk(baseDir);
console.log('Theme modernization complete.');
