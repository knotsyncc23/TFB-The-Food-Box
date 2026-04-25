const fs = require('fs');
const path = require('path');

const root = 'c:\\Users\\ASUS\\OneDrive\\Desktop\\Appzeto-Master1\\Frontend\\src\\modules\\Food';

const replacements = [
    { from: /#EB590E/gi, to: '#FF3385' },
    { from: /#D94F0C/gi, to: '#D9266E' },
    { from: /#FFF2EB/gi, to: '#F9F9FB' },
    { from: /#FFF1E8/gi, to: '#FF338515' },
    { from: /#aa8b68/gi, to: '#6A2FB1' }, // Deep Violet for some text
    { from: /#aa8b68/gi, to: '#6A2FB1' },
    { from: /primary-orange/g, to: 'primary' },
    { from: /bg-orange-50/g, to: 'bg-[#FF338515]' },
    { from: /text-orange-500/g, to: 'text-[#FF3385]' },
    { from: /bg-orange-500/g, to: 'bg-[#FF3385]' },
    { from: /border-orange-500/g, to: 'border-[#FF3385]' },
];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            walk(filePath);
        } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let original = content;
            
            for (const r of replacements) {
                content = content.replace(r.from, r.to);
            }
            
            if (content !== original) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log('Updated:', filePath);
            }
        }
    }
}

walk(root);
console.log('Modernization complete.');
