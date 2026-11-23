// node --test tests/*.test.js
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const Sla = require('../sla.js');
const { mapShipments } = require('../map.js');
const rules = Sla.loadRules();
const NOW = '2026-11-23T15:30:00+08:00';

function row(partial) {
  const raw = {
    parcels: [Object.assign({
      id: 'PKG-X', item: '测试货', supplier: '测试厂', stage: '已到马',
      last_event: '2026-11-18 23:05 到港', mode: 'sea',
      step_dates: { warehouse: '2026-10-27T23:13:42+08:00', transit: '2026-11-13T14:05:57+08:00', arrived: '2026-11-18T23:05:37+08:00' }
    }, partial.parcel || {})],
    consolidations: partial.cons ? [partial.cons] : []
  };
  if (partial.parcel && partial.parcel.consolidation_id && !raw.consolidations.length) {
    raw.consolidations = [{ id: partial.parcel.consolidation_id, mode: 'sea', stage: partial.parcel.stage || '已到马', last_event: partial.parcel.last_event, step_dates: partial.parcel.step_dates }];
  }
  return mapShipments(raw, { now: NOW, rules })[0];
}

test('有时刻显示到分钟，只有日期或 00:00 只显示日期', () => {
  assert.equal(Sla.formatStepWhen('2026-11-18T23:05:37+08:00'), '11-18 23:05');
  assert.equal(Sla.formatStepWhen('2026-11-18 23:05'), '11-18 23:05');
  assert.equal(Sla.formatStepWhen('2026-11-18'), '11-18');
  assert.equal(Sla.formatStepWhen('2026-11-19T00:00:00+08:00'), '11-19');
});

test('当前步写已卡 X 天，已过的步写停留 X 天，超时为红', () => {
  const r = row({ parcel: { consolidation_id: 'CON-X' } });
  const arrived = r.stepsMeta.find(s => s.label === '到港清关');
  const transit = r.stepsMeta.find(s => s.label === '海运');
  const wh = r.stepsMeta.find(s => s.label === '集运仓');
  assert.equal(arrived.isCurrent, true);
  assert.equal(arrived.dwellLabel, '已卡 5 天');
  assert.equal(arrived.whenLabel, '11-18 23:05');
  assert.equal(arrived.tone, 'red');
  assert.equal(arrived.dwell, 5);
  assert.equal(transit.dwellLabel, '停留 5 天');
  assert.equal(wh.dwellLabel, '停留 17 天');
  assert.equal(wh.tone, 'red');
});

test('未达时限一半为青，一半到时限为黄，超过为红；日期待确认是灰且不猜', () => {
  assert.equal(Sla.toneFor(2, 7, rules), 'cyan');   // 2/7 < 0.5
  assert.equal(Sla.toneFor(4, 7, rules), 'yellow'); // 4/7 ≈ 0.57
  assert.equal(Sla.toneFor(7, 7, rules), 'yellow'); // 100% 仍是黄
  assert.equal(Sla.toneFor(8, 7, rules), 'red');
  const r = row({ parcel: { step_dates: { arrived: '2026-11-18T23:05:37+08:00' }, last_event: '2026-11-18 23:05 到港', consolidation_id: 'CON-X' } });
  const factory = r.stepsMeta.find(s => s.label === '厂家');
  assert.equal(factory.whenLabel, '日期待确认');
  assert.equal(factory.tone, 'gray');
  assert.ok(!factory.at);
});

test('卡片排序：红、黄、青，已签收最后；同色按已卡天数从多到少', () => {
  const raw = {
    parcels: [
      { id: 'PKG-DONE', item: '已签收货', supplier: '厂', stage: '已签收', last_event: '2026-11-21 已签收', step_dates: { delivered: '2026-11-21' } },
      { id: 'PKG-CYAN', item: '青色货', supplier: '厂', stage: '运往马来西亚', last_event: '2026-11-22 正在中转至目的地', mode: 'air',
        eta: '2026-11-24', step_dates: { transit: '2026-11-22T06:10:00+08:00' }, consolidation_id: 'CON-CYAN' },
      { id: 'PKG-RED-LONG', item: '红长', supplier: '厂', stage: '未查到', last_event: '未查到轨迹', step_dates: { factory: '2026-10-20' } },
      { id: 'PKG-RED-SHORT', item: '红短', supplier: '厂', stage: '已到马', last_event: '2026-11-18 23:05 到港',
        step_dates: { arrived: '2026-11-18T23:05:37+08:00' }, consolidation_id: 'CON-RED' },
      { id: 'PKG-YELLOW', item: '黄货', supplier: '厂', stage: '已入仓', last_event: '2026-11-19 货物已入仓',
        hint: '海运', step_dates: { warehouse: '2026-11-19T10:00:00+08:00' } }
    ],
    consolidations: [
      { id: 'CON-CYAN', mode: 'air', stage: '运往马来西亚', tracking_no: 'x', last_event: '2026-11-22 正在中转至目的地', eta: '2026-11-24', step_dates: { transit: '2026-11-22T06:10:00+08:00' } },
      { id: 'CON-RED', mode: 'sea', stage: '已到马', tracking_no: 'y', last_event: '2026-11-18 23:05 到港', step_dates: { arrived: '2026-11-18T23:05:37+08:00' } }
    ]
  };
  const rows = mapShipments(raw, { now: NOW, rules }).sort(Sla.compareCards);
  const ids = rows.map(r => r.id);
  assert.deepEqual(ids, ['PKG-RED-LONG', 'PKG-RED-SHORT', 'PKG-YELLOW', 'PKG-CYAN', 'PKG-DONE']);
  const tones = rows.map(r => Sla.sortTone(r));
  assert.deepEqual(tones, ['red', 'red', 'yellow', 'cyan', 'done']);
  const long = rows[0].stepsMeta.find(s => s.isCurrent);
  const short = rows[1].stepsMeta.find(s => s.isCurrent);
  assert.ok(long.dwell > short.dwell);
  assert.equal(long.dwellLabel, '已卡 34 天');
  assert.equal(short.dwellLabel, '已卡 5 天');
});

test('已签收的票不显示已卡，且排在最后', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shipments.json'), 'utf8'));
  const rows = mapShipments(raw, { now: NOW, rules }).sort(Sla.compareCards);
  const signed = rows.filter(r => r.done || r.stage === '已签收');
  assert.ok(signed.length > 0);
  signed.forEach(r => {
    assert.equal(r.sla.skipped, true);
    assert.equal(r.sla.display, '');
    const cur = (r.stepsMeta || []).find(s => s.isCurrent);
    if (cur) assert.notEqual(cur.dwellLabel, undefined);
    if (cur && cur.dwellLabel) assert.ok(!String(cur.dwellLabel).startsWith('已卡'), r.id + ' ' + cur.dwellLabel);
  });
  const lastOpen = rows.map((r, i) => [i, r.done]).filter(x => !x[1]).pop();
  const firstDone = rows.findIndex(r => r.done);
  if (lastOpen && firstDone >= 0) assert.ok(firstDone > lastOpen[0]);
  const sofa = rows.find(r => r.id === 'PKG-017');
  const bag = rows.find(r => r.id === 'PKG-016');
  if (sofa) { assert.equal(sofa.stage, '已签收'); assert.equal(sofa.done, true); }
  if (bag) { assert.equal(bag.stage, '已签收'); assert.equal(bag.done, true); }
});

test('空运过 ETA 1 天算超时，海运 ETA 当天不算超时', () => {
  const air = Sla.evaluate({
    stage: '运往马来西亚', mode: 'air', done: false,
    stageSince: '2026-11-18T06:10:00+08:00',
    lastEvent: '2026-11-21T23:50:00+08:00 预计航班到达时间'
  }, NOW, rules);
  assert.equal(air.overdue, true);
  assert.equal(air.days, 5);
  assert.equal(air.eta, '2026-11-21');
  const sea = Sla.evaluate({
    stage: '运往马来西亚', mode: 'sea', done: false,
    stageSince: '2026-11-19T10:24:00+08:00',
    eta: '2026-11-23（yd 预计到港）'
  }, NOW, rules);
  assert.equal(sea.overdue, false);
  assert.equal(sea.days, 4);
  assert.equal(sea.display, '本阶段第 4 天');
});
