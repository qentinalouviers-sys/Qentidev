/* ============================================================
   QENTINA — Avis Google (via proxy sécurisé)
   ------------------------------------------------------------
   CONFIGURATION : collez l'URL de votre Cloudflare Worker.
   AUCUNE clé API n'est présente ici : le proxy la garde secrète.
   Exemple : https://qentina-avis.votre-sous-domaine.workers.dev

   Guide d'installation : DEPLOIEMENT-AVIS.md
   ============================================================ */
var QENTINA_REVIEWS = {
  endpoint: "https://qentidev.qentina-louviers.workers.dev/"
};

(function () {
  "use strict";

  var section = document.getElementById("avis");
  var grid = document.getElementById("reviewsGrid");
  var ratingEl = document.getElementById("reviewsRating");
  if (!section || !grid) return;

  // Tant que l'URL du proxy n'est pas renseignée, on masque la section.
  if (!QENTINA_REVIEWS.endpoint || QENTINA_REVIEWS.endpoint.indexOf("__") === 0) {
    section.style.display = "none";
    return;
  }

  function stars(rating) {
    var full = Math.round(rating || 0);
    var s = "";
    for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= full ? "on" : "off") + '">★</span>';
    return '<span class="stars">' + s + "</span>";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function showState(msg) {
    grid.innerHTML = '<p class="reviews__state">' + escapeHtml(msg) + "</p>";
  }

  function renderRating(data) {
    if (!data.rating) return;
    var total = data.total ? " · " + data.total + " avis" : "";
    ratingEl.innerHTML =
      '<span class="reviews__score">' + Number(data.rating).toFixed(1).replace(".", ",") + "</span>" +
      stars(data.rating) +
      '<span class="reviews__count">' + total + "</span>";
  }

  function renderReviews(reviews) {
    if (!reviews || !reviews.length) {
      showState("Aucun avis à afficher pour le moment.");
      return;
    }
    var list = reviews.slice(0, 6);
    grid.innerHTML = list.map(function (r) {
      var photo = r.profile_photo_url
        ? '<img src="' + escapeHtml(r.profile_photo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
        : '<span class="review__avatar-fallback">' + escapeHtml((r.author_name || "?").charAt(0)) + "</span>";
      return (
        '<article class="review reveal">' +
          '<div class="review__head">' +
            '<div class="review__avatar">' + photo + "</div>" +
            "<div>" +
              '<p class="review__name">' + escapeHtml(r.author_name) + "</p>" +
              '<p class="review__date">' + escapeHtml(r.relative_time_description || "") + "</p>" +
            "</div>" +
          "</div>" +
          stars(r.rating) +
          '<p class="review__text">' + escapeHtml(r.text) + "</p>" +
        "</article>"
      );
    }).join("");

    grid.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.setProperty("--d", (i * 0.06) + "s");
      requestAnimationFrame(function () { el.classList.add("is-visible"); });
    });
  }

  // Appel du proxy sécurisé (aucune clé côté navigateur).
  fetch(QENTINA_REVIEWS.endpoint, { method: "GET" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || data.error) {
        showState("Les avis ne sont pas disponibles pour le moment.");
        return;
      }
      renderRating(data);
      renderReviews(data.reviews);
      if (data.url) {
        var more = document.getElementById("reviewsMore");
        if (more) more.href = data.url;
      }
    })
    .catch(function () {
      showState("Impossible de charger les avis pour le moment.");
    });
})();
