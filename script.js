/* ============================================================
   QENTINA — interactions (léger & optimisé)
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     HORAIRES & FERMETURES — seul endroit à modifier.
     Le bandeau d'alerte, les créneaux du formulaire et le contrôle à
     l'envoi en découlent tous.

     SERVICES : jour (0=dim … 6=sam) → plages en minutes depuis minuit.
       Midi 12h00–14h30 (mardi → vendredi), soir 19h00–22h30
       (23h00 ven. & sam.). Pas de service le samedi midi.

     CLOSURES : fermetures exceptionnelles, "to" inclus. Elles
       disparaissent d'elles-mêmes une fois la date passée.
       - journée entière : { from, to, reason }
       - une seule journée : même date dans from et to
       - journée partielle : ajouter only: "Soir" (ou "Midi") pour ne
         garder que ce service-là ouvert
     ============================================================ */
  var SERVICES = {
    2: [[720, 870], [1140, 1350]],
    3: [[720, 870], [1140, 1350]],
    4: [[720, 870], [1140, 1350]],
    5: [[720, 870], [1140, 1380]],
    6: [[1140, 1380]]
  };
  var LAST_ARRIVAL = 30; // dernière arrivée 30 min avant la fermeture du service
  var CUTOFF = 120;      // réservation en ligne close 2 h avant le DÉBUT du service

  var CLOSURES = [
    { from: "2026-08-11", to: "2026-08-13", reason: "travaux" },
    // Reprise en douceur : le vendredi, seul le service du soir tourne.
    { from: "2026-08-14", to: "2026-08-14", reason: "travaux", only: "Soir" }
  ];

  /* Récapitulatif de service (worker-reservations.js).
     Coller ici l'adresse du Worker une fois déployé, ex. :
     "https://qentina-resa.mon-sous-domaine.workers.dev"
     Tant que c'est vide, rien ne change : les demandes partent par email
     comme aujourd'hui. Voir DEPLOIEMENT-RESERVATIONS.md */
  var RESA_ENDPOINT = "";

  function padNum(n) { return (n < 10 ? "0" : "") + n; }
  function isoDay(d) { return d.getFullYear() + "-" + padNum(d.getMonth() + 1) + "-" + padNum(d.getDate()); }
  function fmtMin(min) { return padNum(Math.floor(min / 60)) + "h" + padNum(min % 60); }

  // Le libellé vient de l'heure du service, pas de sa position : le samedi
  // n'a qu'un seul service et c'est celui du soir.
  function serviceLabel(win) { return win[0] < 900 ? "Midi" : "Soir"; }

  // La fermeture qui couvre cette date, sinon null.
  function closureFor(dateStr) {
    for (var i = 0; i < CLOSURES.length; i++) {
      if (dateStr >= CLOSURES[i].from && dateStr <= CLOSURES[i].to) return CLOSURES[i];
    }
    return null;
  }

  // Les services réellement assurés ce jour-là, fermetures comprises.
  function openServices(dateStr) {
    var svc = SERVICES[new Date(dateStr + "T00:00:00").getDay()] || [];
    var c = closureFor(dateStr);
    if (!c) return svc;
    if (!c.only) return [];
    return svc.filter(function (win) { return serviceLabel(win) === c.only; });
  }

  function frDate(dateStr, withMonth) {
    var d = new Date(dateStr + "T00:00:00");
    try {
      return d.toLocaleDateString("fr-FR", withMonth
        ? { weekday: "long", day: "numeric", month: "long" }
        : { weekday: "long", day: "numeric" });
    } catch (e) { return dateStr; }
  }

  // Prochain moment où l'on sert quelque chose, à partir de dateStr inclus.
  function nextOpening(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    for (var guard = 0; guard < 60; guard++) {
      var key = isoDay(d);
      var open = openServices(key);
      if (open.length) return { date: key, min: open[0][0] };
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  /* Bandeau d'alerte, affiché tant que la fermeture n'est pas passée */
  (function closureBanner() {
    var today = isoDay(new Date());
    var next = null;
    for (var i = 0; i < CLOSURES.length; i++) {
      if (CLOSURES[i].to >= today && (!next || CLOSURES[i].from < next.from)) next = CLOSURES[i];
    }
    if (!next) return;

    var msg;
    if (next.only) {
      // Journée partielle : on annonce l'horaire de reprise.
      var svc = openServices(next.from);
      msg = "<strong>Reprise après " + next.reason + "</strong> " +
        (next.from === today ? "aujourd'hui" : frDate(next.from, true)) +
        " : ouverture uniquement le " + next.only.toLowerCase() +
        (svc.length ? ", à partir de " + fmtMin(svc[0][0]) : "") + ".";
    } else {
      var when = next.from === next.to
        ? "le " + frDate(next.from, true)
        : "du " + frDate(next.from, false) + " au " + frDate(next.to, true);
      var re = nextOpening(next.to);
      msg = "<strong>Fermeture exceptionnelle pour " + next.reason + "</strong> " + when +
        (re ? ". Réouverture " + frDate(re.date, true) + " à " + fmtMin(re.min) : "") +
        ". Merci de votre compréhension&nbsp;!";
    }

    var bar = document.createElement("div");
    bar.className = "notice";
    bar.setAttribute("role", "status");
    bar.innerHTML = '<span class="notice__icon" aria-hidden="true">🔧</span><span>' + msg + "</span>";
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add("has-notice");

    var setHeight = function () {
      document.documentElement.style.setProperty("--notice-h", bar.offsetHeight + "px");
    };
    setHeight();
    window.addEventListener("resize", setHeight, { passive: true });
  })();

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

  /* Formulaire de devis traiteur → email via Web3Forms */
  var devis = document.getElementById("devisForm");
  if (devis) {
    var dFeedback = document.getElementById("devisFeedback");
    var dBtn = devis.querySelector('button[type="submit"]');
    var dLabel = dBtn ? dBtn.textContent : "";
    var dDate = document.getElementById("d-date");
    if (dDate) {
      var dt = new Date();
      var dp = function (n) { return (n < 10 ? "0" : "") + n; };
      dDate.min = dt.getFullYear() + "-" + dp(dt.getMonth() + 1) + "-" + dp(dt.getDate());
    }
    function dSet(msg, ok) {
      dFeedback.style.color = ok ? "var(--olive)" : "var(--terra)";
      dFeedback.textContent = msg;
    }
    devis.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("d-name").value || "").trim();
      var phone = (document.getElementById("d-phone").value || "").trim();
      var email = (document.getElementById("d-email").value || "").trim();
      var ev = document.getElementById("d-event").value;
      var date = document.getElementById("d-date").value;
      if (!name || !phone || !email || !ev || !date) {
        dSet("Merci d'indiquer votre nom, téléphone, email, le type d'événement et la date.", false);
        return;
      }
      var dkey = devis.querySelector('[name="access_key"]');
      dkey = dkey ? dkey.value : "";
      if (!dkey || dkey.indexOf("__") === 0) {
        dSet("Merci " + name + " ! Votre demande de devis a bien été enregistrée.", true);
        devis.reset();
        return;
      }
      if (dBtn) { dBtn.disabled = true; dBtn.textContent = "Envoi…"; }
      dSet("Envoi de votre demande…", true);

      // Case décochée = non transmise par le navigateur : on force Oui/Non.
      var dOptin = document.getElementById("d-optin");
      var dData = new FormData(devis);
      dData.set("Newsletter", dOptin && dOptin.checked ? "Oui" : "Non");

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: dData
      })
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json && json.success) {
            dSet("Merci " + name + " ! Votre demande de devis nous est bien parvenue. Nous revenons vers vous rapidement.", true);
            devis.reset();
          } else {
            dSet("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
          }
        })
        .catch(function () {
          dSet("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
        })
        .then(function () {
          if (dBtn) { dBtn.disabled = false; dBtn.textContent = dLabel; }
        });
    });
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

    /* Créneaux de réservation — voir SERVICES et CLOSURES en tête de fichier */
    var fmt = fmtMin;
    function dayKey(d) { return isoDay(d); }

    // Un service n'est réservable en ligne que tant qu'il reste CUTOFF minutes
    // avant son ouverture. Passé ce délai, c'est par téléphone.
    function serviceOpen(win, isToday, nowMin) {
      return !isToday || nowMin <= win[0] - CUTOFF;
    }

    // Vérification côté envoi (garde-fou si la page est restée ouverte
    // longtemps). Renvoie "" si le créneau est valide, sinon la raison :
    //   "fermeture"  → fermeture exceptionnelle sur ce service
    //   "inexistant" → aucun service à cette heure-là ce jour-là
    //   "tard"       → service existant mais clôturé en ligne
    function slotProblem(dateStr, timeStr) {
      var open = openServices(dateStr);
      var shut = closureFor(dateStr) ? "fermeture" : "inexistant";
      if (!open.length) return shut;

      var parts = /^(\d{1,2})h(\d{2})$/.exec(timeStr);
      if (!parts) return "";
      var m = parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);

      // L'heure doit tomber dans un service réellement assuré ce jour-là —
      // quelle que soit la date (le samedi midi n'existe pas, même dans trois
      // semaines), fermetures exceptionnelles comprises.
      var win = null;
      for (var i = 0; i < open.length; i++) {
        if (m >= open[i][0] && m <= open[i][1]) { win = open[i]; break; }
      }
      if (!win) return shut;

      var now = new Date();
      var todayStr = isoDay(now);
      if (dateStr < todayStr) return "tard";
      if (dateStr > todayStr) return "";
      return serviceOpen(win, true, now.getHours() * 60 + now.getMinutes()) ? "" : "tard";
    }
    function slotTooLate(dateStr, timeStr) { return slotProblem(dateStr, timeStr) !== ""; }

    var dateInput = document.getElementById("r-date");
    var timeSelect = document.getElementById("r-time");
    var hoursNote = document.getElementById("hoursNote");
    var callBox = document.getElementById("callBox");
    var callBoxText = document.getElementById("callBoxText");
    var buildSlots = null; // défini plus bas, réutilisé à l'envoi du formulaire
    if (dateInput && timeSelect) {
      dateInput.min = dayKey(new Date());

      var setNote = function (html, warn) {
        hoursNote.innerHTML = html;
        hoursNote.classList.toggle("form-note--warn", !!warn);
      };

      // Encart « contactez-nous » : proposé dès que la réservation en ligne est close,
      // parce qu'il reste souvent une table même au dernier moment.
      var callBoxWa = document.getElementById("callBoxWa");
      var WA_BASE = callBoxWa ? callBoxWa.getAttribute("href") : "";

      function humanDate(dateStr) {
        var d = new Date(dateStr + "T00:00:00");
        try {
          return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        } catch (e) {
          return dateStr;
        }
      }

      var showCall = function (text, waAsk) {
        if (!callBox) return;
        if (callBoxText && text) callBoxText.textContent = text;
        if (callBoxWa && WA_BASE) {
          // Message pré-rempli : le client n'a plus qu'à appuyer sur « envoyer ».
          callBoxWa.href = WA_BASE + "?text=" +
            encodeURIComponent("Bonjour QENTINA ! Reste-t-il une table " + waAsk + " ?");
        }
        callBox.hidden = false;
      };
      var hideCall = function () {
        if (callBox) callBox.hidden = true;
      };

      buildSlots = function (dateStr) {
        timeSelect.innerHTML = "";

        var closure = closureFor(dateStr);
        var svc = openServices(dateStr);

        // Fermeture exceptionnelle totale : aucun créneau, et inutile d'appeler.
        if (closure && !svc.length) {
          var shut = new Option("Fermé (" + closure.reason + ")", "");
          shut.disabled = true; shut.selected = true;
          timeSelect.add(shut);
          timeSelect.disabled = true;
          var re = nextOpening(dateStr);
          setNote(
            "Nous sommes fermés pour " + closure.reason + " ce jour-là." +
            (re ? " Réouverture " + frDate(re.date, true) + " à " + fmtMin(re.min) + "." : ""),
            true
          );
          hideCall();
          return;
        }

        var day = new Date(dateStr + "T00:00:00").getDay();
        if (!svc.length) {
          var closed = new Option("Fermé ce jour-là", "");
          closed.disabled = true; closed.selected = true;
          timeSelect.add(closed);
          timeSelect.disabled = true;
          setNote("Nous sommes fermés le dimanche et le lundi. Merci de choisir un jour du mardi au samedi.", true);
          hideCall();
          return;
        }

        var ph = new Option("Choisir…", "");
        ph.disabled = true; ph.selected = true;
        timeSelect.add(ph);

        // Recalculé à chaque fois : l'heure a pu tourner depuis l'ouverture de la page.
        var now = new Date();
        var isToday = dateStr === dayKey(now);
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var count = 0;
        var tooLate = [];
        svc.forEach(function (win) {
          if (!serviceOpen(win, isToday, nowMin)) {
            tooLate.push(serviceLabel(win).toLowerCase());
            return;
          }
          var grp = document.createElement("optgroup");
          grp.label = serviceLabel(win);
          var last = win[1] - LAST_ARRIVAL;
          for (var m = win[0]; m <= last; m += 30) {
            grp.appendChild(new Option(fmt(m), fmt(m)));
            count++;
          }
          if (grp.children.length) timeSelect.appendChild(grp);
        });

        if (count === 0) {
          timeSelect.innerHTML = "";
          var no = new Option(tooLate.length ? "Trop tard pour aujourd'hui" : "Plus de créneau ce jour", "");
          no.disabled = true; no.selected = true;
          timeSelect.add(no);
          timeSelect.disabled = true;
          if (tooLate.length) {
            setNote("Les réservations en ligne ferment 2&nbsp;h avant le début du service.", true);
            showCall("Trop tard pour réserver en ligne aujourd'hui — mais il reste parfois une table.", "pour aujourd'hui");
          } else {
            setNote("Plus de créneau disponible pour cette date.", true);
            showCall("Plus de créneau en ligne pour cette date — contactez-nous, on regarde tout de suite.", "pour " + humanDate(dateStr));
          }
          return;
        }

        timeSelect.disabled = false;
        if (tooLate.length) {
          setNote(
            "Le service du " + tooLate.join(" et du ") + " est clôturé en ligne (fermeture 2&nbsp;h avant le service).",
            true
          );
          showCall(
            "Vous vouliez une table pour le " + tooLate.join(" ou le ") + " ? Contactez-nous, il reste parfois de la place.",
            tooLate[0] === "midi" ? "pour ce midi" : "pour ce soir"
          );
        } else if (closure) {
          // Journée partielle : un seul service tourne ce jour-là.
          setNote(
            "Reprise après " + closure.reason + "&nbsp;: ce jour-là, nous servons uniquement le " +
            closure.only.toLowerCase() + ", à partir de " + fmtMin(svc[0][0]) + ".",
            true
          );
          hideCall();
        } else {
          setNote(
            day === 6
              ? "Le samedi, nous servons uniquement le soir · 19h00–23h00 (fermé le samedi midi)."
              : "Midi 12h00–14h30 (mardi → vendredi) · Soir 19h00–22h30, jusqu'à 23h ven.&nbsp;&amp;&nbsp;sam.",
            false
          );
          hideCall();
        }
      };
      dateInput.addEventListener("change", function () {
        if (dateInput.value) buildSlots(dateInput.value);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("r-name").value || "").trim();
      var phone = (document.getElementById("r-phone").value || "").trim();
      var date = document.getElementById("r-date").value;
      var time = document.getElementById("r-time").value;
      var guests = document.getElementById("r-guests").value;
      var optin = document.getElementById("r-optin");
      // L'email est obligatoire : c'est par lui que part la confirmation.
      var email = (document.getElementById("r-email").value || "").trim();
      if (!name || !phone || !email || !date || !time || !guests) {
        setFeedback("Merci d'indiquer votre nom, téléphone, email, la date, l'heure et le nombre de couverts.", false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setFeedback("Cette adresse email semble incorrecte. Merci de la vérifier : c'est là que nous enverrons votre confirmation.", false);
        return;
      }

      var problem = slotProblem(date, time);
      if (problem) {
        var closed = closureFor(date);
        setFeedback(
          problem === "fermeture"
            ? (closed && closed.only
                ? "Ce jour-là, nous ne servons que le " + closed.only.toLowerCase() + " (" + closed.reason + "). Merci de choisir un créneau du " + closed.only.toLowerCase() + "."
                : "Nous sommes fermés pour " + (closed ? closed.reason : "travaux") + " à cette date. Merci de choisir un autre jour.")
            : problem === "tard"
              ? "Ce créneau vient de se clôturer : les réservations en ligne ferment 2 h avant le service. Appelez-nous au 02 59 16 20 93, on trouvera une solution."
              : "Nous ne servons pas à cette heure-là ce jour-là. Merci de choisir un autre créneau dans la liste, ou appelez-nous au 02 59 16 20 93.",
          false
        );
        if (buildSlots && dateInput.value) buildSlots(dateInput.value);
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

      // Une case décochée n'est pas envoyée par le navigateur : on force la valeur
      // pour que chaque email indique explicitement Oui ou Non.
      var data = new FormData(form);
      data.set("Newsletter", optin && optin.checked ? "Oui" : "Non");

      // En parallèle : on dépose la réservation dans le récap de service.
      // Volontairement sans await ni blocage — si le Worker est indisponible,
      // la demande part quand même par email comme avant.
      if (RESA_ENDPOINT) {
        var place = form.querySelector('[name="Emplacement"]:checked');
        fetch(RESA_ENDPOINT + "/reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: date,
            time: time,
            name: name,
            phone: phone,
            email: email,
            guests: guests,
            place: place ? place.value : "",
            message: (document.getElementById("r-message") || {}).value || "",
            newsletter: optin && optin.checked ? "Oui" : "Non"
          })
        }).catch(function () { /* silencieux : le mail reste la source de vérité */ });
      }

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data
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

  /* Petit clin d'œil "cookies" (pas un vrai bandeau RGPD — on ne track pas individuellement) */
  try {
    var COOKIE_WINK_KEY = "qentinaCookieWinkDismissed";
    if (!localStorage.getItem(COOKIE_WINK_KEY)) {
      var cookieBanner = document.createElement("div");
      cookieBanner.className = "cookie-banner";
      cookieBanner.setAttribute("role", "status");
      cookieBanner.innerHTML =
        '<div class="cookie-banner__inner">' +
          '<span class="cookie-banner__emoji" aria-hidden="true">🍕</span>' +
          '<p class="cookie-banner__text">Ici, on n’a pas laissé Google manger des cookies sur notre site. Chez QENTINA, <strong>on mange des pizzas</strong> — et on protège vos données.</p>' +
          '<button type="button" class="cookie-banner__close">Miam, compris&nbsp;!</button>' +
        '</div>';
      document.body.appendChild(cookieBanner);
      setTimeout(function () { cookieBanner.classList.add("is-shown"); }, 900);
      cookieBanner.querySelector(".cookie-banner__close").addEventListener("click", function () {
        cookieBanner.classList.remove("is-shown");
        setTimeout(function () { cookieBanner.remove(); }, 500);
        try { localStorage.setItem(COOKIE_WINK_KEY, "1"); } catch (e) {}
      });
    }
  } catch (e) { /* localStorage indisponible (navigation privée stricte) : on ignore */ }
})();
