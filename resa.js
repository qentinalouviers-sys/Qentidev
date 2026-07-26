/* ============================================================
   QENTINA — Pop-up de réservation
   ------------------------------------------------------------
   Tous les boutons « Réserver » (menu, hero, bouton flottant,
   pied de page) ouvrent une fenêtre de réservation élégante,
   disponible sur toutes les pages. Créneaux selon les horaires
   d'ouverture, envoi par email (Web3Forms), succès animé.
   ============================================================ */
(function () {
  "use strict";

  var ACCESS_KEY = "2c3a840b-0355-4f30-af2e-756045b3f2f6";

  /* ---------- Construction de la fenêtre ---------- */
  var wrap = document.createElement("div");
  wrap.className = "resa";
  wrap.setAttribute("hidden", "");
  wrap.innerHTML =
    '<div class="resa__backdrop"></div>' +
    '<div class="resa__dialog" role="dialog" aria-modal="true" aria-labelledby="rmTitle">' +
      '<button type="button" class="resa__close" aria-label="Fermer">&times;</button>' +
      '<div class="resa__head">' +
        '<img src="logo.jpg" alt="" width="46" height="46" />' +
        '<div>' +
          '<h2 id="rmTitle">Réserver une table</h2>' +
          '<p>Réponse rapide — ou appelez le <a href="tel:+33259162093">02&nbsp;59&nbsp;16&nbsp;20&nbsp;93</a></p>' +
        '</div>' +
      '</div>' +
      '<form class="resa__form" id="rmForm" novalidate>' +
        '<input type="hidden" name="access_key" value="' + ACCESS_KEY + '" />' +
        '<input type="hidden" name="subject" value="Nouvelle demande de réservation — QENTINA" />' +
        '<input type="hidden" name="from_name" value="Site QENTINA" />' +
        '<input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" style="display:none" aria-hidden="true" />' +
        '<div class="field">' +
          '<input type="text" id="rm-name" name="Nom" required placeholder=" " autocomplete="name" />' +
          '<label for="rm-name">Votre nom</label>' +
        '</div>' +
        '<div class="field--row">' +
          '<div class="field">' +
            '<input type="tel" id="rm-phone" name="Téléphone" required placeholder=" " autocomplete="tel" />' +
            '<label for="rm-phone">Téléphone</label>' +
          '</div>' +
          '<div class="field">' +
            '<input type="email" id="rm-email" name="Email" placeholder=" " autocomplete="email" />' +
            '<label for="rm-email">Email (facultatif)</label>' +
          '</div>' +
        '</div>' +
        '<div class="field--row">' +
          '<div class="field">' +
            '<input type="date" id="rm-date" name="Date" required />' +
            '<label for="rm-date" class="label--static">Date</label>' +
          '</div>' +
          '<div class="field">' +
            '<select id="rm-time" name="Heure" required disabled>' +
              '<option value="" disabled selected>Choisir une date</option>' +
            '</select>' +
            '<label for="rm-time" class="label--static">Heure d\'arrivée</label>' +
          '</div>' +
        '</div>' +
        '<p class="form-note" id="rmNote">Ouvert mardi → samedi · 12h00–14h30 et 19h00–22h30 (jusqu\'à 23h ven.&nbsp;&amp;&nbsp;sam.). Fermé dimanche et lundi.</p>' +
        '<div class="field">' +
          '<select id="rm-guests" name="Couverts" required>' +
            '<option value="" disabled selected>Choisir…</option>' +
            '<option>1 personne</option><option>2 personnes</option><option>3 personnes</option>' +
            '<option>4 personnes</option><option>5 personnes</option><option>6 personnes</option>' +
            '<option>7 personnes</option><option>8 personnes</option><option>9 personnes</option>' +
            '<option>10 personnes</option><option>Plus de 10 (groupe)</option>' +
          '</select>' +
          '<label for="rm-guests" class="label--static">Nombre de couverts</label>' +
        '</div>' +
        '<fieldset class="segmented">' +
          '<legend>Où souhaitez-vous vous installer&nbsp;?</legend>' +
          '<div class="segmented__options">' +
            '<label><input type="radio" name="Emplacement" value="Terrasse (bord de l\'Eure)" checked /><span>Terrasse</span></label>' +
            '<label><input type="radio" name="Emplacement" value="Intérieur" /><span>Intérieur</span></label>' +
            '<label><input type="radio" name="Emplacement" value="Sans préférence" /><span>Indifférent</span></label>' +
          '</div>' +
        '</fieldset>' +
        '<div class="field">' +
          '<textarea id="rm-message" name="Message" rows="2" placeholder=" "></textarea>' +
          '<label for="rm-message">Occasion, allergies… (facultatif)</label>' +
        '</div>' +
        '<button type="submit" class="btn btn--primary btn--full">Demander ma réservation</button>' +
        '<p class="contact__feedback" id="rmFeedback" role="status"></p>' +
      '</form>' +
      '<div class="resa__success" id="rmSuccess" hidden>' +
        '<span class="resa__check" aria-hidden="true">✓</span>' +
        '<h3>Demande envoyée&nbsp;!</h3>' +
        '<p id="rmSuccessText">Nous revenons vers vous très vite pour confirmer votre table. À très bientôt chez QENTINA&nbsp;!</p>' +
        '<button type="button" class="btn btn--ghost" id="rmDone">Fermer</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);

  var dialog = wrap.querySelector(".resa__dialog");
  var form = document.getElementById("rmForm");
  var success = document.getElementById("rmSuccess");
  var feedback = document.getElementById("rmFeedback");
  var lastFocus = null;

  /* ---------- Ouverture / fermeture ---------- */
  function openResa() {
    lastFocus = document.activeElement;
    wrap.removeAttribute("hidden");
    requestAnimationFrame(function () { wrap.classList.add("resa--open"); });
    document.body.style.overflow = "hidden";
    setTimeout(function () {
      var f = document.getElementById("rm-name");
      if (f) f.focus();
    }, 250);
  }
  function closeResa() {
    wrap.classList.remove("resa--open");
    document.body.style.overflow = "";
    setTimeout(function () { wrap.setAttribute("hidden", ""); }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  wrap.querySelector(".resa__backdrop").addEventListener("click", closeResa);
  wrap.querySelector(".resa__close").addEventListener("click", closeResa);
  document.getElementById("rmDone").addEventListener("click", closeResa);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !wrap.hasAttribute("hidden")) closeResa();
  });

  /* Tous les liens « Réserver » ouvrent la fenêtre */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href$="#contact"]') : null;
    if (!a) return;
    e.preventDefault();
    openResa();
  });

  /* ---------- Créneaux selon les horaires (fiche Google) ---------- */
  var dateInput = document.getElementById("rm-date");
  var timeSelect = document.getElementById("rm-time");
  var note = document.getElementById("rmNote");
  var SERVICES = {
    2: [[720, 870], [1140, 1350]],
    3: [[720, 870], [1140, 1350]],
    4: [[720, 870], [1140, 1350]],
    5: [[720, 870], [1140, 1380]],
    6: [[720, 870], [1140, 1380]]
  };
  var LAST_ARRIVAL = 30;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmt(m) { return pad(Math.floor(m / 60)) + "h" + pad(m % 60); }
  var now = new Date();
  var todayStr = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  dateInput.min = todayStr;

  dateInput.addEventListener("change", function () {
    var dateStr = dateInput.value;
    if (!dateStr) return;
    timeSelect.innerHTML = "";
    var day = new Date(dateStr + "T00:00:00").getDay();
    var svc = SERVICES[day];
    if (!svc) {
      var closed = new Option("Fermé ce jour-là", "");
      closed.disabled = true; closed.selected = true;
      timeSelect.add(closed);
      timeSelect.disabled = true;
      note.textContent = "Nous sommes fermés le dimanche et le lundi. Merci de choisir un jour du mardi au samedi.";
      note.classList.add("form-note--warn");
      return;
    }
    note.textContent = "Ouvert mardi → samedi · 12h00–14h30 et 19h00–22h30 (jusqu'à 23h ven. & sam.).";
    note.classList.remove("form-note--warn");
    var ph = new Option("Choisir…", "");
    ph.disabled = true; ph.selected = true;
    timeSelect.add(ph);
    var isToday = dateStr === todayStr;
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var labels = ["Midi", "Soir"];
    var count = 0;
    svc.forEach(function (win, i) {
      var grp = document.createElement("optgroup");
      grp.label = labels[i] || "Service";
      var last = win[1] - LAST_ARRIVAL;
      for (var m = win[0]; m <= last; m += 30) {
        if (isToday && m <= nowMin + 30) continue;
        grp.appendChild(new Option(fmt(m), fmt(m)));
        count++;
      }
      if (grp.children.length) timeSelect.appendChild(grp);
    });
    if (count === 0) {
      timeSelect.innerHTML = "";
      var no = new Option("Plus de créneau ce jour", "");
      no.disabled = true; no.selected = true;
      timeSelect.add(no);
      timeSelect.disabled = true;
    } else {
      timeSelect.disabled = false;
    }
  });

  /* ---------- Envoi ---------- */
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.textContent;
  function setFeedback(msg, ok) {
    feedback.style.color = ok ? "var(--olive)" : "var(--terra)";
    feedback.textContent = msg;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (document.getElementById("rm-name").value || "").trim();
    var phone = (document.getElementById("rm-phone").value || "").trim();
    var date = dateInput.value;
    var time = timeSelect.value;
    var guests = document.getElementById("rm-guests").value;
    if (!name || !phone || !date || !time || !guests) {
      setFeedback("Merci d'indiquer votre nom, téléphone, la date, l'heure et le nombre de couverts.", false);
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi…";
    setFeedback("Envoi de votre demande…", true);
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form)
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.success) {
          document.getElementById("rmSuccessText").textContent =
            "Merci " + name + " ! Nous revenons vers vous très vite pour confirmer votre table du " +
            date.split("-").reverse().join("/") + " à " + time + ". À très bientôt chez QENTINA !";
          form.hidden = true;
          success.hidden = false;
          form.reset();
          timeSelect.disabled = true;
        } else {
          setFeedback("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
        }
      })
      .catch(function () {
        setFeedback("Oups, l'envoi a échoué. Merci de nous appeler au 02 59 16 20 93.", false);
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = submitLabel;
      });
  });

  /* Réinitialise l'état à la réouverture */
  wrap.addEventListener("transitionend", function () {
    if (wrap.hasAttribute("hidden")) {
      form.hidden = false;
      success.hidden = true;
      feedback.textContent = "";
    }
  });
})();
