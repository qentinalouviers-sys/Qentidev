/* ============================================================
   QENTINA — interactions & animations
   ============================================================ */
(function () {
  "use strict";

  /* --- Année dans le footer --- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* --- Navigation : fond au défilement --- */
  var nav = document.getElementById("nav");
  function onScroll() {
    if (window.scrollY > 30) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- Menu mobile --- */
  var burger = document.querySelector(".nav__burger");
  var mobileMenu = document.getElementById("mobileMenu");
  function toggleMenu(force) {
    var open = force !== undefined ? force : !mobileMenu.classList.contains("is-open");
    mobileMenu.classList.toggle("is-open", open);
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (burger) burger.addEventListener("click", function () { toggleMenu(); });
  if (mobileMenu) {
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { toggleMenu(false); });
    });
  }

  /* --- Apparition au défilement --- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* --- Curseur personnalisé --- */
  var cursor = document.querySelector(".cursor");
  var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (cursor && canHover) {
    var cx = 0, cy = 0, tx = 0, ty = 0;
    document.addEventListener("mousemove", function (e) { tx = e.clientX; ty = e.clientY; });
    (function loop() {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      cursor.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%, -50%)";
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, .card, .feature, .info-card").forEach(function (el) {
      el.addEventListener("mouseenter", function () { cursor.classList.add("is-hover"); });
      el.addEventListener("mouseleave", function () { cursor.classList.remove("is-hover"); });
    });
  }

  /* --- Léger parallaxe sur la pizza du hero --- */
  var pizza = document.querySelector(".hero__pizza-disc");
  if (pizza && canHover) {
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      if (y < window.innerHeight) {
        pizza.style.marginTop = (y * 0.12) + "px";
      }
    }, { passive: true });
  }

  /* --- Formulaire de réservation --- */
  var form = document.getElementById("reservationForm");
  var feedback = document.getElementById("formFeedback");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      var datetime = form.datetime.value;
      if (!name || !phone || !datetime) {
        feedback.style.color = "var(--tomato)";
        feedback.textContent = "Merci de renseigner votre nom, téléphone et la date souhaitée.";
        return;
      }
      feedback.style.color = "var(--basil)";
      feedback.textContent = "Merci " + name + " ! Votre demande de réservation a bien été enregistrée. À très vite chez QENTINA 🍕";
      form.reset();
    });
  }
})();
