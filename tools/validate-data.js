// Checks data/content.json for the rules the project promises (sources, both languages, valid ids).
// Usage: node tools/validate-data.js   (exit code 1 if anything is wrong)
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data');
const D = JSON.parse(fs.readFileSync(path.join(dir, 'content.json'), 'utf8'));
const errors = [];
const err = (m) => errors.push(m);

const isLang = (o) => o && typeof o.en === 'string' && o.en.trim() && typeof o.fil === 'string' && o.fil.trim();
const needLang = (o, where) => { if (!isLang(o)) err(`${where}: missing or empty en/fil text`); };
const srcOk = (ids, where, required) => {
  if (!Array.isArray(ids)) return err(`${where}: src must be an array`);
  if (required && ids.length === 0) err(`${where}: needs at least one source`);
  ids.forEach((id) => { if (!D.sources[id]) err(`${where}: unknown source id "${id}"`); });
};
const reviewOk = (r, where) => {
  if (r === undefined) return;
  if (!['unreviewed', 'reviewed'].includes(r.status)) err(`${where}: review.status must be unreviewed or reviewed`);
  if (r.status === 'reviewed' && !(r.by && /^\d{4}-\d{2}-\d{2}$/.test(r.date || ''))) err(`${where}: a reviewed item needs review.by and review.date (YYYY-MM-DD)`);
};
const unique = (items, what) => {
  const seen = new Set();
  items.forEach((i) => { if (seen.has(i.id)) err(`${what}: duplicate id "${i.id}"`); seen.add(i.id); });
};

// UI strings
Object.entries(D.ui).forEach(([k, v]) => {
  if (v && v.en !== undefined) needLang(v, `ui.${k}`);
  else Object.entries(v).forEach(([k2, v2]) => needLang(v2, `ui.${k}.${k2}`));
});

// sources
Object.entries(D.sources).forEach(([k, s]) => { if (!s.label || !/^https?:\/\//.test(s.url || '')) err(`sources.${k}: needs label and http(s) url`); });

// legend and rites and glossary
D.legend.paragraphs.forEach((p, i) => { needLang(p.text, `legend.paragraphs[${i}]`); srcOk(p.src, `legend.paragraphs[${i}]`, true); reviewOk(p.review, `legend.paragraphs[${i}]`); });
needLang(D.legend.originNote, 'legend.originNote'); srcOk(D.legend.originNote.src, 'legend.originNote', true);
unique(D.rites, 'rites'); D.rites.forEach((r) => { ['day', 'title', 'text'].forEach((f) => needLang(r[f], `rites.${r.id}.${f}`)); srcOk(r.src, `rites.${r.id}`, true); reviewOk(r.review, `rites.${r.id}`); });
unique(D.glossary, 'glossary'); D.glossary.forEach((g) => { needLang(g.name, `glossary.${g.id}.name`); needLang(g.text, `glossary.${g.id}.text`); srcOk(g.src, `glossary.${g.id}`, true); reviewOk(g.review, `glossary.${g.id}`); });

// directory
const dayIds = D.days.map((d) => d.id);
D.days.forEach((d) => needLang(d, `days.${d.id}`));
unique(D.directory, 'directory');
D.directory.forEach((e) => {
  const w = `directory.${e.id}`;
  ['name', 'when', 'where', 'text'].forEach((f) => needLang(e[f], `${w}.${f}`));
  srcOk(e.src, w, true); reviewOk(e.review, w);
  if (!D.filters.category[e.category]) err(`${w}: unknown category "${e.category}"`);
  if (!Array.isArray(e.towns) || !e.towns.length) err(`${w}: towns must be a non-empty array`);
  else e.towns.forEach((t) => { if (!D.filters.municipality[t]) err(`${w}: unknown town "${t}"`); });
  if (!Array.isArray(e.days) || !e.days.length) err(`${w}: days must be a non-empty array`);
  else e.days.forEach((x) => { if (x !== 'any' && !dayIds.includes(x)) err(`${w}: unknown day "${x}"`); });
});

// quiz and etiquette
unique(D.quiz, 'quiz');
D.quiz.forEach((q) => {
  const w = `quiz.${q.id}`;
  needLang(q.q, `${w}.q`); needLang(q.why, `${w}.why`); srcOk(q.src, w, true); reviewOk(q.review, w);
  if (!Array.isArray(q.options) || q.options.length < 2) err(`${w}: needs 2+ options`); else q.options.forEach((o, i) => needLang(o, `${w}.options[${i}]`));
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options || []).length) err(`${w}: answer index out of range`);
});
unique(D.etiquette, 'etiquette');
D.etiquette.forEach((e) => {
  const w = `etiquette.${e.id}`;
  needLang(e.text, `${w}.text`);
  if (!['sourced', 'pending'].includes(e.type)) err(`${w}: type must be sourced or pending`);
  srcOk(e.src, w, e.type === 'sourced');
  if (e.type === 'pending' && e.src.length) err(`${w}: a "pending" item should not list sources (change its type to "sourced" once confirmed)`);
  reviewOk(e.review, w);
});

// generated copy in sync?
try {
  const js = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
  const copy = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
  if (JSON.stringify(copy) !== JSON.stringify(D)) err('data/content.js is out of date: run node tools/build-data.js');
} catch (e) { err('data/content.js missing or unreadable: run node tools/build-data.js'); }

if (errors.length) { console.error(errors.length + ' problem(s):\n- ' + errors.join('\n- ')); process.exit(1); }
console.log(`OK: ${D.directory.length} directory entries, ${D.rites.length} timeline items, ${D.glossary.length} glossary parts, ${D.quiz.length} quiz questions, ${D.etiquette.length} etiquette items, ${Object.keys(D.sources).length} sources.`);
