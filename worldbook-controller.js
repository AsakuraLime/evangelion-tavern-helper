(function () {
  'use strict';
  const BOOK_NAME = 'EVANGELION 4.2';
  const PANEL_ID = 'eva-worldbook-console';
  const STYLE_ID = 'eva-worldbook-console-style';
  const STAGES = {
    A: ['TV前期', 'TV中期', 'TV后期', 'EoE', '后EoE'],
    B: ['序', '破', 'Q', 'シン', '新生后'],
  };
  let busy = false;

  if (window.__EVA_WORLD_BOOK_CONTROL_CLEANUP__) window.__EVA_WORLD_BOOK_CONTROL_CLEANUP__();

  function context() {
    try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; }
  }

  function headers() {
    try { return {...(context()?.getRequestHeaders?.() || {}), 'Content-Type': 'application/json'}; }
    catch (_) { return {'Content-Type': 'application/json'}; }
  }

  function apiPost(url, payload) {
    return new Promise((resolve, reject) => {
      $.ajax({url, method: 'POST', headers: headers(), contentType: 'application/json', data: JSON.stringify(payload)})
        .done(resolve)
        .fail(xhr => reject(new Error(`${url}：${xhr?.responseText || xhr?.statusText || '请求失败'}`)));
    });
  }

  async function loadBook() {
    const ctx = context();
    if (ctx?.loadWorldInfo) {
      const data = await ctx.loadWorldInfo(BOOK_NAME);
      if (!data?.entries) throw new Error('中央教条区未返回指定档案域');
      return {data, ctx, mode: 'context'};
    }
    const data = await apiPost('/api/worldinfo/get', {name: BOOK_NAME});
    if (!data?.entries) throw new Error('中央教条区未返回指定档案域');
    return {data, ctx: null, mode: 'api'};
  }

  async function saveBook(handle) {
    if (handle.mode === 'context' && handle.ctx?.saveWorldInfo) {
      await handle.ctx.saveWorldInfo(BOOK_NAME, handle.data, true);
      await handle.ctx.reloadWorldInfoEditor?.(BOOK_NAME, true);
      return;
    }
    await apiPost('/api/worldinfo/edit', {name: BOOK_NAME, data: handle.data});
    const ctx = context();
    try { ctx?.eventSource?.emit?.(ctx.eventTypes?.WORLDINFO_UPDATED, BOOK_NAME, handle.data); } catch (_) {}
    try { ctx?.reloadWorldInfoEditor?.(BOOK_NAME, true); } catch (_) {}
  }

  function entryScope(entry) {
    const explicit = entry?.extensions?.eva_scope;
    if (['A', 'B', 'AB', 'COMMON', 'SYSTEM'].includes(explicit)) return explicit;
    const title = String(entry?.comment || entry?.title || '');
    if (/::A(?:::|线)/i.test(title)) return 'A';
    if (/::B(?:::|线)/i.test(title)) return 'B';
    if (/::共通|::衣柜/.test(title)) return 'AB';
    return 'COMMON';
  }

  function entryStages(entry) {
    const stages = entry?.extensions?.eva_stages;
    return Array.isArray(stages) && stages.length ? stages : ['*'];
  }

  function shouldOpen(entry, line, stage) {
    const kind = entry?.extensions?.eva_kind || '';
    if (kind === 'prompt') return entry.comment !== 'SYSTEM::[initvar]变量初始化勿开';
    const scope = entryScope(entry);
    if (scope !== 'COMMON' && scope !== 'AB' && scope !== line) return false;
    const stages = entryStages(entry);
    return stages.includes('*') || stages.includes(stage);
  }

  function entryGroup(entry, line) {
    const kind = entry?.extensions?.eva_kind || 'other';
    const scope = entryScope(entry);
    const title = String(entry?.comment || '');
    if (kind === 'prompt') return '核心指令';
    if (kind === 'character' && /::共通$/.test(title)) return '人员基础档案';
    if (kind === 'character' && /::衣柜/.test(title)) return '服装连续性';
    if (kind === 'character' && scope === line) return `CASE ${line} 人员履历`;
    if (kind === 'dossier') return '行为评估';
    if (['faction', 'region'].includes(kind)) return `CASE ${line} 组织与区域`;
    if (entryStages(entry)[0] !== '*') return '阶段事件';
    return '环境与技术档案';
  }

  function groupStats(entries, line) {
    const stats = {};
    for (const entry of entries) {
      if (entry.disable) continue;
      const group = entryGroup(entry, line);
      stats[group] = (stats[group] || 0) + 1;
    }
    return Object.entries(stats).map(([name, count]) => `${name} ${count}`).join('｜');
  }

  function setStatus(text, error = false) {
    const el = document.querySelector(`#${PANEL_ID} .eva-wb-status`);
    if (el) { el.textContent = text; el.dataset.error = error ? '1' : '0'; }
  }

  function setActive(line, stage) {
    document.querySelectorAll(`#${PANEL_ID} [data-line][data-stage]`).forEach(button => {
      button.dataset.active = button.dataset.line === line && button.dataset.stage === stage ? '1' : '0';
    });
    const label = document.querySelector(`#${PANEL_ID} .eva-current`);
    if (label) label.textContent = `${line} · ${stage}`;
  }

  async function applyTimeline(line, stage, options = {}) {
    if (!STAGES[line]?.includes(stage)) throw new Error(`观测坐标不成立：${line} / ${stage}`);
    if (busy) throw new Error('资料域正在重定向，请稍候');
    busy = true;
    setStatus(`正在接入 CASE ${line} · ${stage}…`);
    try {
      const handle = await loadBook();
      const entries = Object.values(handle.data.entries || {});
      let opened = 0, closed = 0, changed = 0;
      for (const entry of entries) {
        const open = shouldOpen(entry, line, stage);
        const nextDisable = !open;
        if (entry.disable !== nextDisable) {
          entry.disable = nextDisable;
          changed++;
          open ? opened++ : closed++;
        }
      }
      await saveBook(handle);
      const state = {line, stage, changed, opened, closed, at: Date.now()};
      localStorage.setItem('eva_magi_timeline_v4_2', JSON.stringify(state));
      setActive(line, stage);
      setStatus(`CASE ${line} · ${stage} 资料域接入完成\n重定向 ${changed}｜接入 ${opened}｜隔离 ${closed}\n${groupStats(entries, line)}`);
      window.dispatchEvent(new CustomEvent('eva:timeline-changed', {detail: state}));
      try { window.parent?.dispatchEvent(new CustomEvent('eva:timeline-changed', {detail: state})); } catch (_) {}
      if (!options.silent) toastr.success(`CASE ${line} · ${stage}`, 'MAGI资料域接入完成');
      return state;
    } catch (error) {
      setStatus(`接入中断：${error.message}`, true);
      if (!options.silent) toastr.error(error.message, 'MAGI资料域接入中断');
      throw error;
    } finally { busy = false; }
  }

  async function scanBook() {
    try {
      const handle = await loadBook();
      const entries = Object.values(handle.data.entries || {});
      const opened = entries.filter(entry => !entry.disable).length;
      const saved = JSON.parse(localStorage.getItem('eva_magi_timeline_v4_2') || 'null');
      setStatus(`中央档案域在线\n收录 ${entries.length}｜当前接入 ${opened}\n${groupStats(entries, saved?.line || 'A')}`);
    } catch (error) { setStatus(`校验中断：${error.message}`, true); }
  }

  function createPanel() {
    $(`#${PANEL_ID}, #${STYLE_ID}`).remove();
    $('head').append(`<style id="${STYLE_ID}">
#${PANEL_ID}{position:fixed;right:18px;bottom:82px;z-index:999999;width:360px;max-width:calc(100vw - 24px);background:#080b10;color:#dbe5ed;border:1px solid #ef5b24;box-shadow:0 18px 50px #000b;font:12px/1.5 Consolas,'Microsoft YaHei',sans-serif}
#${PANEL_ID} .eva-wb-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#e8e4db;color:#090b0e;font-weight:900;letter-spacing:1px;cursor:move}
#${PANEL_ID} .eva-wb-body{padding:12px}#${PANEL_ID}.min .eva-wb-body{display:none}#${PANEL_ID}.min{width:210px}
#${PANEL_ID} .eva-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:8px 0 12px}
#${PANEL_ID} button{border:1px solid #3b4650;background:#111820;color:#dbe5ed;padding:7px 4px;cursor:pointer;font:inherit}
#${PANEL_ID} button[data-active="1"]{background:#ef5b24;color:#080b10;border-color:#ef5b24;font-weight:900}
#${PANEL_ID} .eva-current{color:#ef5b24;font-weight:900}#${PANEL_ID} .eva-wb-status{white-space:pre-wrap;min-height:42px;padding:8px;background:#030507;border-left:3px solid #6ca7c8;color:#9ec0d4}
#${PANEL_ID} .eva-wb-status[data-error="1"]{border-color:#ef5b24;color:#ff9a76}#${PANEL_ID} .eva-line{color:#8997a2;letter-spacing:1px;margin-top:8px}
@media(max-width:600px){#${PANEL_ID}{right:8px;bottom:64px;width:calc(100vw - 16px)}}
</style>`);
    const buttons = Object.entries(STAGES).map(([line, stages]) => `<div class="eva-line">CASE ${line}</div><div class="eva-grid">${stages.map(stage => `<button type="button" data-line="${line}" data-stage="${stage}">${stage}</button>`).join('')}</div>`).join('');
    $('body').append(`<section id="${PANEL_ID}"><div class="eva-wb-head"><span>MAGI / CENTRAL DOGMA ARCHIVE</span><span class="eva-current">资料域未锁定</span></div><div class="eva-wb-body">${buttons}<button type="button" data-scan="1">执行档案校验</button><div class="eva-wb-status">等待观测坐标</div></div></section>`);
    const panel = $(`#${PANEL_ID}`);
    panel.on('click', '[data-line][data-stage]', event => applyTimeline(event.currentTarget.dataset.line, event.currentTarget.dataset.stage));
    panel.on('click', '[data-scan]', scanBook);
    panel.on('dblclick', '.eva-wb-head', () => panel.toggleClass('min'));
    try {
      const saved = JSON.parse(localStorage.getItem('eva_magi_timeline_v4_2') || 'null');
      if (saved?.line && saved?.stage) setActive(saved.line, saved.stage);
    } catch (_) {}
  }

  window.__EVA_APPLY_TIMELINE__ = applyTimeline;
  window.__EVA_SCAN_WORLD_BOOK__ = scanBook;
  window.__EVA_WORLD_BOOK_CONTROL_CLEANUP__ = () => {
    $(`#${PANEL_ID}, #${STYLE_ID}`).remove();
    delete window.__EVA_APPLY_TIMELINE__;
    delete window.__EVA_SCAN_WORLD_BOOK__;
  };

  const readyTimer = setInterval(() => {
    if (window.jQuery && context()) { clearInterval(readyTimer); createPanel(); }
  }, 300);
  setTimeout(() => clearInterval(readyTimer), 15000);
})();
