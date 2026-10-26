(function () {
  "use strict";
  var SITE = window.SITE || {};
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  // --- names and contacts from config.js ---------------------------------
  if (SITE.studio) $$("[data-studio]").forEach(function (el) { el.textContent = SITE.studio; });
  if (SITE.studioUrl) $$("[data-studio-link]").forEach(function (el) { el.href = SITE.studioUrl; });
  if (SITE.email) $$("[data-email]").forEach(function (el) {
    el.href = "mailto:" + SITE.email;
    el.textContent = SITE.email;
  });
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  if (SITE.steamAppId) $$("[data-wishlist]").forEach(function (el) {
    el.href = "https://store.steampowered.com/app/" + SITE.steamAppId + "/";
  });

  // --- Steam widget ---------------------------------------------------------
  var slot = document.querySelector("[data-steam-widget]");
  if (slot && SITE.steamWidget && SITE.steamAppId) {
    var f = document.createElement("iframe");
    f.src = "https://store.steampowered.com/widget/" + SITE.steamAppId + "/";
    f.title = "Flurry Fray on Steam";
    f.loading = "lazy";
    f.width = "646";
    f.height = "190";
    f.setAttribute("frameborder", "0");
    slot.appendChild(f);
    slot.hidden = false;
  }

  // --- looping clips: play only while on screen -----------------------------
  var loops = $$("video[data-loop]");
  if (reduce || !("IntersectionObserver" in window)) {
    loops.forEach(function (v) { v.controls = true; });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload === "none") v.preload = "auto";
          var p = v.play();
          if (p && p.catch) p.catch(function () { v.controls = true; });
        } else {
          v.pause();
        }
      });
    }, { rootMargin: "200px 0px", threshold: 0.15 });
    loops.forEach(function (v) { io.observe(v); });
  }

  // --- floating Wishlist button once the hero is gone -----------------------
  var hero = document.querySelector(".hero");
  var floatBtn = document.querySelector(".float-wish");
  var ctaBlock = document.querySelector(".facts .cta");
  if (hero && floatBtn && "IntersectionObserver" in window) {
    var heroGone = false, ctaSeen = false, sceneSeen = false;
    var sync = function () {
      // Off in the hero, by the other Wishlist button and over the snowball scene.
      var on = heroGone && !ctaSeen && !sceneSeen;
      floatBtn.classList.toggle("is-on", on);
      floatBtn.setAttribute("aria-hidden", on ? "false" : "true");
      floatBtn.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(function (e) { heroGone = !e[0].isIntersecting; sync(); }).observe(hero);
    var scene = document.querySelector("[data-scene]");
    if (scene) new IntersectionObserver(function (e) { sceneSeen = e[0].isIntersecting; sync(); }).observe(scene);
    if (ctaBlock) new IntersectionObserver(function (e) { ctaSeen = e[0].isIntersecting; sync(); }).observe(ctaBlock);
  }

  // --- gallery lightbox ----------------------------------------------------
  var box = document.querySelector(".lightbox");
  var shots = $$("[data-shot]");
  if (box && box.showModal && shots.length) {
    var img = box.querySelector("img");
    var at = 0;
    var show = function (i) {
      at = (i + shots.length) % shots.length;
      img.src = shots[at].getAttribute("href");
      img.alt = shots[at].querySelector("img").alt;
    };
    shots.forEach(function (a, i) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        show(i);
        box.showModal();
      });
    });
    box.querySelector(".lightbox__close").addEventListener("click", function () { box.close(); });
    box.querySelector(".lightbox__prev").addEventListener("click", function () { show(at - 1); });
    box.querySelector(".lightbox__next").addEventListener("click", function () { show(at + 1); });
    box.addEventListener("click", function (ev) { if (ev.target === box) box.close(); });
    box.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") show(at - 1);
      if (ev.key === "ArrowRight") show(at + 1);
    });
    var x0 = null;
    box.addEventListener("touchstart", function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (ev) {
      if (x0 === null) return;
      var dx = ev.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(at + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  // --- snowfall over the hero ----------------------------------------------
  var canvas = document.querySelector(".snow");
  if (!canvas || reduce || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var flakes = [], w = 0, h = 0, dpr = 1, running = false, visible = true, last = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(90, w * h / 14000));
    while (flakes.length < n) flakes.push(make(true));
    flakes.length = n;
  }
  function make(anywhere) {
    var r = 1 + Math.random() * 2.6;
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : -6,
      r: r, vy: 14 + r * 11, sway: 8 + Math.random() * 16,
      ph: Math.random() * 6.28, a: 0.55 + Math.random() * 0.4,
    };
  }
  function frame(t) {
    if (!running) return;
    var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.vy * dt; f.ph += dt * 0.9;
      var x = f.x + Math.sin(f.ph) * f.sway;
      if (f.y > h + 6) { flakes[i] = make(false); continue; }
      ctx.globalAlpha = f.a;
      ctx.beginPath(); ctx.arc(x, f.y, f.r, 0, 6.2832); ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  function setRunning() {
    var want = visible && !document.hidden;
    if (want && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    if (!want) running = false;
  }
  ctx.fillStyle = "#fff";
  resize();
  ctx.fillStyle = "#fff";
  window.addEventListener("resize", function () { resize(); ctx.fillStyle = "#fff"; });
  document.addEventListener("visibilitychange", setRunning);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; setRunning(); }).observe(canvas);
  }
  setRunning();
})();
