/**
 * Fotolio first-party analytics beacon.
 *
 * Loaded only on published (live) pages. Records a pageview on load plus nav,
 * lightbox and opt-in element clicks ([data-track]). Same-origin POST to the
 * API collect endpoint — no third parties, no cookies beyond a first-party
 * session id. See docs/ANALYTICS.md.
 */
(function () {
  var cfg = window.__FOTOLIO_SITE__;
  if (!cfg || !cfg.id) return;

  function rid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function store(area, key) {
    try {
      var v = area.getItem(key);
      if (!v) { v = rid(); area.setItem(key, v); }
      return v;
    } catch (e) { return rid(); }
  }

  var sid = store(window.sessionStorage, 'fotolio_sid'); // per tab/session
  var vid = store(window.localStorage, 'fotolio_vid');   // returning-visitor id
  var ENDPOINT = '/api/analytics/collect';

  function send(type, label) {
    var body = JSON.stringify({
      site_id: cfg.id,
      sid: sid,
      vid: vid,
      type: type,
      path: location.pathname || '/',
      label: label || null,
      referrer: document.referrer || null
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  }

  // Pageview on load.
  send('pageview');

  // Delegated click tracking.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a,[data-track],[data-lightbox]') : null;
    if (!el) return;
    if (el.hasAttribute('data-lightbox') || el.closest('[data-lightbox]')) {
      var lb = el.closest('[data-lightbox]') || el;
      send('lightbox', lb.getAttribute('data-title') || (lb.querySelector('img') && lb.querySelector('img').alt) || 'photo');
      return;
    }
    if (el.hasAttribute('data-track')) {
      send('click', el.getAttribute('data-track') || el.textContent.trim().slice(0, 80));
      return;
    }
    if (el.tagName === 'A' && (el.closest('.nav-links') || el.closest('.subnav'))) {
      send('nav', (el.textContent || '').trim().slice(0, 80));
    }
  }, true);

  // Keep "active now" meaningful while a visitor lingers on one page.
  var beats = 0;
  var timer = setInterval(function () {
    if (document.visibilityState === 'visible' && beats++ < 30) {
      send('event', 'heartbeat');
    } else if (beats >= 30) {
      clearInterval(timer);
    }
  }, 60000);
})();
