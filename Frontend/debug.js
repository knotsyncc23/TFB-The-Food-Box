const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\ASUS\\OneDrive\\Desktop\\Appzeto-Master1\\Frontend\\src\\modules\\Food\\pages\\user\\Under250.jsx', 'utf8');
const r = /#EB590E/gi;
const matches = content.match(r);
console.log('Matches found:', matches ? matches.length : 0);
if (matches) {
    console.log('Example match:', matches[0]);
}
