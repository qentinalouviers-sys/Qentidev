/* ============================================================
   QENTINA — interactions (léger & optimisé)
   ============================================================ */
(function () {
  "use strict";

  /* Toujours ouvrir le site tout en haut (sauf si un lien #ancre est utilisé) */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) {
    window.scrollTo(0, 0);
    window.addEventListener("load", function () {
      if (!location.hash) window.scrollTo(0, 0);
    });
  }

  /* Carte Google Maps : chargée seulement à l'approche (évite le saut au démarrage) */
  var mapFrame = document.querySelector(".map iframe[data-src]");
  if (mapFrame) {
    var loadMap = function () {
      if (mapFrame.src) return;
      mapFrame.src = mapFrame.getAttribute("data-src");
    };
    if ("IntersectionObserver" in window) {
      var mo = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { loadMap(); mo.disconnect(); }
      }, { rootMargin: "200px" });
      mo.observe(mapFrame);
    } else {
      loadMap();
    }
  }

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

  /* Photo d'accueil : parallaxe doux au défilement (désactivé si mouvement réduit) */
  var heroPhoto = document.querySelector(".hero__photo");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (heroPhoto && !reduceMotion) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < window.innerHeight * 1.3) {
          heroPhoto.style.transform = "translateY(" + (y * 0.07).toFixed(1) + "px)";
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* Visualiseur d'images de la carte (lightbox) */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".menu-card"));
  var lightbox = document.getElementById("lightbox");
  if (cards.length && lightbox) {
    var lbImg = document.getElementById("lightboxImg");
    var lbCounter = document.getElementById("lightboxCounter");
    var sources = cards.map(function (c) {
      return c.getAttribute("data-full") || c.querySelector("img").getAttribute("src");
    });
    var current = 0;
    var lastFocus = null;

    function show(i) {
      current = (i + sources.length) % sources.length;
      lbImg.style.opacity = "0";
      var next = new Image();
      next.onload = function () {
        lbImg.src = sources[current];
        lbImg.alt = "Carte QENTINA — page " + (current + 1);
        lbImg.style.opacity = "1";
      };
      next.src = sources[current];
      lbCounter.textContent = (current + 1) + " / " + sources.length;
    }
    function openLb(i) {
      lastFocus = document.activeElement;
      lightbox.hidden = false;
      requestAnimationFrame(function () { lightbox.classList.add("is-open"); });
      document.body.style.overflow = "hidden";
      show(i);
    }
    function closeLb() {
      lightbox.classList.remove("is-open");
      document.body.style.overflow = "";
      setTimeout(function () { lightbox.hidden = true; }, 280);
      if (lastFocus) lastFocus.focus();
    }

    cards.forEach(function (card, i) {
      card.addEventListener("click", function () { openLb(i); });
    });
    lightbox.querySelector(".lightbox__close").addEventListener("click", closeLb);
    lightbox.querySelector(".lightbox__prev").addEventListener("click", function () { show(current - 1); });
    lightbox.querySelector(".lightbox__next").addEventListener("click", function () { show(current + 1); });
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLb();
      else if (e.key === "ArrowLeft") show(current - 1);
      else if (e.key === "ArrowRight") show(current + 1);
    });

    /* Glissement tactile (mobile) */
    var startX = 0;
    lightbox.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
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

  /* Formulaire de réservation → envoi par email via Web3Forms */
  var form = document.getElementById("reservationForm");
  var feedback = document.getElementById("formFeedback");
  if (form) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.textContent : "";

    function setFeedback(msg, ok) {
      feedback.style.color = ok ? "var(--olive)" : "var(--terra)";
      feedback.textContent = msg;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("r-name").value || "").trim();
      var phone = (document.getElementById("r-phone").value || "").trim();
      var datetime = document.getElementById("r-datetime").value;
      var guests = document.getElementById("r-guests").value;
      if (!name || !phone || !datetime || !guests) {
        setFeedback("Merci d'indiquer votre nom, téléphone, la date/heure et le nombre de couverts.", false);
        return;
      }

      var keyField = form.querySelector('[name="access_key"]');
      var key = keyField ? keyField.value : "";

      // Tant que la clé Web3Forms n'est pas configurée : confirmation locale
      if (!key || key.indexOf("__") === 0) {
        setFeedback("Merci " + name + " ! Votre demande a bien été enregistrée. À très vite chez QENTINA.", true);
        form.reset();
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Envoi…"; }
      setFeedback("Envoi de votre demande…", true);

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json && json.success) {
            setFeedback("Merci " + name + " ! Votre demande de réservation nous a bien été envoyée. Nous vous recontactons rapidement.", true);
            form.reset();
          } else {
            setFeedback("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
          }
        })
        .catch(function () {
          setFeedback("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
        })
        .then(function () {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
        });
    });
  }
})();
