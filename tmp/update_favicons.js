const fs = require('fs');
const path = require('path');

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('assets/img/favicon.png')) {
        const faviconTag = '\n    <link rel="icon" type="image/png" href="assets/img/favicon.png" />';
        content = content.replace(/(<title>.*<\/title>)/, `$1${faviconTag}`);
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    }
});
