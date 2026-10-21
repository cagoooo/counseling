// Service Worker 註冊＋新版本通知列
// APP_VERSION 由 scripts/bump-version.ps1 與 sw.js、version.json 同步更新
(function () {
  'use strict';

  var APP_VERSION = '2026.10.21-2';
  var BAR_ID = 'sw-update-bar';
  var params = new URLSearchParams(location.search);

  // 頁尾顯示目前版本
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('appVersion');
    if (el) el.textContent = 'v' + APP_VERSION;
  });

  var SW_REG = null;
  var UPDATING = false;

  function injectStyle() {
    if (document.getElementById('sw-update-style')) return;
    var s = document.createElement('style');
    s.id = 'sw-update-style';
    s.textContent = [
      '#' + BAR_ID + '{position:fixed;z-index:9999;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);',
      'width:max-content;max-width:calc(100vw - 24px);display:flex;align-items:center;gap:12px;',
      'background:#1f4d44;color:#fff;padding:10px 12px 10px 18px;border-radius:999px;',
      'box-shadow:0 14px 34px -10px rgba(0,0,0,.45);font:16px/1.5 "PingFang TC","Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif;',
      'animation:swBarIn .35s ease-out}',
      '#' + BAR_ID + ' .sw-msg{display:flex;flex-direction:column}',
      '#' + BAR_ID + ' .sw-title{font-weight:700}',
      '#' + BAR_ID + ' .sw-sub{display:none;font-size:14px;opacity:.85}',
      '#' + BAR_ID + ' button{cursor:pointer;border:0;font:inherit}',
      '#' + BAR_ID + ' #sw-go{background:#f3b46b;color:#3b2406;font-weight:700;padding:8px 16px;border-radius:999px}',
      '#' + BAR_ID + ' #sw-go:hover{background:#f7c78c}',
      '#' + BAR_ID + ' #sw-x{background:transparent;color:#cfe3dc;width:36px;height:36px;border-radius:50%;font-size:17px}',
      '#' + BAR_ID + ' #sw-x:hover{background:rgba(255,255,255,.12)}',
      '#' + BAR_ID + ' button:focus-visible{outline:3px solid #f3b46b;outline-offset:2px}',
      '@keyframes swBarIn{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}',
      '@media (max-width:560px){#' + BAR_ID + '{left:12px;right:12px;top:auto;bottom:max(12px,env(safe-area-inset-bottom));',
      'transform:none;width:auto;display:grid;grid-template-columns:1fr auto;grid-template-areas:"msg x" "go go";',
      'gap:10px;border-radius:18px;padding:14px 12px 12px 16px;animation-name:swBarUp}',
      '#' + BAR_ID + ' .sw-msg{grid-area:msg}#' + BAR_ID + ' .sw-sub{display:block}',
      '#' + BAR_ID + ' #sw-x{grid-area:x;width:44px;height:44px}',
      '#' + BAR_ID + ' #sw-go{grid-area:go;width:100%;min-height:48px;border-radius:14px;font-size:17px}',
      '@keyframes swBarUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}}',
      '@media (prefers-reduced-motion:reduce){#' + BAR_ID + '{animation:none}}',
      '@media print{#' + BAR_ID + '{display:none!important}}',
    ].join('');
    document.head.appendChild(s);
  }

  // 套用更新：在「點擊當下」才查 reg.waiting，避免兩個偵測來源打架
  function applyUpdate() {
    if (UPDATING) return;
    UPDATING = true;
    var bar = document.getElementById(BAR_ID);
    if (bar) bar.remove();
    if (SW_REG && SW_REG.waiting) {
      SW_REG.waiting.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(function () { location.reload(); }, 1500);
    } else {
      location.reload();
    }
  }

  function showBar() {
    if (document.getElementById(BAR_ID) || !document.body) return;
    injectStyle();
    var b = document.createElement('div');
    b.id = BAR_ID;
    b.setAttribute('role', 'status');
    b.setAttribute('aria-live', 'polite');
    b.innerHTML = '<div class="sw-msg"><span class="sw-title">✨ 輔導紀錄小幫手有新版本</span>'
      + '<span class="sw-sub">重新整理就能用到最新功能，填寫中的內容會自動保留。</span></div>'
      + '<button type="button" id="sw-go">重新整理載入</button>'
      + '<button type="button" id="sw-x" aria-label="稍後再說">✕</button>';
    document.body.appendChild(b);
    document.getElementById('sw-go').addEventListener('click', applyUpdate);
    document.getElementById('sw-x').addEventListener('click', function () { b.remove(); });
  }

  // 預覽通知列樣式：網址加 ?swdemo=1
  if (params.get('swdemo') === '1') {
    document.addEventListener('DOMContentLoaded', showBar);
  }

  if (!('serviceWorker' in navigator)) return;

  // 本機開發預設不註冊（避免快取干擾修改），網址加 ?sw=1 才啟用測試
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (isLocal) {
    try {
      if (params.get('sw') === '1') sessionStorage.setItem('crh.swdev', '1');
      if (params.get('sw') === '0') sessionStorage.removeItem('crh.swdev');
    } catch (e) { /* 忽略 */ }
    var devOn = false;
    try { devOn = sessionStorage.getItem('crh.swdev') === '1'; } catch (e) { devOn = false; }
    if (!devOn) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) { r.unregister(); });
      }).catch(function () {});
      return;
    }
  }

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    SW_REG = reg;
    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady();
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        // 有 controller 才是「更新」；沒有代表第一次安裝，不必提示
        if (nw.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady();
      });
    });
    setInterval(function () { reg.update().catch(function () {}); }, 60000);
  }).catch(function () {});

  // 新版裝好了：若這個頁面本身已是最新版（老師剛好在部署後才打開），就安靜換上、不跳通知
  var SILENT = false;
  function onUpdateReady() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.version === APP_VERSION && SW_REG && SW_REG.waiting) {
          SILENT = true;
          SW_REG.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          showBar();
        }
      })
      .catch(showBar);
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (SILENT) { SILENT = false; return; } // 頁面已是新版，不必重整
    try {
      if (sessionStorage.getItem('crh.swReloaded')) return; // 防止無限重整
      sessionStorage.setItem('crh.swReloaded', '1');
      setTimeout(function () { sessionStorage.removeItem('crh.swReloaded'); }, 4000);
    } catch (e) { /* 忽略 */ }
    location.reload();
  });

  // 備援：輪詢 version.json；發現新版先請 SW 抓更新，再顯示同一個通知列
  function checkVersion() {
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.version && d.version !== APP_VERSION) {
          if (SW_REG) SW_REG.update().catch(function () {});
          showBar();
        }
      })
      .catch(function () {});
  }
  ['focus', 'online', 'pageshow'].forEach(function (ev) { window.addEventListener(ev, checkVersion); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkVersion();
  });
  setTimeout(checkVersion, 8000);
  setInterval(checkVersion, 180000);
})();
