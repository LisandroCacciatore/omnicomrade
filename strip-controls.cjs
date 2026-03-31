const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Strip control characters (including C1 controls U+0080 - U+009F that cause parse5 error)
  // Also strip any weird unicode "replacement character" or raw Latin1 symbols if they are just garbage
  // But wait, the parse5 error is exactly: control-character-in-input-stream
  // This means characters in ranges: \x00-\x08, \x0B, \x0C, \x0E-\x1F, \x7F-\x9F
  const controlCharsRegExp = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
  
  if (controlCharsRegExp.test(content)) {
    content = content.replace(controlCharsRegExp, '');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Stripped control characters from', file);
  } else {
    // To be absolutely sure, let's also strip the specific garbage String found:
    if (content.includes('Ã°Å¸Â €¹Ã¯Â¸Â') || content.includes('Ã°')) {
      content = content.replace(/Ã°Å¸Â €¹Ã¯Â¸Â/g, '');
      content = content.replace(/Ã°/g, '');
      fs.writeFileSync(file, content, 'utf8');
      console.log('Stripped specific garbage from', file);
    }
  }
}
