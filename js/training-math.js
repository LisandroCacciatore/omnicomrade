(function (global) {
  function roundWeight(value, step = 2.5) {
    return Math.round(value / step) * step;
  }

  function pct(base, percent, step = 2.5) {
    return roundWeight(base * percent, step);
  }

  const api = { roundWeight, pct };

  global.tfTrainingMath = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
