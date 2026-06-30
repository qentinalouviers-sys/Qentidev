/* ============================================================
   QENTINA — interactions (léger & optimisé)
   ============================================================ */
(function () {
  "use strict";

  /* Année dans le footer */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* Navigation : fond au défilement */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Menu mobile */
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

  /* Apparition au défilement */
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

  /* Bouton flottant : visible après le hero, masqué sur la section contact */
  var fab = document.getElementById("fab");
  var contact = document.getElementById("contact");
  if (fab) {
    var contactVisible = false;
    if ("IntersectionObserver" in window && contact) {
      new IntersectionObserver(function (entries) {
        contactVisible = entries[0].isIntersecting;
        updateFab();
      }, { threshold: 0.18 }).observe(contact);
    }
    function updateFab() {
      var pastHero = window.scrollY > window.innerHeight * 0.7;
      fab.classList.toggle("is-shown", pastHero && !contactVisible);
    }
    window.addEventListener("scroll", updateFab, { passive: true });
    updateFab();
  }

  /* Formulaire de réservation */
  var form = document.getElementById("reservationForm");
  var feedback = document.getElementById("formFeedback");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      var datetime = form.datetime.value;
      if (!name || !phone || !datetime) {
        feedback.style.color = "var(--terra)";
        feedback.textContent = "Merci de renseigner votre nom, téléphone et la date souhaitée.";
        return;
      }
      feedback.style.color = "var(--olive)";
      feedback.textContent = "Merci " + name + " ! Votre demande de réservation a bien été enregistrée. À très vite chez QENTINA.";
      form.reset();
    });
  }
})();
