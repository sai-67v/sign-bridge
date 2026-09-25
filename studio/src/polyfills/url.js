/* eslint-env browser */
// Polyfill for Node.js 'url' module in browser environment
// Exports URL class which is available as a global in modern browsers
// Supports both CommonJS and ES module imports

// eslint-disable-next-line no-undef
const globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global);
const URLClass = typeof URL !== 'undefined' ? URL : globalObj.URL;
const URLSearchParamsClass = typeof URLSearchParams !== 'undefined' ? URLSearchParams : globalObj.URLSearchParams;

// CommonJS export
module.exports = {
  URL: URLClass,
  URLSearchParams: URLSearchParamsClass,
};

// ES module export (webpack will use this for import statements)
module.exports.URL = URLClass;
module.exports.URLSearchParams = URLSearchParamsClass;
