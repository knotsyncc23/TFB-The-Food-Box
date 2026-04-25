const fs = require('fs');
const path = require('path');

const root = 'c:\\Users\\ASUS\\OneDrive\\Desktop\\Appzeto-Master1\\Frontend\\src\\modules\\Food';

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            walk(filePath);
        } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let changed = false;
            
            // Primary Replacement
            if (content.includes('#EB590E')) {
                content = content.replace(/#EB590E/gi, '#FF3385');
                changed = true;
            }
            if (content.includes('#D94F0C')) {
                content = content.replace(/#D94F0C/gi, '#D9266E');
                changed = true;
            }
            if (content.includes('#FFF2EB')) {
                content = content.replace(/#FFF2EB/gi, '#F9F9FB');
                changed = true;
            }
             if (content.includes('#FFF1E8')) {
                content = content.replace(/#FFF1E8/gi, '#FF338515'); // Light magenta background
                changed = true;
            }
            if (content.includes('primary-orange')) {
                content = content.replace(/primary-orange/g, 'primary');
                changed = true;
            }
            
            if (changed) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log('Updated:', filePath);
            }
        }
    }
}

walk(root);
console.log('Modernization complete.');
