const fs = require('fs');
const path = require('path');

const dir = process.cwd();

function getFiles(startPath, extensions) {
    let results = [];
    const files = fs.readdirSync(startPath);
    for (const file of files) {
        if (file === 'node_modules' || file.startsWith('.') || file === 'dist') continue;
        const fullPath = path.join(startPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(getFiles(fullPath, extensions));
        } else if (extensions.includes(path.extname(file))) {
            results.push(fullPath);
        }
    }
    return results;
}

const htmlFiles = getFiles(dir, ['.html']);

const REPLACEMENTS = [
    { regex: /├░┼©┬ÅÔÇ╣├»┬©┬Å/g, replace: '' },
    { regex: /├óÔé¼ÔÇØ/g, replace: '-' },
    { regex: /├â┬│/g, replace: 'o' },
    { regex: /ðŸ ‹ï¸ /g, replace: '' },
    { regex: /â€”/g, replace: '-' },
    { regex: /histÃ³rico/g, replace: 'historico' },
    { regex: /Ã³/g, replace: 'ó' },
    { regex: /Ã¡/g, replace: 'á' },
    { regex: /Ã©/g, replace: 'é' },
    { regex: /Ã/g, replace: 'í' },
    { regex: /Ãº/g, replace: 'ú' },
    { regex: /Ã±/g, replace: 'ñ' },
    { regex: /Â/g, replace: '' },
    { regex: /ðŸ’ª/g, replace: '💪' },
    { regex: /âš /g, replace: '⚠️' }
];

console.log(`Checking ${htmlFiles.length} HTML files...`);
for (const file of htmlFiles) {
    // Read the file buffer and try to decode if needed, but since Vite reads as UTF-8,
    // we'll read as UTF-8 and replace the mangled utf-8 interpretations.
    let content = fs.readFileSync(file, 'utf8'); 
    let modified = false;

    // 1. Convert scripts
    if (content.match(/<script\s+src="js\//g)) {
        content = content.replace(/<script\s+src="js\//g, '<script type="module" src="js/');
        modified = true;
    }
    
    // Check if there are other local scripts that need type="module"
    const scripts = content.match(/<script\s+src="([^"]+)"/g) || [];
    for (const s of scripts) {
        if (s.includes('tailwindcss.com') || s.includes('chart.js') || s.includes('supabase-js') || s.includes('type="module"')) continue;
        if (s.includes('js/')) {
             const newS = s.replace('<script ', '<script type="module" ');
             content = content.replace(s, newS);
             modified = true;
        }
    }

    // 2. Remove broken SVG favicons
    if (content.includes('data:image/svg+xml')) {
        content = content.replace(/<link rel="icon"[^>]*?href="data:image\/svg\+xml[^>]*>/g, '');
        modified = true;
    }

    // 3. Add meta charset
    if (!content.includes('meta charset')) {
        content = content.replace(/<head>/, '<head>\n    <meta charset="UTF-8" />');
        modified = true;
    }

    // 4. Replace corrupted characters
    for (const r of REPLACEMENTS) {
        if (content.match(r.regex)) {
            content = content.replace(r.regex, r.replace);
            modified = true;
        }
    }

    if (modified) {
        console.log('Fixed:', path.basename(file));
        fs.writeFileSync(file, content, 'utf8');
    }
}
console.log('Done fixing HTML files.');
