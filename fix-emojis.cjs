const fs = require('fs');

const FIXES = {
  'ðŸ§ ': '🧠',
  'ðŸ˜´': '😴',
  'ðŸ˜«': '😫',
  'ðŸ˜”': '😔',
  'ðŸ˜ ': '😐',
  'ðŸ˜Š': '😊',
  'ðŸ¤©': '🤩',
  'âœ…': '✅',
  'ðŸŸ¡': '🟡',
  'ðŸŸ ': '🟠',
  'ðŸ”´': '🔴',
  'ðŸš¨': '🚨',
  'âš¡': '⚡',
  'ðŸª«': '🪫',
  'ðŸ‘ ': '👍',
  'ðŸ”¥': '🔥',
  'âšª': '⚪',
  'â†’': '→',
  'ðŸ ‹ï¸ ': '🏋️',
  'ðŸ“…': '📅',
  'sueí±o': 'sueño',
  'Energí­a': 'Energía',
  'energí­a': 'energía',
  'Guardandoâ€¦': 'Guardando...',
  'â€¦': '...'
};

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [bad, good] of Object.entries(FIXES)) {
    if (content.indexOf(bad) !== -1) {
      // replace all occurrences
      content = content.split(bad).join(good);
      changed = true;
    }
  }
  
  // Also clean up any random ð or â that might be left
  // which causes parse errors in Vite
  const regex = /[ðâ]/g;
  if(regex.test(content)) {
      content = content.replace(regex, '');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed emojis in', file);
  }
}
