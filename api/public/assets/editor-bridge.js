/* Fotolio Site Editor — canvas bridge.
   Runs inside the edit-mode iframe (the real PHP theme). Applies changes posted
   by the React panels to the DOM instantly, and posts inline edits / selections
   / navigation back up. Protocol documented in docs/EDITOR.md. Vanilla, no deps. */
(function () {
  'use strict';

  var CTX = window.__FOTOLIO_EDIT__ || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function post(type, payload) {
    try {
      window.parent.postMessage(Object.assign({ source: 'fotolio-canvas', type: type }, payload || {}), '*');
    } catch (e) { /* ignore */ }
  }

  function currentToken() {
    var m = /[?&]token=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : (CTX.token || '');
  }
  function currentPath() {
    var m = /[?&]path=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /* ---- Inline text editing (event delegation, survives DOM swaps) ---------- */
  function editValue(el) {
    return (el.innerText || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
  }
  var timers = new WeakMap();
  document.addEventListener('input', function (e) {
    var el = e.target.closest ? e.target.closest('[data-editable]') : null;
    if (!el) return;
    el.classList.toggle('is-empty', editValue(el) === '');
    clearTimeout(timers.get(el));
    timers.set(el, setTimeout(function () {
      post('edit', { path: el.getAttribute('data-editable'), value: editValue(el) });
    }, 250));
  });
  document.addEventListener('focusout', function (e) {
    var el = e.target.closest ? e.target.closest('[data-editable]') : null;
    if (!el) return;
    clearTimeout(timers.get(el));
    post('edit', { path: el.getAttribute('data-editable'), value: editValue(el) });
  });
  // Keep single-line fields single-line; allow newlines only in paragraph/quote blocks.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var el = e.target.closest ? e.target.closest('[data-editable]') : null;
    if (!el) return;
    var w = el.closest('[data-block-type]');
    var multi = w && (w.getAttribute('data-block-type') === 'paragraph' || w.getAttribute('data-block-type') === 'quote');
    if (!multi) { e.preventDefault(); el.blur(); }
  });

  // Undo/redo while focus is inside the canvas. Leave native undo alone while
  // the caret is in an editable field so typing corrections still work there.
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || (e.key !== 'z' && e.key !== 'Z' && e.key !== 'y' && e.key !== 'Y')) return;
    var inText = e.target && e.target.closest && e.target.closest('[data-editable]');
    if (inText) return;
    e.preventDefault();
    var redo = (e.key === 'y' || e.key === 'Y') || e.shiftKey;
    post('shortcut', { action: redo ? 'redo' : 'undo' });
  });

  /* ---- Clicks: navigation, region select, block remove, hero hint --------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    var a = t.closest ? t.closest('a[href]') : null;
    if (a) {
      var href = a.getAttribute('href') || '';
      var internal = href.indexOf('editor/render') > -1 || href.indexOf('/preview') > -1
        || a.hasAttribute('data-nav-home') || a.hasAttribute('data-nav-item')
        || a.hasAttribute('data-nav-page') || a.hasAttribute('data-nav-block');
      if (internal) {
        e.preventDefault();
        var pm = /[?&]path=([^&]+)/.exec(href);
        post('navigate', { path: pm ? decodeURIComponent(pm[1]) : '' });
        return;
      }
    }

    var rm = t.closest ? t.closest('[data-block-remove]') : null;
    if (rm) { e.preventDefault(); post('block-remove', { index: parseInt(rm.getAttribute('data-block-remove'), 10) }); return; }

    var hint = t.closest ? t.closest('[data-edit-open]') : null;
    if (hint) { e.preventDefault(); selectRegion(document.querySelector('.hero')); post('select', { region: 'hero', id: null }); return; }

    if (t.closest && t.closest('[data-editable]')) return; // let text edit

    var tile = t.closest ? t.closest('.tile.is-editable') : null;
    if (tile) {
      var grid = tile.closest('[data-edit-region]');
      if (grid) { selectRegion(grid); emitSelect(grid, { imageId: tile.getAttribute('data-image-id') }); }
      return;
    }

    var region = t.closest ? t.closest('[data-edit-region]') : null;
    if (region) { selectRegion(region); emitSelect(region); }
  });

  function emitSelect(el, extra) {
    post('select', Object.assign({
      region: el.getAttribute('data-edit-region'),
      id: el.getAttribute('data-gallery-id') || el.getAttribute('data-page-id') || null,
    }, extra || {}));
  }
  function selectRegion(el) {
    Array.prototype.forEach.call(document.querySelectorAll('.fotolio-selected'), function (n) { n.classList.remove('fotolio-selected'); });
    if (el) el.classList.add('fotolio-selected');
  }

  /* ---- Messages from the parent ------------------------------------------- */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.source !== 'fotolio-editor') return;
    switch (d.type) {
      case 'hero-style': heroStyle(d); break;
      case 'nav-render': navRender(d.items || []); break;
      case 'reload': reload(d.fragment, d.path); break;
      case 'set-text': setText(d.path, d.value); break;
      case 'select': selectByRegion(d.region, d.id); break;
      case 'deselect': selectRegion(null); break;
      case 'pulse': pulse(d.region, d.id); break;
      case 'scroll-to': scrollToRegion(d.region, d.id); break;
      case 'accent': setAccent(d.value); break;
      case 'custom-css': setCustomCss(d.css); break;
    }
  });

  function setAccent(value) {
    if (value) document.documentElement.style.setProperty('--accent', value);
    else document.documentElement.style.removeProperty('--accent');
  }
  function setCustomCss(css) {
    var el = document.getElementById('fotolio-custom-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'fotolio-custom-css';
      document.head.appendChild(el);
    }
    el.textContent = css || '';
  }

  function heroStyle(d) {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    if (d.height) { hero.classList.remove('h-tall', 'h-medium', 'h-full'); hero.classList.add('h-' + d.height); }
    var inner = hero.querySelector('.hero-inner');
    if (inner && d.position) { inner.classList.remove('pos-top', 'pos-center', 'pos-bottom'); inner.classList.add('pos-' + d.position); }
    var content = hero.querySelector('.hero-content');
    if (content && d.align) { content.classList.remove('align-left', 'align-center', 'align-right'); content.classList.add('align-' + d.align); }
    if (content && d.panel !== undefined) { content.classList.toggle('has-panel', !!d.panel); }
    if (d.parallax !== undefined) {
      if (d.parallax) { hero.setAttribute('data-parallax', ''); }
      else { hero.removeAttribute('data-parallax'); hero.querySelectorAll('.hero-slide').forEach(function (s) { s.style.transform = ''; }); }
    }
  }

  function navRender(items) {
    var wrap = document.querySelector('.subnav .wrap');
    if (!wrap) return;
    var existing = {};
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-nav-item]'), function (a) {
      existing[a.getAttribute('data-gallery-id')] = a;
    });
    var wanted = {};
    items.forEach(function (it) { wanted[it.galleryId] = true; });
    Object.keys(existing).forEach(function (id) { if (!wanted[id]) animateOut(existing[id]); });

    var prev = wrap.querySelector('[data-nav-home]') || wrap.firstChild;
    items.forEach(function (it) {
      var a = existing[it.galleryId];
      if (!a) {
        a = document.createElement('a');
        a.setAttribute('data-nav-item', '');
        a.setAttribute('data-gallery-id', it.galleryId);
        a.className = 'nav-anim entering';
        a.href = it.href; a.textContent = it.label;
        wrap.insertBefore(a, prev.nextSibling);
        requestAnimationFrame(function () { requestAnimationFrame(function () { a.classList.remove('entering'); }); });
      } else {
        a.classList.add('nav-anim');
        a.href = it.href;
        if (a.textContent !== it.label) a.textContent = it.label;
        wrap.insertBefore(a, prev.nextSibling);
      }
      a.classList.toggle('active', !!it.active);
      prev = a;
    });
  }
  function animateOut(a) {
    a.classList.add('nav-anim');
    requestAnimationFrame(function () { a.classList.add('leaving'); });
    var kill = function () { if (a.parentNode) a.parentNode.removeChild(a); };
    a.addEventListener('transitionend', kill, { once: true });
    setTimeout(kill, 400);
  }

  function reload(fragment, path) {
    var token = currentToken();
    var p = (path !== undefined && path !== null) ? path : currentPath();
    var url = '/api/site/editor/render?token=' + encodeURIComponent(token)
      + '&path=' + encodeURIComponent(p) + '&fragment=' + encodeURIComponent(fragment);
    fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
      if (fragment === 'hero') swapHero(html);
      else if (fragment === 'subnav') swapOuter('nav.subnav', html);
      else if (fragment === 'main') { var m = document.querySelector('main'); if (m) { m.innerHTML = html; } }
    }).catch(function () {});
  }
  function swapHero(html) {
    var existing = document.querySelector('.hero');
    if (!html.trim()) { if (existing) existing.parentNode.removeChild(existing); return; }
    var node = parse(html);
    if (existing) existing.parentNode.replaceChild(node, existing);
    else { var header = document.querySelector('.topnav'); header.parentNode.insertBefore(node, header.nextSibling); }
    initHero(node);
  }
  function swapOuter(sel, html) {
    var el = document.querySelector(sel);
    if (!el) return;
    var node = parse(html);
    if (node) el.parentNode.replaceChild(node, el);
  }
  function parse(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function setText(path, value) {
    var el = document.querySelector('[data-editable="' + path + '"]');
    if (el && document.activeElement !== el) {
      el.textContent = value || '';
      el.classList.toggle('is-empty', !value);
    }
  }
  function selectByRegion(region, id) {
    var sel = '[data-edit-region="' + region + '"]';
    if (id) sel = '[data-edit-region="' + region + '"][data-gallery-id="' + id + '"], [data-edit-region="' + region + '"][data-page-id="' + id + '"]';
    selectRegion(document.querySelector(sel));
  }
  function pulse(region, id) {
    var el = document.querySelector('[data-edit-region="' + region + '"]');
    if (!el) return;
    el.classList.remove('fotolio-pulse'); void el.offsetWidth; el.classList.add('fotolio-pulse');
  }
  function scrollToRegion(region, id) {
    var el = document.querySelector('[data-edit-region="' + region + '"]');
    if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  /* ---- Behaviour for reloaded heroes (theme.js only binds the initial one) - */
  function initHero(hero) {
    if (!hero || hero.__fxBound) return;
    if (hero.hasAttribute('data-slideshow')) {
      var slides = [].slice.call(hero.querySelectorAll('.hero-slide'));
      if (slides.length > 1) {
        var dots = [].slice.call(hero.querySelectorAll('.hero-dots button'));
        var i = 0, timer = null;
        var interval = parseInt(hero.getAttribute('data-interval'), 10) || 5000;
        var autoplay = hero.getAttribute('data-autoplay') === '1';
        var go = function (n) {
          slides[i].classList.remove('active'); if (dots[i]) dots[i].classList.remove('active');
          i = (n + slides.length) % slides.length;
          slides[i].classList.add('active'); if (dots[i]) dots[i].classList.add('active');
        };
        var next = function () { go(i + 1); }, prev = function () { go(i - 1); };
        var stop = function () { if (timer) clearInterval(timer); };
        var start = function () { if (autoplay && !reduce) { stop(); timer = setInterval(next, interval); } };
        var nb = hero.querySelector('[data-next]'); if (nb) nb.onclick = function () { next(); start(); };
        var pb = hero.querySelector('[data-prev]'); if (pb) pb.onclick = function () { prev(); start(); };
        dots.forEach(function (d, idx) { d.onclick = function () { go(idx); start(); }; });
        start();
      }
    }
    var rot = hero.querySelector('[data-rotator]');
    if (rot) {
      var words = [].slice.call(rot.querySelectorAll('.word'));
      if (words.length) {
        if (reduce) { words[0].classList.add('reveal'); words[0].style.opacity = 1; words[0].style.transform = 'none'; }
        else { var j = 0; var cyc = function () { words.forEach(function (w) { w.classList.remove('reveal'); }); void words[j].offsetWidth; words[j].classList.add('reveal'); j = (j + 1) % words.length; }; cyc(); setInterval(cyc, 4500); }
      }
    }
    hero.__fxBound = true;
  }

  /* Generic parallax that also covers reloaded heroes. */
  if (!reduce) {
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      document.querySelectorAll('[data-parallax] .hero-slide').forEach(function (el) {
        el.style.transform = 'translateY(' + (y * 0.28) + 'px)';
      });
    }, { passive: true });
  }

  /* ---- Announce readiness ------------------------------------------------- */
  post('ready', { ctx: CTX });
})();
