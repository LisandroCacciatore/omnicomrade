const fs = require('fs');
const vm = require('vm');
const path = require('path');

/**
 * Loads a TechFitness script into a sandbox.
 * @param {string} filename - Filename in the js/ directory.
 * @param {string[]} dependencies - List of other filenames to load before this one.
 * @returns {any} The exported API object (e.g., tfTrainingMath, tfUtils).
 */
function loadTfScript(filename, dependencies = []) {
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    requestAnimationFrame: (fn) => fn(),
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {},
    console,
    setTimeout,
    clearTimeout,
    globalThis: {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);

  // Load dependencies first
  for (const dep of dependencies) {
    const depSource = fs.readFileSync(path.join('js', dep), 'utf8');
    vm.runInContext(depSource, sandbox);
  }

  // Load main script
  const source = fs.readFileSync(path.join('js', filename), 'utf8');
  vm.runInContext(source, sandbox);

  // Heuristic to find the API object
  // Expected forms: tfTrainingMath, tfUtils, tfTrainingEngine, tfUiUtils, tfDb, AthleteInsights
  const possibleNames = [
    'tfUtils',
    'tfTrainingMath',
    'tfTrainingEngine',
    'tfUiUtils',
    'tfDb',
    'AthleteInsights',
    'tf' +
      filename
        .replace('.js', '')
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')
  ];

  for (const name of possibleNames) {
    if (sandbox[name]) return sandbox[name];
  }

  return sandbox;
}

module.exports = { loadTfScript };
