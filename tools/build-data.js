// Regenerates data/content.js from data/content.json (run after editing the JSON).
// Usage:  node tools/build-data.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const json = JSON.parse(fs.readFileSync(path.join(dir, 'content.json'), 'utf8')); // also validates the JSON
fs.writeFileSync(
  path.join(dir, 'content.js'),
  '/* GENERATED from content.json by tools/build-data.js. Edit content.json, then re-run the script. */\n' +
  'window.MHG_DATA = ' + JSON.stringify(json, null, 2) + ';\n'
);
console.log('data/content.js written');
