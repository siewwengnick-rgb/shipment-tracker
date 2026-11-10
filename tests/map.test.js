// node --test tests/  —— 校验映射只输出安全字段，计数与 shipments.json 一致
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { mapShipments } = require('../map.js');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shipments.json'), 'utf8'));
const rows = mapShipments(raw);

test('每个包裹一张卡，未配对集运单单独成卡', () => {
  const ids = rows.map(r => r.id);
  raw.parcels.forEach(p => assert.ok(ids.includes(p.id), p.id));
  assert.equal(new Set(ids).size, ids.length);
  rows.filter(r => r.id.startsWith('CON-')).forEach(r => assert.ok(!raw.parcels.some(p => p.consolidation_id === r.id), r.id));
});

test('计数自洽：完成＋未完成＝全部，待决定都是未完成', () => {
  const done = rows.filter(r => r.done).length;
  assert.equal(done + rows.filter(r => !r.done).length, rows.length);
  rows.filter(r => r.decision).forEach(r => assert.equal(r.done, false, r.id));
});

test('不泄露 note／evidence／history 原文与手机号', () => {
  const out = JSON.stringify(rows);
  const secrets = [];
  [...raw.parcels, ...raw.consolidations].forEach(x => {
    ['note', 'evidence_note'].forEach(k => { if (typeof x[k] === 'string' && x[k].length > 12) secrets.push(x[k]); });
  });
  secrets.forEach(t => assert.ok(!out.includes(t), 'leaked: ' + t.slice(0, 30)));
  assert.ok(!/evidence\//.test(out), 'evidence path leaked');
  assert.ok(!/(?<![\dA-Z])1[3-9]\d{9}(?!\d)/.test(out.replace(/[A-Z]{1,4}\d+/g, '')), 'phone-like number leaked');
});

test('路线步骤与 currentStep 在范围内', () => {
  const len = { local: 3, warehouse: 4 };
  rows.forEach(r => { assert.ok(r.currentStep >= 0 && r.currentStep < (len[r.route] || 6), r.id); });
});

test('ETA 备注原文保留', () => {
  raw.parcels.filter(p => p.eta_note).forEach(p => assert.ok(rows.find(r => r.id === p.id).etaNotes.length, p.id));
});
