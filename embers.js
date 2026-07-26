/* ============================================================
   QENTINA — Braises du feu de bois (three.js, repli canvas 2D)
   ------------------------------------------------------------
   De fines braises dorées s'élèvent sur le visuel d'accueil.
   - three.js chargé à la volée (CDN) ; repli canvas 2D sinon
   - désactivé si l'utilisateur préfère réduire les animations
   - léger : ~100 particules, pixel ratio plafonné
   ============================================================ */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var hero = document.querySelector(".hero");
  if (!hero || !hero.querySelector(".hero__bg")) return;

  var holder = document.createElement("div");
  holder.className = "embers";
  holder.setAttribute("aria-hidden", "true");
  hero.appendChild(holder);

  var COUNT = (hero.clientWidth < 700) ? 55 : 110;

  /* Petite lueur ronde servant de sprite aux braises */
  function glowCanvas() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,216,150,1)");
    grad.addColorStop(0.35, "rgba(255,172,84,0.85)");
    grad.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  /* ---------- Version three.js ---------- */
  function initThree() {
    var W = hero.clientWidth, H = hero.clientHeight;
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(W, H);
    holder.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, W / H, 1, 400);
    camera.position.z = 100;

    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(COUNT * 3);
    var seeds = [];
    for (var i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 230;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 150;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      seeds.push({
        rise: 4 + Math.random() * 12,
        sway: 0.3 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2
      });
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    var mat = new THREE.PointsMaterial({
      size: 4.6,
      map: new THREE.CanvasTexture(glowCanvas()),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    scene.add(new THREE.Points(geo, mat));

    var last = performance.now();
    function tick(t) {
      requestAnimationFrame(tick);
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      var p = geo.attributes.position.array;
      for (var i = 0; i < COUNT; i++) {
        var s = seeds[i];
        p[i * 3 + 1] += s.rise * dt;
        p[i * 3] += Math.sin(t * 0.001 * s.sway + s.phase) * 0.06;
        if (p[i * 3 + 1] > 85) {
          p[i * 3 + 1] = -85;
          p[i * 3] = (Math.random() - 0.5) * 230;
        }
      }
      geo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);

    window.addEventListener("resize", function () {
      W = hero.clientWidth; H = hero.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
  }

  /* ---------- Repli canvas 2D (si le CDN est indisponible) ---------- */
  function init2D() {
    var canvas = document.createElement("canvas");
    holder.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var sprite = glowCanvas();
    var W, H, parts = [];

    function size() {
      W = canvas.width = hero.clientWidth;
      H = canvas.height = hero.clientHeight;
    }
    size();
    window.addEventListener("resize", size);

    for (var i = 0; i < COUNT; i++) {
      parts.push({
        x: Math.random() * 2 - 1,
        y: Math.random(),
        r: 1.5 + Math.random() * 3,
        rise: 0.02 + Math.random() * 0.06,
        sway: 0.3 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2
      });
    }

    var last = performance.now();
    (function tick(t) {
      requestAnimationFrame(tick);
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = 0.75;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.y -= p.rise * dt;
        if (p.y < -0.05) { p.y = 1.05; p.x = Math.random() * 2 - 1; }
        var px = (p.x * 0.5 + 0.5) * W + Math.sin(t * 0.001 * p.sway + p.phase) * 14;
        var d = p.r * 2.6;
        ctx.drawImage(sprite, px - d / 2, p.y * H - d / 2, d, d);
      }
    })(last);
  }

  /* Chargement de three.js, repli 2D en cas d'échec */
  var s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
  s.async = true;
  s.onload = function () {
    try { initThree(); } catch (e) { init2D(); }
  };
  s.onerror = init2D;
  document.head.appendChild(s);
})();
