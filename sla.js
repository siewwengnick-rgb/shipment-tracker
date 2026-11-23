/* 阶段超时：阈值只来自 sla_rules.json，纯函数，不写电话或地址。 */
(function (root) {
  function loadRules() {
    if (typeof require === 'function') {
      const fs = require('fs'), path = require('path');
      return JSON.parse(fs.readFileSync(path.join(__dirname, 'sla_rules.json'), 'utf8'));
    }
    return root.SLA_RULES || null;
  }

  function parseInstant(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(+v) ? null : v;
    const s = String(v).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      const t = `${m[1]}-${m[2]}-${m[3]}T${m[4] || '00'}:${m[5] || '00'}:${m[6] || '00'}${/[+-]\d{2}:\d{2}|Z$/.test(s) ? '' : '+08:00'}`;
      const withTz = /[+-]\d{2}:\d{2}|Z$/.test(s) ? (s.replace(' ', 'T')) : t;
      const d = new Date(withTz.length === 19 || withTz.indexOf('+') === -1 && withTz.indexOf('Z') === -1 ? t : (s.match(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/) ? (s.includes('T') || s.includes(' ') ? (s.replace(' ', 'T').match(/[Zz]|[+-]\d{2}:\d{2}$/) ? s.replace(' ', 'T') : s.replace(' ', 'T') + '+08:00') : t) : t));
      return isNaN(+d) ? null : d;
    }
    const md = s.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (md) return null; // 缺年，不猜
    return null;
  }

  function mytDate(v, tzHours) {
    const d = parseInstant(v);
    if (!d) {
      const s = String(v || '');
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : null;
    }
    const shifted = new Date(d.getTime() + (tzHours == null ? 8 : tzHours) * 3600e3);
    return shifted.toISOString().slice(0, 10);
  }

  function daysBetween(from, to, tzHours) {
    const a = mytDate(from, tzHours), b = mytDate(to, tzHours);
    if (!a || !b) return null;
    return Math.round((Date.parse(b + 'T00:00:00+08:00') - Date.parse(a + 'T00:00:00+08:00')) / 86400000);
  }

  function hasKw(text, words) {
    const t = String(text || '');
    return (words || []).some(w => {
      if (w === '到港') return /(?<!预计)(?<!预计\d{0,4}[-/月]?\d{0,2}[-/]?\d{0,2})到港/.test(t) && !/预计[^。；;]*到港/.test(t) ? /到港/.test(t.replace(/预计[^。；;\n]*到港/g, '')) : (!/预计/.test(t) && /到港/.test(t)) || /实际[^。]*到港|已到港|23:05 到港|到港$/.test(t);
      return t.includes(w);
    });
  }

  function isArrivedPortText(text) {
    const t = String(text || '');
    const stripped = t.replace(/预计[^。；;\n]*到港/g, '');
    return /到港/.test(stripped);
  }

  function matchKw(text, words, key) {
    if (key === 'arrived_port') return isArrivedPortText(text);
    return hasKw(text, words);
  }

  function modeOf(input) {
    const m = input.mode;
    if (m === 'air' || m === '空运') return 'air';
    if (m === 'sea' || m === '海运') return 'sea';
    const route = input.route || '';
    if (route === 'air') return 'air';
    if (route === 'sea' || route === 'seaPlan' || route === 'seaProposed') return 'sea';
    const hint = String(input.hint || '');
    if (/空运/.test(hint) && !/海运/.test(hint)) return 'air';
    if (/海运/.test(hint)) return 'sea';
    return '';
  }

  function extractEta(input) {
    const fields = [input.eta, input.etaNote].filter(Boolean).map(String);
    for (const s of fields) {
      if (/已到港|实际.*到港/.test(s) && !/预计/.test(s.slice(0, 12))) {
        // "yd 原预计 10-28；实际 10/29 到港" 不是未到的 ETA
        if (/^yd /i.test(s) || /实际/.test(s) || /已到港/.test(s)) continue;
      }
      if (/已到港/.test(s) && /^\d{4}-\d{2}-\d{2}/.test(s)) continue;
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m && !/已到港/.test(s)) return m[1];
    }
    if (input.trackingEta) {
      const d = mytDate(input.trackingEta);
      if (d) return d;
    }
    const hits = [];
    (input.history || []).forEach(ev => {
      if (/预计航班到达时间/.test(ev.description || ev.text || '')) {
        const d = mytDate(ev.time);
        if (d) hits.push(d);
      }
    });
    if (hits.length) { hits.sort(); return hits[hits.length - 1]; }
    const last = String(input.lastEvent || '');
    if (/预计航班到达时间/.test(last)) {
      const d = mytDate(last);
      if (d) return d;
    }
    return null;
  }

  function slaKey(stage, lastEvent, status, rules) {
    if (!stage || (rules.skipped_stages || []).includes(stage)) return null;
    if ((rules.factory_stages || []).includes(stage)) return 'factory';
    if ((rules.domestic_stages || []).includes(stage)) return 'domestic';
    if ((rules.inbound_stages || []).includes(stage)) return 'inbound';
    if ((rules.to_my_stages || []).includes(stage)) return 'to_my';
    if ((rules.arrived_stages || []).includes(stage)) {
      const text = [status, lastEvent].filter(Boolean).join(' ');
      if (matchKw(text, rules.keywords.delivering, 'delivering') || /派送中/.test(String(status || ''))) return 'delivering';
      if (matchKw(text, rules.keywords.cleared, 'cleared')) return 'cleared';
      return 'arrived_port';
    }
    return null;
  }

  function refineChase(key, input, rules) {
    const base = (rules.chase && rules.chase[key]) || '';
    if (key === 'inbound' || key === 'to_my') {
      const fwd = String(input.forwarder || '');
      if (/零零九/.test(fwd)) return '零零九（先翻微信历史）';
      if (/云第|yd-wl|yd/i.test(fwd)) return '钟（CC 群）';
    }
    return base;
  }

  function limitFor(key, input, rules, eta) {
    const mode = modeOf(input);
    if (key === 'factory') {
      return input.promisedShipDate
        ? rules.factory.limit_days_after_promise
        : rules.factory.limit_days_after_order;
    }
    if (key === 'domestic') return rules.domestic.limit_days;
    if (key === 'inbound') return mode === 'air' ? rules.inbound.limit_days_air : rules.inbound.limit_days_sea;
    if (key === 'to_my') {
      if (eta) return mode === 'air' ? rules.to_my.limit_days_past_eta_air : rules.to_my.limit_days_past_eta_sea;
      return mode === 'air' ? rules.to_my.limit_days_no_eta_air : rules.to_my.limit_days_no_eta_sea;
    }
    if (key === 'arrived_port') return rules.arrived_port.limit_days;
    if (key === 'cleared') return rules.cleared.limit_days;
    if (key === 'delivering') return rules.delivering.limit_days;
    return null;
  }

  function evaluate(input, now, rules) {
    rules = rules || loadRules();
    const tz = rules.tz_offset_hours;
    const skipped = !!(input.done || input.route === 'local' || (rules.skipped_stages || []).includes(input.stage));
    if (skipped) {
      return { skipped: true, overdue: false, days: null, limitDays: null, key: null, label: '', chase: '', since: null, sinceKnown: false, display: '' };
    }
    const key = slaKey(input.stage, input.lastEvent, input.status, rules);
    if (!key) {
      return { skipped: true, overdue: false, days: null, limitDays: null, key: null, label: '', chase: '', since: null, sinceKnown: false, display: '' };
    }
    const since = input.stageSince || null;
    const sinceKnown = !!mytDate(since, tz);
    const eta = key === 'to_my' ? extractEta(input) : null;
    const limitDays = limitFor(key, input, rules, eta);
    const days = sinceKnown ? daysBetween(since, now, tz) : null;
    let anchorDays = days;
    if (key === 'factory' && input.promisedShipDate) {
      anchorDays = daysBetween(input.promisedShipDate, now, tz);
    } else if (key === 'to_my' && eta) {
      anchorDays = daysBetween(eta, now, tz);
    }
    const overdue = anchorDays != null && limitDays != null && anchorDays >= limitDays;
    let display = '';
    if (overdue && days != null) display = '卡住 ' + days + ' 天';
    else if (overdue && days == null) display = '已超时';
    else if (days != null) display = '本阶段第 ' + days + ' 天';
    else display = '起始日期待确认';
    return {
      skipped: false,
      overdue,
      days,
      limitDays,
      key,
      label: (rules.labels && rules.labels[key]) || key,
      chase: refineChase(key, input, rules),
      since: sinceKnown ? (mytDate(since, tz)) : null,
      sinceKnown,
      display,
      eta
    };
  }

  function compareCards(a, b) {
    const rank = { red: 0, yellow: 1, cyan: 2, gray: 3, done: 4 };
    const ra = rank[sortTone(a)] != null ? rank[sortTone(a)] : 3;
    const rb = rank[sortTone(b)] != null ? rank[sortTone(b)] : 3;
    if (ra !== rb) return ra - rb;
    const da = ((a.stepsMeta || []).find(s => s.isCurrent) || {}).dwell;
    const db = ((b.stepsMeta || []).find(s => s.isCurrent) || {}).dwell;
    const na = da == null ? -1 : da, nb = db == null ? -1 : db;
    if (nb !== na) return nb - na;
    return String(a.id || '').localeCompare(String(b.id || ''));
  }

  function inferSinceFromEvents(events, key, rules) {
    const words = (rules.keywords && (key === 'to_my' ? [] : rules.keywords[key])) || [];
    let extra = words;
    if (key === 'to_my') extra = [].concat(rules.keywords.departed_sea || [], rules.keywords.departed_air || []);
    if (key === 'factory') return null;
    const hits = [];
    for (const ev of events || []) {
      const text = [ev.description, ev.location, ev.time].filter(Boolean).join(' ');
      if (key === 'arrived_port' ? isArrivedPortText(ev.description || ev.text || '') : hasKw(ev.description || ev.text || text, extra)) {
        if (ev.time && mytDate(ev.time)) hits.push(ev.time);
      }
    }
    if (!hits.length) return null;
    hits.sort((a, b) => String(a).localeCompare(String(b)));
    return hits[0];
  }

  const TONE_RANK = { red: 0, yellow: 1, cyan: 2, gray: 3, done: 4 };

  function routeSteps(route, domesticLabel) {
    if (route === 'local') return ['厂家', '国内配送', '酒店自取'];
    if (route === 'warehouse') return ['厂家', domesticLabel || '国内快递', '集运仓', '方式待定'];
    const air = route === 'air';
    return ['厂家', domesticLabel || '国内快递', '集运仓', air ? '空运' : '海运', air ? '到马派送' : '到港清关', air ? '签收' : '派送签收'];
  }

  function labelKey(label) {
    return ({
      '厂家': 'factory', '国内配送': 'domestic', '国内快递': 'domestic', '国内送仓': 'domestic',
      '集运仓': 'warehouse', '空运': 'transit', '海运': 'transit',
      '到马派送': 'arrived', '到港清关': 'arrived',
      '签收': 'delivered', '派送签收': 'delivered', '酒店自取': 'delivered',
      '方式待定': 'pending'
    })[label] || null;
  }

  function formatStepWhen(v, tzHours) {
    const day = mytDate(v, tzHours);
    if (!day) return null;
    const md = day.slice(5, 7) + '-' + day.slice(8, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim())) return md;
    const inst = parseInstant(v);
    if (!inst) return md;
    const shifted = new Date(inst.getTime() + (tzHours == null ? 8 : tzHours) * 3600e3);
    const hh = shifted.toISOString().slice(11, 13), mm = shifted.toISOString().slice(14, 16);
    if (hh === '00' && mm === '00') return md;
    return md + ' ' + hh + ':' + mm;
  }

  function toneFor(dwell, limit, rules) {
    if (dwell == null || limit == null || limit <= 0) return 'gray';
    const red = (rules.tones && rules.tones.red_above) || 1;
    const cyan = (rules.tones && rules.tones.cyan_below) || 0.5;
    const r = dwell / limit;
    if (r > red) return 'red';
    if (r >= cyan) return 'yellow';
    return 'cyan';
  }

  function stepLimit(key, input, rules, start) {
    const mode = modeOf(input);
    if (key === 'factory') return input.promisedShipDate ? rules.factory.limit_days_after_promise : rules.factory.limit_days_after_order;
    if (key === 'domestic') return rules.domestic.limit_days;
    if (key === 'warehouse') return mode === 'air' ? rules.inbound.limit_days_air : rules.inbound.limit_days_sea;
    if (key === 'transit') {
      const eta = extractEta(input);
      if (eta && start) {
        const planned = daysBetween(start, eta, rules.tz_offset_hours);
        const grace = mode === 'air' ? rules.to_my.limit_days_past_eta_air : rules.to_my.limit_days_past_eta_sea;
        return Math.max(0, planned == null ? 0 : planned) + grace;
      }
      return mode === 'air' ? rules.to_my.limit_days_no_eta_air : rules.to_my.limit_days_no_eta_sea;
    }
    if (key === 'arrived') return rules.arrived_port.limit_days;
    if (key === 'delivered') return rules.delivering.limit_days;
    return null;
  }

  function decorateSteps(input, now, rules) {
    rules = rules || loadRules();
    const tz = rules.tz_offset_hours;
    const labels = input.stepLabels || routeSteps(input.route, input.domesticLabel);
    const n = input.currentStep;
    const dates = input.stepDates || {};
    const raw = labels.map((label, i) => {
      const key = labelKey(label);
      return { key, label, i, isFuture: i > n, isCurrent: i === n, isPast: i < n, at: (key && dates[key]) || null };
    });
    return raw.map((s, i) => {
      if (s.isFuture) return Object.assign({ dwell: null, dwellLabel: '', whenLabel: '', tone: '' }, s);
      if (!s.at) return Object.assign({ dwell: null, dwellLabel: '', whenLabel: '日期待确认', tone: 'gray' }, s);
      let end = null;
      for (let j = i + 1; j < raw.length; j++) { if (raw[j].at) { end = raw[j].at; break; } }
      const canDwell = end || s.isCurrent;
      const dwell = canDwell ? daysBetween(s.at, s.isCurrent ? now : end, tz) : null;
      const limit = stepLimit(s.key, input, rules, s.at);
      const tone = (input.done && s.isCurrent) ? 'teal' : dwell == null ? 'gray' : toneFor(dwell, limit, rules);
      let dwellLabel = '';
      if (dwell == null) dwellLabel = '停留待确认';
      else if (input.done && s.isCurrent) dwellLabel = '完成';
      else if (s.isCurrent) dwellLabel = '已卡 ' + dwell + ' 天';
      else dwellLabel = '停留 ' + dwell + ' 天';
      return Object.assign({ dwell, dwellLabel, whenLabel: formatStepWhen(s.at, tz), tone, limit }, s);
    });
  }

  function sortTone(row) {
    if (row.done) return 'done';
    const cur = (row.stepsMeta || []).find(s => s.isCurrent);
    return (cur && cur.tone) || 'gray';
  }

  function skipEvent(desc) {
    const t = String(desc || '');
    return /^(线索|微信跟进翻查|台账核对)/.test(t) || /推断线索/.test(t) || /预计航班到达时间/.test(t);
  }

  function classifyEvent(ev, rules) {
    const desc = ev.description || ev.text || '';
    if (skipEvent(desc)) return null;
    const kws = rules.step_keywords || {};
    const order = ['delivered', 'arrived', 'transit', 'warehouse', 'domestic', 'factory'];
    for (let i = 0; i < order.length; i++) {
      const key = order[i];
      if (key === 'arrived') {
        if (isArrivedPortText(desc) || hasKw(desc, kws.arrived)) return 'arrived';
        continue;
      }
      if (hasKw(desc, kws[key] || [])) return key;
    }
    return null;
  }

  function inferStepDates(objs, rules) {
    rules = rules || loadRules();
    const events = [];
    (objs || []).forEach(o => {
      if (!o) return;
      (o.history || []).forEach(h => events.push(h));
      const last = o.last_event || o.lastEvent;
      if (last) {
        const m = String(last).match(/^(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z)?)?)/);
        events.push({ time: m ? m[1] : last, description: String(last) });
      }
    });
    events.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    const dates = {};
    function hasClock(v) { return /[T ]\d{2}:\d{2}/.test(String(v || '')) && !/[T ]00:00/.test(String(v)); }
    events.forEach(ev => {
      const key = classifyEvent(ev, rules);
      if (!(key && ev.time && mytDate(ev.time))) return;
      const prev = dates[key];
      if (!prev) { dates[key] = ev.time; return; }
      if (mytDate(prev) === mytDate(ev.time) && !hasClock(prev) && hasClock(ev.time)) dates[key] = ev.time;
    });
    return dates;
  }

  function mergeStepDates(list) {
    const out = {};
    (list || []).forEach(sd => {
      if (!sd) return;
      Object.keys(sd).forEach(k => {
        const v = sd[k];
        if (!v) return;
        if (!out[k] || String(v).localeCompare(String(out[k])) < 0) out[k] = v;
      });
    });
    return out;
  }

  const api = { loadRules, parseInstant, mytDate, daysBetween, evaluate, compareCards, slaKey, extractEta, inferSinceFromEvents, modeOf, routeSteps, labelKey, formatStepWhen, toneFor, decorateSteps, sortTone, inferStepDates, classifyEvent, mergeStepDates };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ShipSla = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
