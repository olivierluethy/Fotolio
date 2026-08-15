/* Fotolio public theme behaviour. Vanilla, self-contained, no dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Top nav: solid on scroll -------------------------------------------- */
  var topnav = document.querySelector('.topnav');
  function onScroll() {
    if (!topnav) return;
    topnav.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile drawer: opens ONLY on user action (no first-render flash) ---- */
  var burger = document.querySelector('.burger');
  var navLinks = document.querySelector('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navLinks.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---- Hero slideshow ------------------------------------------------------ */
  document.querySelectorAll('[data-slideshow]').forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;
    var dots = Array.prototype.slice.call(hero.querySelectorAll('.hero-dots button'));
    var i = 0, timer = null;
    var interval = parseInt(hero.getAttribute('data-interval'), 10) || 5000;
    var autoplay = hero.getAttribute('data-autoplay') === '1';

    function go(n) {
      slides[i].classList.remove('active');
      if (dots[i]) dots[i].classList.remove('active');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('active');
      if (dots[i]) dots[i].classList.add('active');
    }
    function next() { go(i + 1); }
    function prev() { go(i - 1); }
    function start() { if (autoplay && !reduce) { stop(); timer = setInterval(next, interval); } }
    function stop() { if (timer) clearInterval(timer); }

    var nb = hero.querySelector('[data-next]'); if (nb) nb.addEventListener('click', function () { next(); start(); });
    var pb = hero.querySelector('[data-prev]'); if (pb) pb.addEventListener('click', function () { prev(); start(); });
    dots.forEach(function (d, idx) { d.addEventListener('click', function () { go(idx); start(); }); });
    start();
  });

  /* ---- Hero rotating word reveal (the reimplemented "text pops up") -------- */
  document.querySelectorAll('[data-rotator]').forEach(function (rot) {
    var words = Array.prototype.slice.call(rot.querySelectorAll('.word'));
    if (!words.length) return;
    if (reduce) { words[0].classList.add('reveal'); words[0].style.opacity = 1; words[0].style.transform = 'none'; return; }
    var i = 0;
    function cycle() {
      words.forEach(function (w) { w.classList.remove('reveal'); });
      void words[i].offsetWidth; // restart animation
      words[i].classList.add('reveal');
      i = (i + 1) % words.length;
    }
    cycle();
    setInterval(cycle, 4500);
  });

  /* ---- Parallax on hero slides -------------------------------------------- */
  if (!reduce) {
    var parallaxEls = document.querySelectorAll('[data-parallax] .hero-slide');
    if (parallaxEls.length) {
      window.addEventListener('scroll', function () {
        var y = window.scrollY;
        parallaxEls.forEach(function (el) { el.style.transform = 'translateY(' + (y * 0.28) + 'px)'; });
      }, { passive: true });
    }
  }

  /* ---- Lightbox: symmetric open (grow from tile) / close (shrink back) ----- */
  var tiles = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
  if (tiles.length) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.innerHTML =
      '<button class="lb-close" aria-label="Close">&#10005;</button>' +
      '<button class="lb-prev" aria-label="Previous">&#8249;</button>' +
      '<button class="lb-next" aria-label="Next">&#8250;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(lb);
    var fig = lb.querySelector('figure');
    var img = lb.querySelector('img');
    var cap = lb.querySelector('figcaption');
    var current = -1;

    function setOrigin(tile) {
      var r = tile.getBoundingClientRect();
      var ox = ((r.left + r.width / 2) / window.innerWidth) * 100;
      var oy = ((r.top + r.height / 2) / window.innerHeight) * 100;
      fig.style.setProperty('--lb-ox', ox + '%');
      fig.style.setProperty('--lb-oy', oy + '%');
    }
    function show(idx, tile) {
      current = idx;
      var t = tiles[idx];
      img.src = t.getAttribute('data-full');
      img.alt = t.getAttribute('data-alt') || '';
      var loc = t.getAttribute('data-loc');
      cap.innerHTML = (t.getAttribute('data-title') || '') + (loc ? ' <span class="loc">· ' + loc + '</span>' : '');
    }
    function open(idx) {
      setOrigin(tiles[idx]);
      show(idx, tiles[idx]);
      lb.classList.add('show');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { requestAnimationFrame(function () { lb.classList.add('in'); }); });
    }
    function close() {
      // reverse: shrink back toward the current tile, then hide
      if (tiles[current]) setOrigin(tiles[current]);
      lb.classList.remove('in');
      var done = function () {
        lb.classList.remove('show');
        document.body.style.overflow = '';
        fig.removeEventListener('transitionend', done);
      };
      fig.addEventListener('transitionend', done);
    }
    function step(dir) {
      var n = (current + dir + tiles.length) % tiles.length;
      // quick swap without full close
      show(n, tiles[n]);
    }

    tiles.forEach(function (t, idx) {
      t.addEventListener('click', function () { open(idx); });
      t.setAttribute('tabindex', '0');
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(idx); } });
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
    lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('show')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* ---- Scroll reveal ------------------------------------------------------- */
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.style.opacity = 1; en.target.style.transform = 'none'; io.unobserve(en.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.style.opacity = 0; el.style.transform = 'translateY(12px)';
      el.style.transition = 'opacity .5s var(--ease-out), transform .5s var(--ease-out)';
      io.observe(el);
    });
  }
})();
