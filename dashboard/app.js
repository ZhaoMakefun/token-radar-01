// Token Radar dashboard: renders window.RADAR (written by main.ts) with no network and no
// framework. Views: the board, a detail view per protocol, the model, and the live-token set.
// Hash routing: #/ board, #/p/<slug> detail, #/model model, #/live live tokens, and
// #/?cat=<category>&chain=<chain>&q=<text>&watch=1 a filtered board.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);

/** Escape text for HTML. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** $1,234,567,890 -> $1.23B; $12,345 -> $12.3K. */
function money(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}

/** 5.645 -> +5.6%; null -> —. */
function pct(v) {
  if (v === null || v === undefined) return '<span class="muted">—</span>';
  const cls = v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  return `<span class="${cls}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}

/** 812 days -> 2.2 yrs; 45 days -> 45 days. */
function ageText(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days >= 365) return (days / 365).toFixed(1) + ' yrs';
  return days + ' days';
}

/** The watchlist slugs, for the board's WATCHLIST badge and filter. */
const WATCH = new Set(D.watchlist || []);

/** The rows after the current filters, in the current sort order. */
function filteredRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const chain = $('chain').value;
  const watchOnly = $('watch').checked;
  let rows = D.rows.filter((r) => {
    if (watchOnly && !WATCH.has(r.slug)) return false;
    if (cat && r.category !== cat) return false;
    if (chain && !r.chains.includes(chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    return true;
  });
  const sort = $('sort').value;
  const by = {
    rank: (a, b) => a.rank - b.rank,
    value: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -999) - (a.change_7d ?? -999),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
  }[sort] || ((a, b) => a.rank - b.rank);
  return rows.sort(by);
}

function renderBoard() {
  const rows = filteredRows();
  $('count').textContent = rows.length === D.rows.length
    ? `Showing all ${D.rows.length} ranked protocols.`
    : `Showing ${rows.length} of ${D.rows.length} ranked protocols.`;
  $('rows').innerHTML = rows.map((r) => `<tr data-slug="${esc(r.slug)}">
    <td class="rank">${r.rank}</td>
    <td><span class="name">${esc(r.name)}</span>${WATCH.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : ''}</td>
    <td>${esc(r.category || '—')}</td>
    <td>${esc(r.chains.slice(0, 2).join(', '))}${r.chains.length > 2 ? ` +${r.chains.length - 2}` : ''}</td>
    <td class="num">${money(r.tvl_usd)}</td>
    <td class="num">${pct(r.change_7d)}</td>
    <td class="num"><strong>${money(r.implied_value_usd)}</strong></td>
  </tr>`).join('');
  document.querySelectorAll('#rows tr').forEach((tr) => {
    tr.addEventListener('click', () => { location.hash = '#/p/' + tr.dataset.slug; });
  });
}

function renderDetail(slug) {
  const r = D.rows.find((x) => x.slug === slug);
  if (!r) { location.hash = '#/'; return; }
  const base = r.tvl_usd * r.category_multiple;
  $('detail').innerHTML = `
    <div class="detail">
      <h2>#${r.rank} · ${esc(r.name)}${WATCH.has(r.slug) ? '<span class="badge">WATCHLIST</span>' : ''}</h2>
      <p class="sub">${esc(r.category || 'Uncategorised')} · ${esc(r.chains.join(', ') || 'no chain listed')} ·
      tracked since ${esc(r.listed_at || 'unknown')} · records no token</p>
      <div class="facts">
        <div class="fact"><div class="k">Implied value</div><div class="v">${money(r.implied_value_usd)}</div></div>
        <div class="fact"><div class="k">TVL</div><div class="v">${money(r.tvl_usd)}</div></div>
        <div class="fact"><div class="k">7-day change</div><div class="v">${r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%'}</div></div>
        <div class="fact"><div class="k">Age with no token</div><div class="v">${ageText(r.age_days)}</div></div>
      </div>
      <h3>How the value is worked out</h3>
      <table class="breakdown">
        <tr><td>TVL × category multiple (${r.category_multiple.toFixed(4)}× ${esc(r.category || 'market')})</td><td>${money(base)}</td></tr>
        <tr><td>Growth factor (${r.change_7d === null ? 'no 7-day figure' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%'})</td><td>× ${r.growth_multiplier.toFixed(4)}</td></tr>
        <tr><td>Maturity factor (${ageText(r.age_days)} with no token)</td><td>× ${r.maturity_multiplier.toFixed(4)}</td></tr>
        <tr><td>Breadth factor (${r.chains.length} chain${r.chains.length === 1 ? '' : 's'})</td><td>× ${r.breadth_multiplier.toFixed(4)}</td></tr>
        <tr><td>Implied value</td><td>${money(r.implied_value_usd)}</td></tr>
      </table>
      <h3>Farm plan — six steps</h3>
      <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>`;
}

function renderModel() {
  $('multiples').innerHTML = [...D.multiples].sort((a, b) => b.multiple - a.multiple).map((m) =>
    `<tr><td>${esc(m.category)}</td><td class="num">${m.multiple.toFixed(4)}×</td><td class="num">${m.live_count}</td></tr>`).join('');
  $('globalmult').textContent = D.global_multiple.toFixed(4);
}

function renderLive() {
  $('live').innerHTML = D.live.map((p) => `<tr>
    <td><span class="name">${esc(p.name)}</span></td>
    <td>${esc(p.category || '—')}</td>
    <td class="num">${money(p.tvl_usd)}</td>
    <td class="num">${p.mcap_usd === null ? '—' : money(p.mcap_usd)}</td>
    <td class="num">${p.mcap_usd === null ? '—' : (p.mcap_usd / p.tvl_usd).toFixed(2) + '×'}</td>
  </tr>`).join('');
}

/** Show one view, hide the rest, mark the tab. */
function show(view) {
  for (const v of ['board', 'detail', 'model', 'live']) $('view-' + v).hidden = v !== view;
  document.querySelectorAll('#tabs a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === (view === 'detail' ? 'board' : view));
  });
}

/** Read the hash: view, optional slug, optional board filters. */
function route() {
  const hash = location.hash || '#/';
  if (hash.startsWith('#/p/')) { renderDetail(decodeURIComponent(hash.slice(4))); show('detail'); return; }
  if (hash === '#/model') { renderModel(); show('model'); return; }
  if (hash === '#/live') { renderLive(); show('live'); return; }
  if (hash.startsWith('#/?')) {
    const params = new URLSearchParams(hash.slice(3));
    if (params.has('cat')) $('cat').value = params.get('cat');
    if (params.has('chain')) $('chain').value = params.get('chain');
    if (params.has('q')) $('q').value = params.get('q');
    if (params.has('watch')) $('watch').checked = params.get('watch') === '1';
    if (params.has('sort')) $('sort').value = params.get('sort');
  }
  renderBoard();
  show('board');
}

/** Fill the header, the stats, and the filter dropdowns. */
function init() {
  $('asof').textContent = D.as_of;
  $('asof2').textContent = D.as_of;
  $('boardsize').textContent = D.board_size;
  $('stats').innerHTML = `<b>${D.board_size}</b> protocols ranked · <b>${D.watchlist_size}</b> on the watchlist · ` +
    `<b>${D.early_size}</b> early finds below the floor · <b>${D.live_size}</b> live tokens set aside · ` +
    `floor ${money(D.floor_usd)} TVL · model ${esc(D.model_version)}`;
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  for (const c of cats) $('cat').insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
  const chains = [...new Set(D.rows.flatMap((r) => r.chains))].sort();
  for (const c of chains) $('chain').insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
  for (const id of ['q', 'cat', 'chain', 'sort', 'watch']) $(id).addEventListener('input', renderBoard);
  window.addEventListener('hashchange', route);
  route();
}

init();
