/* ============================================================
   QENTINA — Décoration de Noël (saisonnière)
   ------------------------------------------------------------
   Italie + Portugal : guirlande de « luminarie » suspendue en
   haut du hero, neige fine et paillettes d'or sur la photo,
   vœux « Buon Natale · Feliz Natal », bandeau de fêtes avant le
   pied de page. Tout est injecté ici et stylé dans noel.css.

   POUR RETIRER LA DÉCO après les fêtes : supprimer dans chaque
   page les deux lignes marquées « NOËL » (noel.css + noel.js)
   et remettre l'intro braises (historique git de intro.js).
   ============================================================ */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVG = "http://www.w3.org/2000/svg";
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.1 5.9L20 4l-2.9 5.9L23 12l-5.9 2.1L20 20l-5.9-2.9L12 23l-2.1-5.9L4 20l2.9-5.9L1 12l5.9-2.1L4 4l5.9 2.9z"/></svg>';

  document.documentElement.classList.add("noel");

  /* ---------- Guirlande lumineuse en haut du hero ---------- */
  function buildGarland() {
    if (!hero) return;
    var old = hero.querySelector(".noel-garland");
    if (old) old.parentNode.removeChild(old);

    var W = hero.clientWidth;
    var nav = document.querySelector(".nav");
    var top = Math.max(62, (nav ? nav.offsetHeight : 70) - 6);
    var span = W < 700 ? 112 : 176;
    var n = Math.max(3, Math.round(W / span));
    span = W / n;
    var sag = Math.min(30, span * 0.19);
    var h = top + sag + 26;

    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "noel-garland");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", W);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", "0 0 " + W + " " + h);

    var d = "";
    var bulbs = "";
    for (var k = 0; k < n; k++) {
      var x0 = k * span, x1 = x0 + span;
      d += "M" + x0.toFixed(1) + " " + top + " Q" + ((x0 + x1) / 2).toFixed(1) + " " + (top + sag * 2).toFixed(1) + " " + x1.toFixed(1) + " " + top + " ";
      var per = 4;
      for (var j = 0; j <= per; j++) {
        if (j === 0 && k > 0) continue;
        var u = j / per;
        var bx = x0 + (x1 - x0) * u;
        var by = top + sag * 4 * u * (1 - u);
        var red = Math.random() < 0.16;
        var delay = (Math.random() * 4).toFixed(2);
        var dur = (2.6 + Math.random() * 2.6).toFixed(2);
        bulbs +=
          '<g class="noel-bulb' + (red ? " noel-bulb--red" : "") + '" style="animation-delay:-' + delay + "s;animation-duration:" + dur + 's">' +
          '<circle class="noel-bulb__halo" cx="' + bx.toFixed(1) + '" cy="' + (by + 6).toFixed(1) + '" r="13"/>' +
          '<rect class="noel-bulb__cap" x="' + (bx - 1.4).toFixed(1) + '" y="' + (by - 0.5).toFixed(1) + '" width="2.8" height="3.4" rx="0.8"/>' +
          '<circle class="noel-bulb__core" cx="' + bx.toFixed(1) + '" cy="' + (by + 6).toFixed(1) + '" r="3"/>' +
          "</g>";
      }
    }
    svg.innerHTML =
      '<defs>' +
      '<radialGradient id="noelHalo"><stop offset="0" stop-color="#ffe9bd" stop-opacity=".85"/><stop offset=".35" stop-color="#ffc66e" stop-opacity=".32"/><stop offset="1" stop-color="#ffaa50" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="noelHaloRed"><stop offset="0" stop-color="#ffb394" stop-opacity=".85"/><stop offset=".35" stop-color="#d6543a" stop-opacity=".34"/><stop offset="1" stop-color="#d6543a" stop-opacity="0"/></radialGradient>' +
      "</defs>" +
      '<path class="noel-garland__wire" d="' + d + '"/>' + bulbs;
    hero.appendChild(svg);
  }

  /* ---------- Neige fine sur le hero ---------- */
  function snow() {
    if (!hero || reduce) return;
    var c = document.createElement("canvas");
    c.className = "noel-snow";
    c.setAttribute("aria-hidden", "true");
    hero.appendChild(c);
    var ctx = c.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, flakes = [], running = false, visible = true, last = null;

    function size() {
      W = hero.clientWidth; H = hero.clientHeight;
      c.width = W * DPR; c.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var n = Math.round(Math.min(70, Math.max(26, W / 22)));
      flakes = [];
      for (var i = 0; i < n; i++) {
        var depth = Math.random();
        flakes.push({
          x: Math.random(), y: Math.random(),
          r: 0.7 + depth * 1.9,
          fall: 14 + depth * 26,               /* px / s */
          sway: 0.3 + Math.random() * 0.8,
          amp: 6 + depth * 16,
          phase: Math.random() * 6.28,
          a: 0.22 + depth * 0.5,
          gold: Math.random() < 0.2
        });
      }
    }

    function tick(now) {
      if (!running) return;
      var dt = last === null ? 0.016 : Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var p = flakes[i];
        p.y += (p.fall * dt) / H;
        if (p.y > 1.03) { p.y = -0.03; p.x = Math.random(); }
        var px = p.x * W + Math.sin(now * 0.0006 * p.sway + p.phase) * p.amp;
        var a = p.a;
        if (p.gold) {
          a *= 0.6 + 0.4 * Math.sin(now * 0.003 + p.phase);
          ctx.fillStyle = "rgba(232,188,104," + a + ")";
        } else {
          ctx.fillStyle = "rgba(250,246,238," + a + ")";
        }
        ctx.beginPath();
        ctx.arc(px, p.y * H, p.r, 0, 6.2832);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    function update() {
      var should = visible && !document.hidden;
      if (should && !running) { running = true; last = null; requestAnimationFrame(tick); }
      else if (!should) running = false;
    }

    size();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; update(); }).observe(hero);
    }
    document.addEventListener("visibilitychange", update);
    var to;
    window.addEventListener("resize", function () { clearTimeout(to); to = setTimeout(size, 200); }, { passive: true });
    update();
  }

  /* ---------- Vœux dans le hero ---------- */
  function greeting() {
    if (!hero) return;
    var eyebrow = hero.querySelector(".eyebrow");
    if (!eyebrow || hero.querySelector(".noel-greeting")) return;
    var p = document.createElement("p");
    p.className = "noel-greeting";
    p.innerHTML = STAR + '<span lang="it">Buon Natale</span><i aria-hidden="true">·</i><span lang="pt">Feliz Natal</span>' + STAR;
    eyebrow.parentNode.insertBefore(p, eyebrow);
  }

  /* ---------- Bandeau de fêtes avant le pied de page ---------- */
  function band() {
    var footer = document.querySelector(".footer");
    if (!footer || document.querySelector(".noel-band")) return;
    var b = document.createElement("aside");
    b.className = "noel-band";
    b.setAttribute("aria-label", "Vœux de fin d'année");
    b.innerHTML =
      '<div class="noel-band__frise" aria-hidden="true"></div>' +
      '<div class="noel-band__inner">' +
      '<span class="noel-band__star">' + STAR + "</span>" +
      '<p class="noel-band__title"><span lang="it">Buon Natale</span> <i aria-hidden="true">·</i> <span lang="pt">Feliz Natal</span></p>' +
      '<p class="noel-band__txt">Toute l\'équipe QENTINA vous souhaite de belles fêtes de fin d\'année, autour du feu de bois.</p>' +
      "</div>" +
      '<div class="noel-band__frise" aria-hidden="true"></div>';
    footer.parentNode.insertBefore(b, footer);
  }

  function init() {
    greeting();
    band();
    buildGarland();
    snow();
    var to;
    window.addEventListener("resize", function () { clearTimeout(to); to = setTimeout(buildGarland, 200); }, { passive: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
