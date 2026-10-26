// SS-496: the scroll-driven snowball scene.
//
// Red on the left throws, the snowball arcs right and down, blue on the right
// takes it in the face and falls on his back. Scroll progress 0..1 through the
// tall .scene section drives it forwards and backwards:
//   0    – 0.35  thrower plays the throw
//   0.35 – 0.6   the ball flies
//   0.6  – 0.7   hit: target_hit frames + splash
//   0.7  – 1     target_fall frames
// Only requestAnimationFrame and transforms; no libraries.
//
// Sprites come from img/scene/meta.json (copied in by tools/import_sprites.py).
// Without it the scene runs on placeholder shapes. Expected meta.json:
// {
//   "thrower":     { "file": "thrower.webp", "frames": 24, "cols": 6,
//                    "fw": 512, "fh": 512,          // one frame, px
//                    "anchor": [0.5, 0.95],        // feet, 0..1 of the frame
//                    "hand":   [0.8, 0.3],         // where the ball leaves, 0..1
//                    "facing": "right",            // which way the art looks
//                    "height": 0.9 },              // character height / frame height
//   "target_hit":  { ..., "face": [0.45, 0.3], "facing": "left" },
//   "target_fall": { ... },
//   "snowball":    { "file": "snowball.webp", "frames": 1, ... },
//   "splash":      { "file": "splash.webp", "frames": 8, ... }
// }
// "file" may also be "image"/"src", "frames" may be "count", "cols" may be
// "columns", "fw"/"fh" may be "frame_w"/"frame_h" or "w"/"h". Anything missing
// gets a sensible default.
(function () {
  "use strict";
  var root = document.querySelector("[data-scene]");
  if (!root) return;
  var stage = root.querySelector(".scene__stage");
  var world = root.querySelector(".scene__world");
  var hint = root.querySelector(".scene__hint");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BASE = "img/scene/";
  var HIT_POSE = 0.66; // the still frame for reduced motion

  // Two stage shapes: wide screens throw sideways, phones throw down a slope,
  // so the kids stay big and are never cut off.
  var LAYOUTS = {
    wide: {
      W: 1600, H: 900, charH: 420,
      thrower: { x: 380, y: 700 }, target: { x: 1150, y: 815 },
      mounds: [{ cx: 340, cy: 870, rx: 640, ry: 170 }], base: 800, lift: 260,
    },
    tall: {
      W: 800, H: 1300, charH: 400,
      thrower: { x: 175, y: 600 }, target: { x: 395, y: 1160 },
      mounds: [{ cx: 60, cy: 1180, rx: 470, ry: 580 }], base: 1150, lift: 170,
    },
  };
  var L = LAYOUTS.wide;

  // ---------- small helpers ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function el(cls, parent) {
    var d = document.createElement("div");
    d.className = cls;
    (parent || world).appendChild(d);
    return d;
  }
  function pick(o, keys, dflt) {
    for (var i = 0; i < keys.length; i++) if (o && o[keys[i]] != null) return o[keys[i]];
    return dflt;
  }

  // ---------- sprite sheets ----------
  function Sheet(def, img) {
    this.img = img;
    this.n = pick(def, ["frames", "count"], 1);
    this.fw = pick(def, ["fw", "frame_w", "w"], img.naturalWidth);
    this.fh = pick(def, ["fh", "frame_h", "h"], img.naturalHeight);
    this.cols = pick(def, ["cols", "columns"], Math.max(1, Math.floor(img.naturalWidth / this.fw)));
    this.anchor = pick(def, ["anchor"], [0.5, 0.95]);
    this.hand = pick(def, ["hand"], [0.8, 0.3]);
    this.face = pick(def, ["face"], [0.45, 0.3]);
    this.facing = pick(def, ["facing"], null);
    this.height = pick(def, ["height"], 0.9);
    this.box = null;
  }
  // A clipped box of one frame; the whole sheet moves inside it by transform.
  Sheet.prototype.mount = function (parent) {
    var box = el("sprite", parent);
    box.style.width = this.fw + "px";
    box.style.height = this.fh + "px";
    var im = this.img.cloneNode();
    im.alt = "";
    im.style.width = this.img.naturalWidth + "px";
    im.style.height = this.img.naturalHeight + "px";
    box.appendChild(im);
    this.box = box;
    this.inner = im;
    this.cur = -1;
    return box;
  };
  Sheet.prototype.frame = function (t) {
    var f = clamp(Math.floor(t * this.n), 0, this.n - 1);
    if (f === this.cur) return;
    this.cur = f;
    var c = f % this.cols, r = Math.floor(f / this.cols);
    this.inner.style.transform = "translate(" + (-c * this.fw) + "px," + (-r * this.fh) + "px)";
  };

  function loadSprites() {
    if (!window.fetch) return Promise.resolve(null);
    return fetch(BASE + "meta.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (meta) {
        var names = {
          thrower: ["thrower"], hit: ["target_hit"], fall: ["target_fall"],
          ball: ["snowball", "ball"], splash: ["splash", "splat", "burst"],
        };
        var out = {}, waits = [];
        Object.keys(names).forEach(function (k) {
          var def = null;
          names[k].forEach(function (n) { if (!def && meta[n]) def = meta[n]; });
          var file = def && pick(def, ["file", "image", "src"], null);
          if (!file) return;
          waits.push(new Promise(function (ok) {
            var im = new Image();
            im.onload = function () { out[k] = new Sheet(def, im); ok(); };
            im.onerror = function () { ok(); };
            im.src = BASE + file;
          }));
        });
        return Promise.all(waits).then(function () {
          // The kids must both be there; the ball and splash may fall back to shapes.
          return out.thrower && out.hit && out.fall ? out : null;
        });
      })
      .catch(function () { return null; });
  }

  // ---------- actors ----------
  var A = {}; // thrower, target, ball, splash, shadows

  function buildPlaceholders() {
    var t = A.thrower = el("actor actor--red");
    el("ph-body", t);
    el("ph-hat", el("ph-head", t));
    var arm = A.arm = el("ph-arm", t);
    A.handBall = el("ph-ball ph-ball--hand", arm);
    var g = A.target = el("actor actor--blue");
    el("ph-body", g);
    A.targetHead = el("ph-head", g);
    el("ph-hat", A.targetHead);
  }

  function buildSprites(S) {
    A.sheets = S;
    A.thrower = el("actor");
    A.thrower.appendChild(S.thrower.mount(A.thrower));
    A.target = el("actor");
    S.hit.mount(A.target);
    S.fall.mount(A.target);
  }

  function buildCommon(S) {
    A.ball = el("ball");
    if (S && S.ball) S.ball.mount(A.ball); else el("ph-ball", A.ball);
    A.splash = el("splash");
    if (S && S.splash) {
      S.splash.mount(A.splash);
    } else {
      A.bits = [];
      for (var i = 0; i < 12; i++) A.bits.push(el("ph-bit", A.splash));
    }
  }

  // Scale and flip a sprite so its feet sit on (0,0) of its actor and it looks the right way.
  function placeSheet(sh, wantFacing) {
    var s = L.charH / (sh.fh * sh.height);
    var flip = sh.facing && sh.facing !== wantFacing ? -1 : 1;
    var ax = sh.anchor[0] * sh.fw, ay = sh.anchor[1] * sh.fh;
    sh.box.style.transform = "scale(" + (s * flip) + "," + s + ") translate(" + (-ax) + "px," + (-ay) + "px)";
    sh.scale = s;
    sh.flip = flip;
  }
  // A point given as 0..1 of a frame, in world units, for an actor standing at (x, y).
  function framePoint(sh, pt, x, y) {
    return {
      x: x + (pt[0] - sh.anchor[0]) * sh.fw * sh.scale * sh.flip,
      y: y + (pt[1] - sh.anchor[1]) * sh.fh * sh.scale,
    };
  }

  // ---------- scenery ----------
  var ground = [];
  function buildGround() {
    ground.forEach(function (g) { g.remove(); });
    ground = [];
    var base = el("snow-base");
    base.style.transform = "translate(-2000px," + L.base + "px)";
    ground.push(base);
    L.mounds.forEach(function (m) {
      var d = el("snow-mound");
      d.style.width = m.rx * 2 + "px";
      d.style.height = m.ry * 2 + "px";
      d.style.transform = "translate(" + (m.cx - m.rx) + "px," + (m.cy - m.ry) + "px)";
      ground.push(d);
    });
    ["thrower", "target"].forEach(function (k) {
      var s = el("shadow");
      s.style.transform = "translate(" + (L[k].x - 110) + "px," + (L[k].y - 22) + "px)";
      ground.push(s);
    });
    // Scenery goes under the kids.
    ground.slice().reverse().forEach(function (g) { world.insertBefore(g, world.firstChild); });
  }

  // ---------- fit the world into the stage ----------
  var hand, face;
  function layout() {
    var w = stage.clientWidth, h = stage.clientHeight;
    var next = w / h < 1.05 ? LAYOUTS.tall : LAYOUTS.wide;
    var changed = next !== L || !ground.length;
    L = next;
    var s = Math.min(w / L.W, (h * 0.92) / L.H);
    var ox = (w - L.W * s) / 2, oy = h - L.H * s - h * 0.02;
    world.style.width = L.W + "px";
    world.style.height = L.H + "px";
    world.style.transform = "translate(" + ox + "px," + oy + "px) scale(" + s + ")";
    if (changed) buildGround();
    A.thrower.style.transform = "translate(" + L.thrower.x + "px," + L.thrower.y + "px)";
    if (A.sheets) {
      placeSheet(A.sheets.thrower, "right");
      placeSheet(A.sheets.hit, "left");
      placeSheet(A.sheets.fall, "left");
      hand = framePoint(A.sheets.thrower, A.sheets.thrower.hand, L.thrower.x, L.thrower.y);
      face = framePoint(A.sheets.hit, A.sheets.hit.face, L.target.x, L.target.y);
    } else {
      // Placeholder kid (see .ph-* in site.css): shoulder at (30, -170), arm 130
      // long, released at +60 degrees; the head's centre is 255 above the feet.
      hand = { x: L.thrower.x + 142, y: L.thrower.y - 235 };
      face = { x: L.target.x - 50, y: L.target.y - 215 };
    }
    if (A.sheets && A.sheets.ball) {
      var b = A.sheets.ball;
      var bs = 70 / Math.max(b.fw, b.fh);
      b.box.style.transform = "scale(" + bs + ") translate(" + (-b.fw / 2) + "px," + (-b.fh / 2) + "px)";
    }
    if (A.sheets && A.sheets.splash) {
      var sp = A.sheets.splash;
      var ss = 340 / Math.max(sp.fw, sp.fh);
      sp.box.style.transform = "scale(" + ss + ") translate(" + (-sp.fw / 2) + "px," + (-sp.fh / 2) + "px)";
    }
    drawn = -1;
  }

  // ---------- one pose for progress p ----------
  var drawn = -1;
  function draw(p) {
    if (Math.abs(p - drawn) < 0.0005) return;
    drawn = p;
    var throwT = seg(p, 0, 0.35), flyT = seg(p, 0.35, 0.6), hitT = seg(p, 0.6, 0.7), fallT = seg(p, 0.7, 1);
    var S = A.sheets;

    // Thrower.
    if (S) {
      S.thrower.frame(throwT);
    } else {
      // Wind back, then whip forward; the ball leaves at the end.
      var ang = throwT < 0.6 ? -150 * ease(throwT / 0.6) : -150 + 210 * ease((throwT - 0.6) / 0.4);
      A.arm.style.transform = "translate(10px,-300px) rotate(" + ang + "deg)";
      A.handBall.style.opacity = p < 0.35 ? 1 : 0;
      A.thrower.style.transform = "translate(" + L.thrower.x + "px," + L.thrower.y + "px) rotate(" + (throwT < 0.6 ? -4 * ease(throwT / 0.6) : -4 + 10 * ease((throwT - 0.6) / 0.4)) + "deg)";
    }

    // Ball: quadratic arc from the hand to the face.
    if (p >= 0.35 && p < 0.6) {
      var t = flyT;
      var cx = (hand.x + face.x) / 2, cy = Math.min(hand.y, face.y) - L.lift;
      var x = (1 - t) * (1 - t) * hand.x + 2 * (1 - t) * t * cx + t * t * face.x;
      var y = (1 - t) * (1 - t) * hand.y + 2 * (1 - t) * t * cy + t * t * face.y;
      A.ball.style.transform = "translate(" + x + "px," + y + "px) rotate(" + (t * 540) + "deg) scale(" + (0.9 + 0.25 * t) + ")";
      A.ball.style.visibility = "visible";
    } else {
      A.ball.style.visibility = "hidden";
    }

    // Splash at the face.
    var splashT = seg(p, 0.6, 0.76);
    if (splashT > 0 && splashT < 1) {
      A.splash.style.visibility = "visible";
      A.splash.style.transform = "translate(" + face.x + "px," + face.y + "px)";
      if (S && S.splash) {
        S.splash.frame(splashT);
      } else {
        A.bits.forEach(function (b, i) {
          var a = -Math.PI * 0.95 + (i / (A.bits.length - 1)) * Math.PI * 1.5;
          var r = 30 + 170 * ease(splashT) * (0.6 + 0.4 * ((i * 7) % 5) / 4);
          var fall = 120 * splashT * splashT;
          var k = 1 - 0.7 * splashT;
          b.style.transform = "translate(" + (Math.cos(a) * r) + "px," + (Math.sin(a) * r + fall) + "px) scale(" + k + ")";
        });
      }
    } else {
      A.splash.style.visibility = "hidden";
    }

    // Target.
    if (S) {
      var falling = p >= 0.7;
      S.hit.box.style.visibility = falling ? "hidden" : "visible";
      S.fall.box.style.visibility = falling ? "visible" : "hidden";
      S.hit.frame(p < 0.6 ? 0 : hitT);
      S.fall.frame(fallT);
      A.target.style.transform = "translate(" + L.target.x + "px," + L.target.y + "px)";
    } else {
      // Head snaps back on the hit, then the whole kid tips over backwards.
      var headRot = p < 0.6 ? 0 : 28 * Math.sin(hitT * Math.PI * 0.5);
      A.targetHead.style.transform = "translate(-75px,-330px) rotate(" + headRot + "deg)";
      var lean = p < 0.6 ? 0 : 6 * Math.sin(hitT * Math.PI);
      var fall = 84 * ease(fallT);
      var slide = 20 * ease(fallT);
      A.target.style.transform = "translate(" + (L.target.x + slide) + "px," + L.target.y + "px) rotate(" + (lean + fall) + "deg)";
    }

    if (hint) hint.style.opacity = String(1 - seg(p, 0.02, 0.12));
  }

  // ---------- scroll progress ----------
  var target = 0, shown = 0, running = false;
  function measure() {
    var r = root.getBoundingClientRect();
    var span = r.height - stage.clientHeight;
    target = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
  }
  function tick() {
    // Ease towards the scroll position: wheel steps turn into smooth motion.
    shown += (target - shown) * 0.2;
    if (Math.abs(target - shown) < 0.0008) shown = target;
    draw(shown);
    if (shown !== target) requestAnimationFrame(tick);
    else running = false;
  }
  function kick() {
    measure();
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function start(S) {
    if (S) buildSprites(S); else buildPlaceholders();
    buildCommon(S);
    root.classList.add(S ? "scene--sprites" : "scene--placeholder");
    layout();
    window.addEventListener("resize", function () { layout(); kick(); });
    if (reduce) {
      root.classList.add("scene--still");
      layout();
      draw(HIT_POSE);
      return;
    }
    root.classList.add("scene--live");
    layout();
    measure();
    shown = target;
    draw(shown);
    window.addEventListener("scroll", kick, { passive: true });
  }

  loadSprites().then(start);
})();
