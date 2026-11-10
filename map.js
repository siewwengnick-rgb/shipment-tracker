/* 把 shipments.json（schema v3）映射成页面卡片。只取安全展示字段：不读 note／evidence／history，电话号码一律隐去。 */
(function (root) {
  const PHONE = /\+?\d[\d\- ]{6,}\d/g;
  const LATER = ['运往马来西亚', '已到马', '已签收'];
  // 长品名的展示简写：只在原品名未变时生效，原名仍在详情和搜索里。
  const LABELS = {
    'PKG-015': { item: '一滴香/香薰（花艺香薰等；香语生物；无酒精；约6件）', title: '一滴香 / 香薰', spec: '6件 · 无酒精' },
    'PKG-016': { item: 'Ot环保袋 / ORTHOTECH覆膜袋33*33*10（10000个）', title: 'ORTHOTECH 覆膜袋', spec: '10,000个 · 33×33×10' },
    'PKG-017': { item: '沙发 / Klang New Shop Sofa', title: '沙发', spec: 'Klang New Shop · 2件', supplierShort: '厂家待确认' },
    'PKG-021': { item: '淘宝发光字招牌门头定制广告（不锈钢）×14', title: '发光字招牌', spec: '不锈钢 · 14件' }
  };
  const s = v => (v === null || v === undefined || v === '') ? '' : String(v);
  const tbc = v => s(v) || '待确认';
  // 只隐去像手机号的数字（中国 1xx 11 位、马来 +60/01x）；单号、入仓号保持原样
  const isPhone = m => { const n = m.replace(/\D/g, ''); return /^1[3-9]\d{9}$/.test(n) || /^(60|0)1\d{7,9}$/.test(n); };
  const scrub = v => s(v).replace(PHONE, m => isPhone(m) ? '[已隐去]' : m);
  const text = v => scrub(v).replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(\.\d+)?([+-]\d{2}:\d{2}|Z)?/g, '$1 $2');
  const date10 = v => (s(v).match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
  const shortName = v => { const t = s(v); return /待确认/.test(t) ? t : (t.replace(/（[^）]*）\s*$/, '').trim() || t); };
  const has = (c, k) => c && !Array.isArray(c) && c[k] === '待确认';

  function consDetail(c) {
    return { id: c.id, carrier: tbc(c.carrier === '待查' ? '' : c.carrier), tracking: tbc(c.tracking_no), vessel: tbc(c.vessel), weight: tbc(c.weight), ctns: tbc(c.ctns) };
  }

  function routeFor(p, cons, linked) {
    if (p.stage === '已完成（中国本地自取）' || p.forwarder === '中国本地自取') return 'local';
    if (cons && cons.mode === 'air') return 'air';
    if (cons && cons.mode === 'sea' && LATER.includes(cons.stage)) return 'sea';
    const hint = s(p.hint), cf = p.confirm;
    if (has(cf, 'mode') || has(cf, 'shipping_mode')) return 'warehouse';
    if (/海运/.test(hint) && /拟/.test(hint + s(p.last_event))) return 'seaProposed';
    if (/海运/.test(hint) || linked.some(c => c.mode === 'sea')) return 'seaPlan';
    return 'warehouse';
  }

  function parcel(p, d) {
    const C = d.consolidations || [];
    const cons = C.find(c => c.id === p.consolidation_id) || null;
    const extra = C.filter(c => c !== cons && ((c.parcels || []).includes(p.id) || (c.parcel_ids || []).includes(p.id)));
    const linked = [cons, ...extra].filter(Boolean);
    const route = routeFor(p, cons, linked);
    const cf = p.confirm;
    const inherit = cons && LATER.includes(cons.stage);
    const stage = inherit ? cons.stage : p.stage;
    const carrier = s(p.domestic_carrier) || s(p.carrier);
    const sendByCar = /货拉拉|叫车/.test(carrier);
    const etaNotes = [p.eta_note, cons && cons.eta_note].map(text).filter(Boolean);
    const unverified = stage === '已到马' && !etaNotes.length ? false : stage === '已到马' && etaNotes.some(t => /无到港或签收/.test(t));
    let step, status, done = false;
    if (route === 'local') { step = 2; status = '已完成'; done = true; }
    else if (stage === '已签收') { step = 5; status = '已签收'; done = true; }
    else if (unverified) { step = 3; status = '进度待复核'; }
    else if (stage === '已到马') { step = 4; status = '已到马'; }
    else if (stage === '运往马来西亚') { step = 3; status = '运往马来西亚'; }
    else if (stage === '已入仓') { step = 2; status = '已到仓'; }
    else if (stage === '国内运输中') { step = 1; status = '国内运输中'; }
    else if (stage === '无单号') { step = sendByCar ? 1 : 0; status = sendByCar ? '叫车送仓 · 到仓未确认' : '待补国内单号'; }
    else if (stage === '未查到') { step = 0; status = '轨迹待确认'; }
    else { step = 0; status = tbc(stage); }

    let dest = s(p.destination_city) || (cons && (s(cons.destination_city) || s(cons.destination))) || '';
    let destInferred = false;
    if (!dest) { const e = extra.find(c => c.destination_city || c.destination); if (e) { dest = s(e.destination_city) || s(e.destination); destInferred = true; } }
    if (route === 'local') dest = '中国酒店自取';
    else if (has(cf, 'destination')) dest = dest ? dest + '（待确认）' : '待决定';
    else if (destInferred) dest += '（关联单推断，待核）';
    else if (!dest && stage === '无单号' && p.destination_warehouse) dest = p.destination_warehouse + '（送仓；到仓未确认）';
    dest = dest || '待确认';

    const decision = has(cf, 'destination');
    const decisionText = !decision ? '' : (has(cf, 'mode') || has(cf, 'price_quote')) ? '目的地、运输方式及报价待决定' : has(cf, 'ownership') ? '归属及目的地待决定' : '目的地待决定';
    const payment = Array.isArray(cf) ? cf.filter(x => /付/.test(x)) : [];

    const label = LABELS[p.id] && LABELS[p.id].item === p.item ? LABELS[p.id] : null;
    const item = tbc(p.item);
    let latest = text(inherit ? cons.last_event : p.last_event);
    if (stage === '未查到') latest = '轨迹待确认';
    const warnings = [];
    if (unverified) warnings.push('缺少到港或签收证据，原“已到马”状态不可确认。');
    if (stage === '无单号' && sendByCar) warnings.push('已叫车送仓，到仓尚未确认。');
    if (destInferred) warnings.push(`${dest.replace(/（.*$/, '')} 来自关联单 ${extra.map(c => c.id).join(' / ')}，关联与目的地仍待核。`);
    if (route === 'warehouse' && (has(cf, 'shipping_mode'))) warnings.push('出运方式待确认（' + text(p.hint).replace(/^.*?（|）$/g, '') + '）');
    const pending = [];
    if (linked.some(c => /重量不符/.test(s(c.item)))) pending.push('重量记录存在差异，待核实。');
    const sameBatch = cons ? (cons.parcel_ids || []).length : 0;
    let eta = done ? '' : date10(p.eta) || date10(cons && cons.eta);
    return {
      id: p.id, item, title: label ? label.title : item, spec: label ? label.spec : '',
      supplier: tbc(p.supplier), supplierShort: label && label.supplierShort || (has(cf, 'supplier') ? tbc(p.supplier) : shortName(tbc(p.supplier))), destination: dest,
      status, route, done, decision, decisionText, payment, eta, etaNotes, warnings, pending,
      batch: extra.length && !cons ? '' : cons ? cons.id + (extra.length ? ' / ' + extra.map(c => c.id).join(' / ') : '') : '',
      batchNote: sameBatch > 1 ? `${sameBatch} 件同批` : '',
      carrier: tbc(carrier.replace(/（待确认）$/, '')), tracking: s(p.domestic_tracking_no) || s(p.tracking) || '无 / 待确认',
      latest: latest || '暂无记录', currentStep: step, domesticLabel: sendByCar ? '国内送仓' : '国内快递',
      forwarder: tbc(p.forwarder), warehouseRef: tbc(p.warehouse_ref), weight: tbc(scrub(p.weight)), ctns: tbc(p.ctns),
      consDetails: linked.map(consDetail),
      ...(destInferred ? { batch: [cons, ...extra].filter(Boolean).map(c => c.id).join(' / ') + '（关联待核）' } : {})
    };
  }

  function orphan(c) {
    const signed = c.stage === '已签收';
    const step = signed ? 5 : c.stage === '已到马' ? 4 : c.stage === '运往马来西亚' ? 3 : 2;
    const item = tbc(s(c.item).replace('据群聊语境', '据语境'));
    return {
      id: c.id, item, title: item, spec: '', supplier: '待确认', supplierShort: '待确认',
      destination: tbc(s(c.destination_city) || s(c.destination)), status: signed ? '已签收 · 未配对' : c.stage + ' · 未配对',
      route: c.mode === 'air' ? 'air' : 'sea', done: signed, decision: false, decisionText: '', payment: [],
      eta: signed ? '' : date10(c.eta), etaNotes: [text(c.eta_note)].filter(Boolean),
      warnings: ['集运单尚未配对国内包裹' + (/语境/.test(item) ? '；品名据语境。' : '。')], pending: [],
      batch: c.id + ' · 未配对国内包裹', batchNote: '', carrier: tbc(c.carrier), tracking: tbc(c.tracking_no),
      latest: text(c.last_event) || '暂无记录', currentStep: step, domesticLabel: '国内快递',
      forwarder: tbc(c.forwarder), warehouseRef: '待确认', weight: '待确认', ctns: '待确认', consDetails: [consDetail(c)]
    };
  }

  function mapShipments(d) {
    const P = d.parcels || [], C = d.consolidations || [];
    const used = new Set();
    P.forEach(p => { if (p.consolidation_id) used.add(p.consolidation_id); });
    C.forEach(c => { if ((c.parcels || []).length || (c.parcel_ids || []).length) used.add(c.id); });
    return P.map(p => parcel(p, d)).concat(C.filter(c => !used.has(c.id)).map(orphan));
  }
  const api = { mapShipments };
  if (typeof module !== 'undefined') module.exports = api; else root.ShipMap = api;
})(this);
