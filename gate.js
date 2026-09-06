#!/usr/bin/env node
/*
 * Regression gate for the Rot Check engine.
 *
 * WHAT THIS IS: it asserts that the engine's behaviour has not CHANGED.
 * WHAT THIS IS NOT: it does not assert the engine is CORRECT. The expectations
 * below were captured from current behaviour, bugs included. See "Known limits"
 * in README.md. Do not read a green run as a quality signal.
 *
 * It is fail-closed on purpose: any load error, any drift, exit code 1.
 * An earlier harness printed a load error and exited 0. That is the failure
 * mode this file exists to not repeat.
 *
 *   node gate.js            assert against EXPECTED below
 *   node gate.js --update   reprint EXPECTED after an intentional change
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXPECTED = {
  checkCount: 14,
  cannotEverFail: [7, 8, 9],
  files: {
    'fixtures/broken-cron.txt':   { kind: 'cron',    FAIL: 1, PASS: 0,  UNKNOWN: 1,  NA: 12 },
    'fixtures/broken-skill.md':   { kind: 'prompt',  FAIL: 6, PASS: 0,  UNKNOWN: 6,  NA: 2 },
    'fixtures/broken-task.xml':   { kind: 'taskxml', FAIL: 1, PASS: 0,  UNKNOWN: 0,  NA: 13 },
    'fixtures/good-routine.md':   { kind: 'prompt',  FAIL: 0, PASS: 11, UNKNOWN: 1,  NA: 2 },
  },
};

let failures = [];
const fail = m => failures.push(m);

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error('GATE FAIL: no <script> block in index.html'); process.exit(1); }

const noop = () => {};
const el = {
  value: '', innerHTML: '', textContent: '', style: {}, dataset: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, appendChild: noop, setAttribute: noop, focus: noop,
};
const sandbox = {
  document: {
    getElementById: () => el, querySelector: () => el, querySelectorAll: () => [],
    addEventListener: noop, body: el, createElement: () => el,
  },
  console, setTimeout, clearTimeout,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

try {
  vm.runInContext(scripts.join('\n') + '\n;globalThis.__C=C;globalThis.__ev=evaluate;globalThis.__det=detect;', sandbox);
} catch (e) {
  console.error('GATE FAIL: engine did not load — ' + e.message);
  process.exit(1);
}

const C = sandbox.__C, evaluate = sandbox.__ev, detect = sandbox.__det;
for (const [name, fn] of [['C', C], ['evaluate', evaluate], ['detect', detect]]) {
  if (!fn) { console.error('GATE FAIL: ' + name + ' not reachable after load'); process.exit(1); }
}

if (C.length !== EXPECTED.checkCount) fail(`check count ${C.length}, expected ${EXPECTED.checkCount}`);

const ids = C.map(c => c.n);
if (new Set(ids).size !== ids.length) fail('duplicate check ids: ' + ids.join(','));

const dead = C.filter(c => (!c.defect || !c.defect.length) && c.n !== 10).map(c => c.n).sort((a, b) => a - b);
if (dead.join(',') !== EXPECTED.cannotEverFail.join(',')) {
  fail(`checks unable to report a defect: [${dead}], expected [${EXPECTED.cannotEverFail}]`);
}

for (const [rel, exp] of Object.entries(EXPECTED.files)) {
  const file = path.join(__dirname, rel);
  if (!fs.existsSync(file)) { fail(`${rel} missing`); continue; }
  const txt = fs.readFileSync(file, 'utf8');
  const kind = detect(txt);
  if (kind !== exp.kind) fail(`${rel} kind=${kind}, expected ${exp.kind}`);
  const rows = evaluate(txt, kind);
  for (const st of ['FAIL', 'PASS', 'UNKNOWN', 'NA']) {
    const got = rows.filter(r => r.st === st).length;
    if (got !== exp[st]) fail(`${rel} ${st}=${got}, expected ${exp[st]}`);
  }
}

// Templates are documentation, not routines. They are EXPECTED to emit defect
// signals: a remediation doc quotes the anti-pattern to teach it. Reported for
// visibility only — never asserted, and never a reason to edit a template.
const tdir = path.join(__dirname, 'templates');
if (fs.existsSync(tdir)) {
  console.log('templates (informational — defect signals here are expected):');
  for (const f of fs.readdirSync(tdir).filter(x => x.endsWith('.md'))) {
    const txt = fs.readFileSync(path.join(tdir, f), 'utf8');
    const rows = evaluate(txt, detect(txt));
    const n = rows.filter(r => r.st === 'FAIL').length;
    console.log(`  ${f.padEnd(30)} ${n} defect signal(s)`);
  }
}

if (process.argv.includes('--update')) {
  console.log('\n--update: capture current behaviour by hand into EXPECTED, then re-run.');
  process.exit(1);
}

if (failures.length) {
  console.error('\nGATE FAIL (' + failures.length + '):');
  failures.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('\nGATE PASS — behaviour unchanged. This is NOT a correctness claim.');
process.exit(0);
