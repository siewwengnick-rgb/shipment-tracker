(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = d => Number(d.slice(5, 7)) + '月' + Number(d.slice(8, 10)) + '日';
  const mytNow = () => new Date(Date.now() + 8 * 3600e3); // 以 UTC 字段读取即为 MYT
  const iso = d => d.toISOString().slice(0, 10);
  let data = [], filter = 'all', view = 'cards';

  function steps(x) {
    if (x.route === 'local') return ['厂家', '国内配送', '酒店自取'];
    if (x.route === 'warehouse') return ['厂家', x.domesticLabel, '集运仓', '方式待定'];
    const air = x.route === 'air';
    return ['厂家', x.domesticLabel, '集运仓', air ? '空运' : '海运', air ? '到马派送' : '到港清关', air ? '签收' : '派送签收'];
  }

  function header(raw) {
    const m = String(raw.updated || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
    $('#updated-text').textContent = m ? `更新于 ${md(m[0])} ${m[4]} MYT` : '更新时间未知';
    $('#side-updated').textContent = m ? `数据截至 ${m[1]}.${m[2]}.${m[3]} ${m[4]}` : '';
    const today = mytNow(), dow = (today.getUTCDay() + 6) % 7;
    const mon = new Date(today - dow * 864e5), sun = new Date(+mon + 6 * 864e5);
    const a = iso(mon), b = iso(sun), t = iso(today);
    const week = data.filter(x => !x.done && x.eta && x.eta >= a && x.eta <= b);
    $('#week-count').textContent = week.length + ' 件';
    $('#week-range').textContent = `${md(a)} – ${md(b)} · ${week.length ? '预计到港，非最终送达' : '暂无预计到港'}`;
    const open = data.filter(x => x.eta && !x.done).sort((p, q) => p.eta.localeCompare(q.eta));
    const next = open.find(x => x.eta >= t), overdue = open.filter(x => x.eta < t);
    $('#next-date').textContent = next ? md(next.eta) : '—';
    $('#next-note').textContent = overdue.length ? `${overdue.length} 件已过预计到港日（${md(overdue[0].eta)}），到港待更新` : '预计到港 · 非最终送达';
  }

  function card(x) {
    const route = steps(x), n = x.currentStep, eta = x.eta ? `${md(x.eta)} · 预计到港` : '日期待定';
    const plan = x.route === 'seaPlan' ? '海运计划 · 出运待核' : x.route === 'seaProposed' ? '拟海运 · 待决定' : '';
    const showId = /^待确认/.test(x.title);
    const warn = x.decision || x.status === '进度待复核';
    return `<article class="card"><div class="card-top"><div><h3>${esc(x.title)}${showId ? ` <small class="id">${esc(x.id)}</small>` : ''}</h3>${x.spec ? `<div class="spec">${esc(x.spec)}</div>` : ''}</div><span class="badge ${warn ? 'warn' : ''}">${x.decision ? '待决定' : x.done ? '已完成' : '追踪中'}</span></div>`
      + `<div class="meta">厂家　<strong>${esc(x.supplierShort)}</strong><span class="destination">寄往　<strong>${esc(x.destination)}</strong></span></div>`
      + `<div class="statusline"><strong>${esc(x.status)}</strong><span class="eta">${x.done ? '' : esc(eta)}</span></div>${plan ? `<div class="plan">${esc(plan)}</div>` : ''}`
      + `<div class="progress-steps" aria-label="路线进度">${route.map((s, i) => `<div class="progress-step ${i < n ? 'passed' : i === n ? 'current' : 'future'}"><i></i><span>${esc(s)}</span><small>${i < n ? '已过' : i === n ? (x.done ? '完成' : '当前') : '待到'}</small></div>`).join('')}</div>`
      + (x.batch ? `<div class="batch">关联批次　${esc(x.batch)}${x.batchNote ? ' · ' + esc(x.batchNote) : ''}</div>` : '')
      + x.warnings.map(w => `<div class="warning">${esc(w)}</div>`).join('')
      + x.payment.map(p => `<div class="batch">待核付款：${esc(p)}</div>`).join('')
      + `<details><summary>查看货件详情</summary><div class="detail-body"><p><b>原品名</b>　${esc(x.item)}<br><b>厂家原字段</b>　${esc(x.supplier)}<br><b>编号</b>　${esc(x.id)}<br><b>货代</b>　${esc(x.forwarder)}<br><b>国内承运 / 单号</b>　${esc(x.carrier)} / ${esc(x.tracking)}<br><b>入仓号</b>　${esc(x.warehouseRef)}<br><b>包裹重量 / 件数</b>　${esc(x.weight)} / ${esc(x.ctns)}</p>`
      + (x.consDetails.map(c => `<p><b>集运单 ${esc(c.id)}</b>　${esc(c.carrier)}<br><b>集运单号 / 船号</b>　${esc(c.tracking)} / ${esc(c.vessel)}<br><b>集运重量 / 件数</b>　${esc(c.weight)} / ${esc(c.ctns)}</p>`).join('') || '<p><b>集运单号 / 船号</b>　待确认</p>')
      + `<b>完整路线</b><ol class="route-list">${route.map((s, i) => `<li class="${i === n ? 'current' : ''}">${esc(s)}${i === n ? (x.done ? ' · 完成' : ' · 当前') : ''}</li>`).join('')}</ol>`
      + (x.etaNotes.length ? x.etaNotes.map(t => `<p><b>ETA 备注</b>　${esc(t)}</p>`).join('') : '<p><b>ETA 备注</b>　暂无记录</p>')
      + `<p><b>最近物流记录</b>　${esc(x.latest)}</p>`
      + x.pending.map(t => `<p><b>待补资料</b>　${esc(t)}</p>`).join('')
      + x.payment.map(p => `<p><b>待核付款</b>　${esc(p)}待核，并非新的支付请求。</p>`).join('')
      + (x.decision ? `<p><b>待决定</b>　${esc(x.decisionText)}</p>` : '')
      + `</div></details></article>`;
  }

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const items = data.filter(x => (filter === 'all' || filter === 'transit' && !x.done || filter === 'decision' && x.decision || filter === 'done' && x.done)
      && [x.item, x.title, x.spec, x.supplier, x.supplierShort, x.destination, x.id].some(v => String(v).toLowerCase().includes(q)))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.eta || '9999').localeCompare(b.eta || '9999') || a.id.localeCompare(b.id));
    let completed = false;
    $('#cards').innerHTML = items.map(x => { let h = ''; if (x.done && !completed) { completed = true; h = '<h3 class="completed-heading">已完成</h3>'; } return h + card(x); }).join('');
    $('#cards').className = 'cards ' + (view === 'list' ? 'list' : '');
    $('#empty').hidden = !!items.length;
    $('#result-count').textContent = items.length + ' 件';
    $('#heading').textContent = ({ all: '全部货件', transit: '在途与待处理', decision: '待决定', done: '已完成' })[filter];
    document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b.dataset.filter === filter); b.setAttribute('aria-pressed', String(b.dataset.filter === filter)); });
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === filter));
    document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  }

  function start(raw) {
    data = window.ShipMap.mapShipments(raw);
    const counts = { all: data.length, transit: data.filter(x => !x.done).length, decision: data.filter(x => x.decision).length, done: data.filter(x => x.done).length };
    Object.entries(counts).forEach(([k, v]) => $('#count-' + k).textContent = v);
    $('#summary-count').textContent = counts.decision;
    header(raw);
    $('#decision-list').innerHTML = data.filter(x => x.decision).map(x => `<div class="decision-item"><strong>${esc(x.title)}</strong><small>${esc(x.decisionText)}</small></div>`).join('')
      + data.filter(x => x.payment.length).map(x => `<div class="decision-item"><strong>待核付款 · ${esc(x.title)}</strong><small>${esc(x.payment.join('、'))}待核，并非新的支付请求。</small></div>`).join('');
    render();
  }

  document.querySelectorAll('[data-filter],[data-nav]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter || b.dataset.nav; render(); }));
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
  $('#search').addEventListener('input', render);
  $('#show-decisions').addEventListener('click', () => { filter = 'decision'; render(); $('.results').scrollIntoView({ behavior: 'smooth' }); });

  function load() {
    $('#cards').innerHTML = '<p class="loading">正在读取最新货件…</p>';
    const src = new URLSearchParams(location.search).get('data') || 'shipments.json';
    fetch(src + '?' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(start)
      .catch(() => { $('#cards').innerHTML = '<p class="loading">读取 shipments.json 失败。<button type="button" id="retry">重试</button></p>'; $('#retry').onclick = load; });
  }
  load();
})();
