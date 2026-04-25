const fs = require('fs');
const path = require('path');

const root = 'c:\\Users\\ASUS\\OneDrive\\Desktop\\Appzeto-Master1\\Frontend\\src\\modules\\Food';

const replacements = [
    { from: /#EB590E/gi, to: '#FF3385' },
    { from: /#D94F0C/gi, to: '#D9266E' },
    { from: /#FFF2EB/gi, to: '#F9F9FB' },
    { from: /#FFF1E8/gi, to: '#FF338515' }
];

function modernize(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            modernize(fullPath);
        } else if (/\.(jsx|js|tsx|css)$/.test(file)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let updated = content;
            let count = 0;
            
            replacements.forEach(r => {
                const matches = updated.match(r.from);
                if (matches) {
                    count += matches.length;
                    updated = updated.replace(r.from, r.to);
                }
            });
            
            if (count > 0) {
                fs.writeFileSync(fullPath, updated, 'utf8');
                console.log(`Updated ${fullPath}: ${count} replacements`);
            }
        }
    }
}

modernize(root);
console.log('Done.');
