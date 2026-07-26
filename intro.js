/* ============================================================
   QENTINA — Ouverture cinématique (100 % canvas)
   ------------------------------------------------------------
   Rideau sombre, braises montantes, logo qui s'illumine,
   « QENTINA » qui se resserre dans la lumière, puis le rideau
   s'ouvre en deux sur le site. ~3 s, une fois par visite,
   skippable (clic / touche / molette / toucher), désactivée si
   l'utilisateur préfère réduire les animations.
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!document.body || document.body.getAttribute("data-intro") !== "1") return;
  try {
    if (sessionStorage.getItem("qentina-intro")) return;
    sessionStorage.setItem("qentina-intro", "1");
  } catch (e) { /* navigation privée : on joue l'intro quand même */ }

  var docEl = document.documentElement;
  docEl.classList.add("has-intro");

  var canvas = document.createElement("canvas");
  canvas.className = "intro-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W, H;
  function size() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  window.addEventListener("resize", size);

  /* Logo (affiché dès qu'il est prêt) */
  var logo = new Image();
  var logoReady = false;
  logo.onload = function () { logoReady = true; };
  logo.src = "logo.jpg";

  /* Police d'affichage (repli serif élégant si pas encore chargée) */
  if (document.fonts && document.fonts.load) {
    document.fonts.load('500 60px "Fraunces"').catch(function () {});
  }

  /* Braises */
  var N = W < 700 ? 90 : 160;
  var parts = [];
  for (var i = 0; i < N; i++) {
    parts.push({
      x: Math.random(),
      y: Math.random() * 1.2,
      r: 1 + Math.random() * 2.6,
      rise: 0.05 + Math.random() * 0.13,
      sway: 0.4 + Math.random() * 1.1,
      phase: Math.random() * Math.PI * 2,
      tw: 0.5 + Math.random() * 0.6
    });
  }

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function phase(t, from, dur) { return ease((t - from) / dur); }

  var HOLD = 3050;          /* durée avant l'ouverture du rideau */
  var OPEN_DUR = 900;       /* durée de l'ouverture */
  var start = null;
  var openAt = null;
  var done = false;
  var removed = false;

  function drawCurtain(offset, alpha) {
    /* deux pans sombres, lueur chaude au centre */
    ctx.globalAlpha = alpha;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c2b31");
    g.addColorStop(0.5, "#071d22");
    g.addColorStop(1, "#0c2b31");
    ctx.fillStyle = g;
    ctx.fillRect(0, -offset, W, H / 2 + 1);
    ctx.fillRect(0, H / 2 + offset, W, H / 2 + 1);

    /* lueur de four au centre */
    if (offset < 4) {
      var glow = ctx.createRadialGradient(W / 2, H * 0.58, 0, W / 2, H * 0.58, Math.max(W, H) * 0.5);
      glow.addColorStop(0, "rgba(224, 122, 46, 0.16)");
      glow.addColorStop(1, "rgba(224, 122, 46, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(t, alpha) {
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var px = p.x * W + Math.sin(t * 0.001 * p.sway + p.phase) * 18;
      var py = p.y * H;
      var a = (0.35 + 0.45 * Math.sin(t * 0.002 * p.tw + p.phase)) * alpha;
      if (a <= 0) continue;
      var grad = ctx.createRadialGradient(px, py, 0, px, py, p.r * 3);
      grad.addColorStop(0, "rgba(255,214,140," + a + ")");
      grad.addColorStop(0.4, "rgba(255,170,80," + a * 0.7 + ")");
      grad.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawCenter(t, alpha) {
    var cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.globalAlpha = alpha;

    /* Logo : fondu + montée en échelle + halo doré */
    var pL = phase(t, 150, 850);
    if (pL > 0 && logoReady) {
      var s = 64 + 32 * pL;
      ctx.save();
      ctx.globalAlpha = alpha * pL;
      ctx.shadowColor = "rgba(255,170,80," + 0.75 * pL + ")";
      ctx.shadowBlur = 45 * pL;
      var r = 18;
      var x = cx - s / 2, y = cy - 118 - s / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + s, y, x + s, y + s, r);
      ctx.arcTo(x + s, y + s, x, y + s, r);
      ctx.arcTo(x, y + s, x, y, r);
      ctx.arcTo(x, y, x + s, y, r);
      ctx.closePath();
      ctx.fillStyle = "#f6f1ea";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.clip();
      ctx.drawImage(logo, x, y, s, s);
      ctx.restore();
    }

    /* « QENTINA » : lettres qui se resserrent en sortant du flou */
    var pN = phase(t, 520, 1050);
    if (pN > 0) {
      var fs = Math.min(76, Math.max(44, W * 0.055));
      var spacing = (0.52 - 0.38 * pN) * fs;   /* interlettrage qui se resserre */
      ctx.font = "500 " + fs + 'px "Fraunces", Georgia, serif';
      ctx.textBaseline = "middle";
      var word = "QENTINA";
      var widths = [], total = 0;
      for (var i = 0; i < word.length; i++) {
        var w = ctx.measureText(word[i]).width;
        widths.push(w);
        total += w + (i < word.length - 1 ? spacing : 0);
      }
      var xx = cx - total / 2;
      ctx.fillStyle = "rgba(246,241,234," + pN * alpha + ")";
      ctx.shadowColor = "rgba(255,180,90," + 0.35 * pN + ")";
      ctx.shadowBlur = 26 * (1 - pN) + 8;
      for (var j = 0; j < word.length; j++) {
        ctx.fillText(word[j], xx, cy - 6);
        xx += widths[j] + spacing;
      }
      ctx.shadowBlur = 0;
    }

    /* Devise */
    var pT = phase(t, 1350, 700);
    if (pT > 0) {
      ctx.font = "600 " + Math.max(11, Math.min(14, W * 0.011)) + 'px "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(200,144,47," + pT * alpha + ")";
      var tag = "D E   N A P L E S   À   L I S B O N N E   ·   L O U V I E R S";
      ctx.fillText(tag, cx, cy + 58);
      ctx.textAlign = "left";
    }

    /* Filet doré qui se déploie */
    var pLine = phase(t, 1650, 700);
    if (pLine > 0) {
      var lw = 190 * pLine;
      var lg = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
      lg.addColorStop(0, "rgba(200,144,47,0)");
      lg.addColorStop(0.5, "rgba(200,144,47," + 0.9 * alpha + ")");
      lg.addColorStop(1, "rgba(200,144,47,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(cx - lw / 2, cy + 92, lw, 1.6);
    }

    ctx.restore();
  }

  function finishSoon() {
    if (openAt === null) openAt = performance.now();
  }

  function cleanup() {
    if (removed) return;
    removed = true;
    document.body.style.overflow = prevOverflow;
    docEl.classList.remove("has-intro");
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  function tick(now) {
    if (removed) return;
    if (start === null) start = now;
    var t = now - start;
    if (openAt === null && t >= HOLD) openAt = now;

    ctx.clearRect(0, 0, W, H);

    if (openAt === null) {
      drawCurtain(0, 1);
      drawEmbers(t, 1);
      drawCenter(t, 1);
      /* avance les braises */
      for (var i = 0; i < parts.length; i++) {
        parts[i].y -= parts[i].rise * 0.016;
        if (parts[i].y < -0.05) { parts[i].y = 1.05; parts[i].x = Math.random(); }
      }
    } else {
      var o = easeInOut((now - openAt) / OPEN_DUR);
      /* le hero rejoue sa cascade dès que le rideau commence à s'ouvrir */
      if (o > 0.12) docEl.classList.remove("has-intro");
      drawCurtain(o * (H / 2 + 10), 1);
      drawEmbers(t, 1 - o);
      drawCenter(t, Math.max(0, 1 - o * 1.8));
      if (o >= 1) { cleanup(); return; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  canvas.addEventListener("click", finishSoon);
  window.addEventListener("keydown", finishSoon, { once: true });
  window.addEventListener("wheel", finishSoon, { once: true, passive: true });
  window.addEventListener("touchstart", finishSoon, { once: true, passive: true });
})();
