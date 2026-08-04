(function () {
  'use strict';
  const PANEL_ID = 'eva-magi-observation-terminal';
  const STYLE_ID = 'eva-magi-observation-terminal-style';
  const GLOBAL = '__EVA_STATUS_PANEL_CLEANUP__';
  const disposers = [];
  let timer = null;

  if (typeof window[GLOBAL] === 'function') window[GLOBAL]();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
  }

  function getMvuDataSafe() {
    const check = host => {
      try {
        if (host?.Mvu && typeof host.Mvu.getMvuData === 'function') return host.Mvu.getMvuData({type: 'message', message_id: 'latest'})?.stat_data;
        return host?.mag_var_update?.data?.stat_data || host?.mag_var_update?.data;
      } catch (_) { return null; }
    };
    try { return check(window) || check(window.parent) || check(window.top); }
    catch (_) { return check(window); }
  }

  const percent = value => Math.max(0, Math.min(100, Number(value) || 0));
  const names = object => Object.entries(object || {}).filter(([, active]) => !!active).map(([name]) => name).join('・') || '无登记';

  function viewModel(stat = {}) {
    const meta = stat.元信息 || {};
    const world = stat.世界 || {};
    const person = stat.玩家 || {};
    const body = stat.主角状态 || {};
    const event = stat.事件 || {};
    return {
      line: meta.世界线 || 'A', stage: meta.阶段 || 'TV前期', date: world.日期 || '未确定', time: world.时刻 || '未确定',
      location: world.当前区域 || '位置未锁定', alert: world.使徒警报 || '无', name: person.姓名 || '{{user}}',
      organization: person.所属组织 || '未登记', identity: person.自述身份 || '临时入域人员', permission: person.权限等级 ?? 0,
      sync: Number(body.同步率) || 0, fatigue: percent(body.疲劳), contamination: percent(body.精神污染度), wall: percent(body.心之壁厚度),
      event: event.当前主事件 || event.当前环境事件 || '常规观测中', present: names(stat.场景?.在场人物),
    };
  }

  function metric(label, value, width, tone = '') {
    return `<div class="eva-metric ${tone}"><div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div><i><em style="width:${percent(width)}%"></em></i></div>`;
  }

  function render(stat) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const d = viewModel(stat);
    panel.dataset.alert = ['接近', '交战'].includes(d.alert) ? '1' : '0';
    panel.querySelector('.eva-status-body').innerHTML = `
      <div class="eva-status-strip"><b>CASE ${escapeHtml(d.line)}</b><span>${escapeHtml(d.stage)}</span><span>${escapeHtml(d.date)} / ${escapeHtml(d.time)}</span></div>
      <div class="eva-status-alert"><span>使徒警戒</span><b>${escapeHtml(d.alert)}</b><span>${escapeHtml(d.location)}</span></div>
      <div class="eva-status-person"><strong>${escapeHtml(d.name)}</strong><span>${escapeHtml(d.organization)} · ${escapeHtml(d.identity)}</span><small>SECURITY CLEARANCE ${escapeHtml(d.permission)}</small></div>
      <div class="eva-status-metrics">${metric('同步率', `${d.sync.toFixed(1)}%`, Math.abs(d.sync))}${metric('疲劳', `${d.fatigue}%`, d.fatigue)}${metric('精神污染', `${d.contamination}%`, d.contamination, 'danger')}${metric('心之壁', `${d.wall}%`, d.wall)}</div>
      <div class="eva-status-event"><small>CURRENT OPERATION</small><b>${escapeHtml(d.event)}</b><span>现场：${escapeHtml(d.present)}</span></div>`;
  }

  function refresh(event) { render(event?.detail?.stat_data || event?.detail || getMvuDataSafe()); }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${PANEL_ID}{position:fixed;left:18px;bottom:18px;z-index:999998;width:min(540px,calc(100vw - 36px));background:#080b0f;color:#dce4e8;border:1px solid #ed5a24;box-shadow:0 18px 55px #000c;font:12px/1.4 Consolas,'Microsoft YaHei',sans-serif}
#${PANEL_ID} *{box-sizing:border-box}#${PANEL_ID} .eva-status-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#e7e3d9;color:#090b0e;letter-spacing:1.8px;font-weight:900;cursor:pointer}
#${PANEL_ID} .eva-status-head i{width:10px;height:10px;background:#ed5a24;box-shadow:18px 0 #17222b,36px 0 #17222b;margin-right:36px}#${PANEL_ID}.min .eva-status-body{display:none}
#${PANEL_ID} .eva-status-strip{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:center;padding:7px 10px;border-bottom:1px solid #34414a;color:#9eb4c0}#${PANEL_ID} .eva-status-strip b{color:#ed5a24}#${PANEL_ID} .eva-status-strip span:last-child{text-align:right}
#${PANEL_ID} .eva-status-alert{display:grid;grid-template-columns:auto auto 1fr;gap:9px;padding:8px 10px;background:#101820;border-left:5px solid #d0a425}#${PANEL_ID} .eva-status-alert b{color:#f0c544}#${PANEL_ID} .eva-status-alert span:last-child{text-align:right;color:#aab9c1}#${PANEL_ID}[data-alert="1"] .eva-status-alert{border-color:#ed3b24;background:#240a08}#${PANEL_ID}[data-alert="1"] .eva-status-alert b{color:#ff6c55}
#${PANEL_ID} .eva-status-person{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:baseline;padding:10px}#${PANEL_ID} .eva-status-person strong{font-size:15px;color:#fff}#${PANEL_ID} .eva-status-person span{color:#aab9c1}#${PANEL_ID} .eva-status-person small{color:#ed5a24}
#${PANEL_ID} .eva-status-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:0 10px 10px}.eva-metric>div{display:flex;justify-content:space-between;color:#91a5b0}.eva-metric b{color:#dce4e8}.eva-metric i{display:block;height:5px;margin-top:4px;background:#1d2931}.eva-metric em{display:block;height:100%;background:#6ba5c4}.eva-metric.danger em{background:#ed5a24}
#${PANEL_ID} .eva-status-event{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:9px 10px;border-top:1px solid #34414a;background:#050709}#${PANEL_ID} .eva-status-event small{grid-row:1/3;color:#ed5a24;writing-mode:vertical-rl;letter-spacing:1px}#${PANEL_ID} .eva-status-event b{color:#e9edf0}#${PANEL_ID} .eva-status-event span{color:#8fa1aa}
@media(max-width:620px){#${PANEL_ID}{left:8px;bottom:8px;width:calc(100vw - 16px)}#${PANEL_ID} .eva-status-person{grid-template-columns:1fr}#${PANEL_ID} .eva-status-metrics{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = '<div class="eva-status-head"><span>NERV // MAGI OBSERVATION TERMINAL</span><i></i></div><div class="eva-status-body"></div>';
    document.body.appendChild(panel);
    panel.querySelector('.eva-status-head').addEventListener('dblclick', () => panel.classList.toggle('min'));
    refresh();
  }

  function listen(target, name, handler) {
    try { target?.addEventListener?.(name, handler); disposers.push(() => target?.removeEventListener?.(name, handler)); } catch (_) {}
  }

  function boot() {
    createPanel();
    listen(window, 'eva:state-updated', refresh);
    listen(window, 'eva:timeline-changed', refresh);
    try {
      const ctx = window.SillyTavern?.getContext?.();
      ctx?.eventSource?.on?.(ctx?.eventTypes?.MESSAGE_RECEIVED, refresh);
      ctx?.eventSource?.on?.(ctx?.eventTypes?.CHAT_CHANGED, refresh);
    } catch (_) {}
    timer = setInterval(refresh, 1200);
  }

  window[GLOBAL] = () => {
    if (timer) clearInterval(timer);
    while (disposers.length) disposers.pop()();
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    delete window[GLOBAL];
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
