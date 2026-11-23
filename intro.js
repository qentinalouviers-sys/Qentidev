/* ============================================================
   QENTINA — Ouverture cinématique · édition Noël (100 % canvas)
   ------------------------------------------------------------
   Nuit bleu canard, guirlande de « luminarie » qui s'allume
   ampoule après ampoule, neige fine et poussière d'or, étoile
   azulejo au-dessus du logo, « QENTINA » qui se resserre dans la
   lumière, « Buon Natale · Feliz Natal », puis le rideau s'ouvre
   en deux sur le site. ~3,5 s, une fois par visite, skippable
   (clic / touche / molette / toucher), désactivée si l'utilisateur
   préfère réduire les animations.
   Version hors fêtes (braises) : historique git de intro.js.
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
  var bulbs = [];
  var swags = [];

  /* Guirlande : festons suspendus au bord haut, ampoules le long du fil */
  function buildGarland() {
    bulbs = []; swags = [];
    var span = W < 700 ? 118 : 190;
    var n = Math.max(3, Math.round(W / span));
    span = W / n;
    var sag = Math.min(34, span * 0.2);
    var top = 10;
    for (var k = 0; k < n; k++) {
      var x0 = k * span, x1 = x0 + span;
      swags.push({ x0: x0, x1: x1, top: top, sag: sag });
      var per = 4;
      for (var j = 0; j <= per; j++) {
        if (j === 0 && k > 0) continue;            /* jonction déjà posée */
        var u = j / per;
        bulbs.push({
          x: x0 + (x1 - x0) * u,
          y: top + sag * 4 * u * (1 - u),
          phase: Math.random() * Math.PI * 2,
          tw: 0.6 + Math.random() * 0.9,
          red: Math.random() < 0.16
        });
      }
    }
    bulbs.sort(function (a, b) { return a.x - b.x; });
  }

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildGarland();
  }
  size();
  window.addEventListener("resize", size);

  /* Logo (affiché dès qu'il est prêt) */
  var logo = new Image();
  var logoReady = false;
  logo.onload = function () { logoReady = true; };
  logo.src = "logo.jpg";

  /* Polices d'affichage (repli serif élégant si pas encore chargées) */
  if (document.fonts && document.fonts.load) {
    document.fonts.load('500 60px "Fraunces"').catch(function () {});
    document.fonts.load('italic 400 22px "Fraunces"').catch(function () {});
  }

  /* Neige fine + quelques paillettes d'or, sur trois profondeurs */
  var N = W < 700 ? 80 : 150;
  var flakes = [];
  for (var i = 0; i < N; i++) {
    var depth = Math.random();
    flakes.push({
      x: Math.random(),
      y: Math.random() * 1.1 - 0.1,
      r: 0.7 + depth * 2.1,
      fall: 0.035 + depth * 0.075,
      sway: 0.3 + Math.random() * 0.9,
      amp: 8 + depth * 18,
      phase: Math.random() * Math.PI * 2,
      a: 0.25 + depth * 0.55,
      gold: Math.random() < 0.22
    });
  }

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) {
    t = Math.max(0, Math.min(1, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function phase(t, from, dur) { return ease((t - from) / dur); }

  var HOLD = 3500;          /* durée avant l'ouverture du rideau */
  var OPEN_DUR = 900;       /* durée de l'ouverture */
  var start = null;
  var openAt = null;
  var removed = false;

  function drawCurtain(offset) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b2a30");
    g.addColorStop(0.5, "#061a1f");
    g.addColorStop(1, "#0b2a30");
    ctx.fillStyle = g;
    ctx.fillRect(0, -offset, W, H / 2 + 1);
    ctx.fillRect(0, H / 2 + offset, W, H / 2 + 1);

    /* lueur de four au centre, comme une veillée */
    if (offset < 4) {
      var glow = ctx.createRadialGradient(W / 2, H * 0.54, 0, W / 2, H * 0.54, Math.max(W, H) * 0.5);
      glow.addColorStop(0, "rgba(214, 150, 60, 0.17)");
      glow.addColorStop(1, "rgba(214, 150, 60, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* La guirlande est accrochée au pan du haut : elle part avec lui */
  function drawGarland(t, offset) {
    ctx.save();
    ctx.translate(0, -offset);

    ctx.strokeStyle = "rgba(200, 144, 47, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 0; k < swags.length; k++) {
      var s = swags[k];
      ctx.moveTo(s.x0, s.top);
      ctx.quadraticCurveTo((s.x0 + s.x1) / 2, s.top + s.sag * 2, s.x1, s.top);
    }
    ctx.stroke();

    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < bulbs.length; i++) {
      var b = bulbs[i];
      /* allumage en cascade de gauche à droite */
      var on = phase(t, 120 + (i / bulbs.length) * 950, 260);
      if (on <= 0) continue;
      var a = on * (0.72 + 0.28 * Math.sin(t * 0.0035 * b.tw + b.phase));
      var by = b.y + 5;
      var halo = ctx.createRadialGradient(b.x, by, 0, b.x, by, 15);
      if (b.red) {
        halo.addColorStop(0, "rgba(255,170,130," + a + ")");
        halo.addColorStop(0.3, "rgba(214,84,58," + a * 0.5 + ")");
        halo.addColorStop(1, "rgba(214,84,58,0)");
      } else {
        halo.addColorStop(0, "rgba(255,238,200," + a + ")");
        halo.addColorStop(0.3, "rgba(255,196,110," + a * 0.5 + ")");
        halo.addColorStop(1, "rgba(255,170,80,0)");
      }
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(b.x, by, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawSnow(t, alpha) {
    if (alpha <= 0) return;
    for (var i = 0; i < flakes.length; i++) {
      var p = flakes[i];
      var px = p.x * W + Math.sin(t * 0.0006 * p.sway + p.phase) * p.amp;
      var py = p.y * H;
      var a = p.a * alpha;
      if (p.gold) {
        a *= 0.6 + 0.4 * Math.sin(t * 0.003 + p.phase);
        ctx.fillStyle = "rgba(226,178,92," + a + ")";
      } else {
        ctx.fillStyle = "rgba(246,241,234," + a + ")";
      }
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* Étoile à huit branches, celle des azulejos */
  function star8(x, y, R, rot) {
    ctx.beginPath();
    for (var i = 0; i < 16; i++) {
      var rad = i % 2 === 0 ? R : R * 0.44;
      var ang = rot + (i * Math.PI) / 8 - Math.PI / 2;
      var sx = x + Math.cos(ang) * rad, sy = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
  }

  function drawCenter(t, alpha) {
    var cx = W / 2, cy = H / 2 + 6;
    ctx.save();
    ctx.globalAlpha = alpha;

    /* Logo : fondu + montée en échelle + halo doré */
    var pL = phase(t, 300, 850);
    var s = 64 + 32 * pL;
    var ly = cy - 118;
    if (pL > 0 && logoReady) {
      ctx.save();
      ctx.globalAlpha = alpha * pL;
      ctx.shadowColor = "rgba(255,190,100," + 0.7 * pL + ")";
      ctx.shadowBlur = 45 * pL;
      var r = 18;
      var x = cx - s / 2, y = ly - s / 2;
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

    /* Étoile qui se pose au-dessus du logo */
    var pS = phase(t, 950, 700);
    if (pS > 0 && H >= 520) {
      var sy0 = ly - s / 2 - 30;
      var R = 11 * (0.4 + 0.6 * pS) * (1 + 0.06 * Math.sin(t * 0.004));
      ctx.save();
      ctx.globalAlpha = alpha * pS;
      ctx.shadowColor = "rgba(255,205,120,0.9)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#e2b25c";
      star8(cx, sy0, R, (1 - pS) * 0.8);
      ctx.fill();
      ctx.shadowBlur = 0;
      /* rayons fins */
      var ray = 26 * pS;
      var lg = ctx.createLinearGradient(cx - ray, 0, cx + ray, 0);
      lg.addColorStop(0, "rgba(226,178,92,0)");
      lg.addColorStop(0.5, "rgba(255,226,170,0.85)");
      lg.addColorStop(1, "rgba(226,178,92,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(cx - ray, sy0 - 0.5, ray * 2, 1);
      ctx.restore();
    }

    /* « QENTINA » : lettres qui se resserrent en sortant du flou */
    var pN = phase(t, 650, 1050);
    if (pN > 0) {
      var fs = Math.min(76, Math.max(44, W * 0.055));
      var spacing = (0.52 - 0.38 * pN) * fs;
      ctx.font = "500 " + fs + 'px "Fraunces", Georgia, serif';
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      var word = "QENTINA";
      var widths = [], total = 0;
      for (var i = 0; i < word.length; i++) {
        var w = ctx.measureText(word[i]).width;
        widths.push(w);
        total += w + (i < word.length - 1 ? spacing : 0);
      }
      var xx = cx - total / 2;
      ctx.fillStyle = "rgba(246,241,234," + pN * alpha + ")";
      ctx.shadowColor = "rgba(255,190,100," + 0.35 * pN + ")";
      ctx.shadowBlur = 26 * (1 - pN) + 8;
      for (var j = 0; j < word.length; j++) {
        ctx.fillText(word[j], xx, cy - 6);
        xx += widths[j] + spacing;
      }
      ctx.shadowBlur = 0;
    }

    /* Vœux, en italien et en portugais */
    var pT = phase(t, 1500, 700);
    if (pT > 0) {
      ctx.font = "600 " + Math.max(11, Math.min(14, W * 0.011)) + 'px "Inter", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(214,160,66," + pT * alpha + ")";
      ctx.fillText("B U O N   N A T A L E   ·   F E L I Z   N A T A L", cx, cy + 58);
    }

    /* Filet doré qui se déploie, losange au centre */
    var pLine = phase(t, 1800, 700);
    if (pLine > 0) {
      var lw = 210 * pLine;
      var lg2 = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0);
      lg2.addColorStop(0, "rgba(200,144,47,0)");
      lg2.addColorStop(0.5, "rgba(200,144,47," + 0.9 * alpha + ")");
      lg2.addColorStop(1, "rgba(200,144,47,0)");
      ctx.fillStyle = lg2;
      ctx.fillRect(cx - lw / 2, cy + 90, lw, 1.4);
      ctx.save();
      ctx.translate(cx, cy + 90.7);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "rgba(226,178,92," + pLine * alpha + ")";
      ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
      ctx.restore();
    }

    /* « Joyeuses fêtes » */
    var pJ = phase(t, 2100, 800);
    if (pJ > 0) {
      ctx.font = 'italic 400 ' + Math.max(18, Math.min(23, W * 0.018)) + 'px "Fraunces", Georgia, serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(246,241,234," + 0.9 * pJ * alpha + ")";
      ctx.fillText("Joyeuses fêtes", cx, cy + 124 + (1 - pJ) * 8);
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
    window.removeEventListener("resize", size);
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  var last = null;
  function tick(now) {
    if (removed) return;
    if (start === null) start = now;
    var t = now - start;
    var dt = last === null ? 0.016 : Math.min(0.05, (now - last) / 1000);
    last = now;
    if (openAt === null && t >= HOLD) openAt = now;

    ctx.clearRect(0, 0, W, H);

    /* la neige tombe en continu */
    for (var i = 0; i < flakes.length; i++) {
      flakes[i].y += flakes[i].fall * dt;
      if (flakes[i].y > 1.04) { flakes[i].y = -0.04; flakes[i].x = Math.random(); }
    }

    if (openAt === null) {
      drawCurtain(0);
      drawSnow(t, phase(t, 0, 700));
      drawGarland(t, 0);
      drawCenter(t, 1);
    } else {
      var o = easeInOut((now - openAt) / OPEN_DUR);
      /* le hero rejoue sa cascade dès que le rideau commence à s'ouvrir */
      if (o > 0.12) docEl.classList.remove("has-intro");
      var off = o * (H / 2 + 10);
      drawCurtain(off);
      drawSnow(t, 1 - o);
      drawGarland(t, off);
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
