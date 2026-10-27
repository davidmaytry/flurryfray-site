/* SS-522/523: a snow cap on top of clips, screenshots, cards and the ice
   buttons — the same cap the game draws on its UI (shaders/snow_crust
   .gdshaderinc in the game repo, ported number for number):
   * a band of snow along the top edge that rises 5–14 px above it in lumps
     and hangs 5–14 px over the picture in soft round sags (no sharp icicles);
   * it follows the rounded corners and dies out a little way down the sides;
   * white on top, bluish underneath, with a soft blue shadow on the picture.
   Every box has its own seed, so no two caps are the same. The shape is
   redrawn in real pixels whenever the box changes size. Without JS there is
   simply no cap. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var PAD = 40;                    // room around the box for the snow and its shadow
  var boxes = Array.prototype.slice.call(document.querySelectorAll("[data-snow]"));
  if (!boxes.length || !document.createElementNS) return;

  // --- the game's noise: integer hash per cell, smooth value noise --------
  function hash(n, seed) {
    var h = ((Math.floor(n) + 65536) + Math.imul(seed, 7919)) >>> 0;
    h = (Math.imul(h, 747796405) + 2891336453) >>> 0;
    h = Math.imul(((h >>> ((h >>> 28) + 4)) ^ h) >>> 0, 277803737) >>> 0;
    h = ((h >>> 22) ^ h) >>> 0;
    return (h & 16777215) / 16777215;
  }
  function noise(x, seed) {
    var i = Math.floor(x), t = x - i;
    t = t * t * (3 - 2 * t);
    return hash(i, seed) * (1 - t) + hash(i + 1, seed) * t;
  }
  function sstep(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function lump(s, seed) { return noise(s / 38 + 3, seed) * 0.65 + noise(s / 11, seed) * 0.35; }
  function f(n) { return Math.round(n * 10) / 10; }

  /* Points along the top of a rounded rectangle W×H with corner radius r:
     up the left side, over the corner, along the top, down the right side.
     Each point: position, outward normal, distance along the edge (as the
     shader counts it) and how much the edge faces up. */
  function contour(W, H, r, yEnd) {
    var pts = [], step = 2, y, a, i;
    function push(x, y, nx, ny, s, upn) { pts.push({ x: x, y: y, nx: nx, ny: ny, s: s, upn: upn }); }
    for (y = yEnd; y > r; y -= step) push(0, y, -1, 0, -(y - r), 0);
    var n = Math.max(2, Math.ceil(r * Math.PI / 2 / step));
    for (i = 0; i <= n; i++) {
      a = Math.PI + (Math.PI / 2) * (i / n);
      push(r + Math.cos(a) * r, r + Math.sin(a) * r, Math.cos(a), Math.sin(a), r + Math.cos(a) * r, -Math.sin(a));
    }
    for (var x = r + step; x < W - r; x += step) push(x, 0, 0, -1, x, 1);
    for (i = 0; i <= n; i++) {
      a = -Math.PI / 2 + (Math.PI / 2) * (i / n);
      push(W - r + Math.cos(a) * r, r + Math.sin(a) * r, Math.cos(a), Math.sin(a), W - r + Math.cos(a) * r, -Math.sin(a));
    }
    for (y = r + step; y <= yEnd; y += step) push(W, y, 1, 0, W + (y - r), 0);
    return pts;
  }

  function shape(W, H, r, k, seed) {
    var yEnd = Math.min(H * 0.6, r + 8 * k);
    var pts = contour(W, H, r, yEnd), out = [], inn = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], s = p.s / k;              // lumps keep their size in game points
      var up = sstep(0.05, 0.8, p.upn), upO = sstep(0.55, 0.98, p.upn);
      var side = (1 - sstep(r * 0.3, yEnd, p.y)) * 0.6;
      var w = Math.max(up, side), fade = sstep(0, 0.45, w);
      var o = k * (upO * (3.5 + 9 * lump(s, seed)) + up * 1.5) * fade;
      var d = k * (w * (5 + 5 * noise(s / 16 + 9, seed)) + up * 4 * sstep(0.5, 0.95, noise(s / 22 + 5, seed))) * fade;
      out.push(f(p.x + p.nx * o) + " " + f(p.y + p.ny * o));
      inn.push(f(p.x - p.nx * d) + " " + f(p.y - p.ny * d));
    }
    return "M" + out.join("L") + "L" + inn.reverse().join("L") + "Z";
  }

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  }

  function draw(box) {
    var W = box.offsetWidth, H = box.offsetHeight;
    if (!W || !H) return;
    var r = parseFloat(getComputedStyle(box).borderTopLeftRadius) || 0;
    var key = W + "x" + H + "r" + r;
    if (box._snowKey === key) return;
    box._snowKey = key;
    r = Math.min(r, W / 2, H / 2);
    // Game buttons are drawn at k = 1; big clips get a thicker cap, thumbnails a thinner one.
    var k = box.getAttribute("data-snow") === "btn" ? Math.max(0.75, Math.min(1, W / 260))
                                                    : Math.max(0.6, Math.min(1.7, W / 400));
    var svg = box._snowSvg, id = box._snowId;
    svg.setAttribute("viewBox", [-PAD, -PAD, W + 2 * PAD, H + 2 * PAD].join(" "));
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var defs = el("defs", {});
    var g = el("linearGradient", { id: id, gradientUnits: "userSpaceOnUse", x1: 0, y1: -14 * k, x2: 0, y2: 14 * k });
    g.appendChild(el("stop", { offset: 0.45, "stop-color": "#ffffff" }));
    g.appendChild(el("stop", { offset: 1, "stop-color": "#d2e5fb" }));
    defs.appendChild(g);
    svg.appendChild(defs);
    svg.appendChild(el("path", { d: shape(W, H, r, k, box._snowSeed), fill: "url(#" + id + ")" }));
  }

  var queued = [];
  function flush() { var q = queued; queued = []; q.forEach(draw); }
  function queue(box) {
    if (queued.indexOf(box) < 0) queued.push(box);
    if (queued.length === 1) requestAnimationFrame(flush);
  }
  var ro = "ResizeObserver" in window ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) { queue(e.target); });
  }) : null;

  boxes.forEach(function (box, i) {
    box._snowSeed = 31 + i * 17;
    box._snowId = "snowcap" + i;
    var svg = el("svg", { class: "snowcap", "aria-hidden": "true", focusable: "false" });
    box._snowSvg = svg;
    box.appendChild(svg);
    box.classList.add("snowed");
    if (ro) ro.observe(box); else draw(box);
  });
  if (!ro) window.addEventListener("resize", function () { boxes.forEach(queue); });
})();
