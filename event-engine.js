(function () {
  'use strict';
  const GLOBAL = '__EVA_EVENT_ENGINE_V4_2__';
  if (window[GLOBAL]?.cleanup) window[GLOBAL].cleanup();

  const listeners = [];
  const on = (target, name, handler) => {
    target.addEventListener(name, handler);
    listeners.push(() => target.removeEventListener(name, handler));
  };

  function timelineChanged(event) {
    const detail = event.detail || {};
    if (!detail.line || !detail.stage) return;
    window.__EVA_RUNTIME_TIMELINE__ = {line: detail.line, stage: detail.stage, at: detail.at || Date.now()};
  }

  function variableReady(data) {
    const stat = data?.stat_data;
    if (!stat) return;
    const saved = window.__EVA_RUNTIME_TIMELINE__;
    if (saved && !stat.元信息?.已初始化) {
      stat.元信息 ||= {};
      stat.元信息.世界线 = saved.line;
      stat.元信息.阶段 = saved.stage;
    }
    window.dispatchEvent(new CustomEvent('eva:state-updated', {detail: stat}));
  }

  on(window, 'eva:timeline-changed', timelineChanged);
  try {
    const saved = JSON.parse(localStorage.getItem('eva_magi_timeline_v4_2') || 'null');
    if (saved?.line && saved?.stage) timelineChanged({detail: saved});
  } catch (_) {}

  $(async () => {
    await waitGlobalInitialized('Mvu');
    if (typeof eventOn === 'function') eventOn('mag_variable_initialized', variableReady);
    toastr.success('事件联动回路接通', 'MAGI');
  });

  window[GLOBAL] = {cleanup() { while (listeners.length) listeners.pop()(); }};
})();
