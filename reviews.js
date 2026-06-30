/* ============================================================
   QENTINA — Avis Google (API Google Places)
   ------------------------------------------------------------
   CONFIGURATION : renseignez votre clé API ci-dessous.
   - apiKey : votre clé Google (API « Maps JavaScript » + « Places » activées)
   - placeId : l'identifiant précis de votre établissement (recommandé).
               Si laissé vide, une recherche est faite à partir de « query ».
   ============================================================ */
var GOOGLE_REVIEWS = {
  apiKey: "__GOOGLE_API_KEY__",
  placeId: "",
  query: "QENTINA pizzeria 20 rue Maréchal Foch 27400 Louviers"
};

(function () {
  "use strict";

  var section = document.getElementById("avis");
  var grid = document.getElementById("reviewsGrid");
  var ratingEl = document.getElementById("reviewsRating");
  if (!section || !grid) return;

  // Tant que la clé n'est pas renseignée, on masque proprement la section.
  if (!GOOGLE_REVIEWS.apiKey || GOOGLE_REVIEWS.apiKey.indexOf("__") === 0) {
    section.style.display = "none";
    return;
  }

  /* Construit une rangée d'étoiles pour une note donnée. */
  function stars(rating) {
    var full = Math.round(rating);
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

  function renderRating(place) {
    if (!place.rating) return;
    var total = place.user_ratings_total
      ? " · " + place.user_ratings_total + " avis"
      : "";
    ratingEl.innerHTML =
      '<span class="reviews__score">' + place.rating.toFixed(1).replace(".", ",") + "</span>" +
      stars(place.rating) +
      '<span class="reviews__count">' + total + "</span>";
  }

  function renderReviews(reviews) {
    if (!reviews || !reviews.length) {
      showState("Aucun avis à afficher pour le moment.");
      return;
    }
    // On garde les avis les mieux notés et les plus pertinents (max 6).
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

    // Réactive l'animation d'apparition pour les nouvelles cartes.
    grid.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.setProperty("--d", (i * 0.06) + "s");
      requestAnimationFrame(function () { el.classList.add("is-visible"); });
    });
  }

  function handlePlace(place, googleUrl) {
    renderRating(place);
    renderReviews(place.reviews);
    if (googleUrl) {
      var more = document.getElementById("reviewsMore");
      if (more) more.href = googleUrl;
    }
  }

  /* Appelé par le script Google une fois chargé. */
  window.__qentinaInitReviews = function () {
    try {
      var service = new google.maps.places.PlacesService(document.createElement("div"));
      var fields = ["name", "rating", "user_ratings_total", "reviews", "url"];

      function details(placeId) {
        service.getDetails(
          { placeId: placeId, fields: fields, language: "fr" },
          function (place, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              handlePlace(place, place.url);
            } else {
              showState("Les avis ne sont pas disponibles pour le moment.");
            }
          }
        );
      }

      if (GOOGLE_REVIEWS.placeId) {
        details(GOOGLE_REVIEWS.placeId);
      } else {
        service.findPlaceFromQuery(
          { query: GOOGLE_REVIEWS.query, fields: ["place_id"] },
          function (res, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK && res && res[0]) {
              details(res[0].place_id);
            } else {
              showState("Établissement introuvable sur Google.");
            }
          }
        );
      }
    } catch (e) {
      showState("Impossible de charger les avis Google.");
    }
  };

  /* Gestion d'une erreur de chargement du script Google (clé invalide, etc.). */
  window.gm_authFailure = function () {
    showState("La clé Google n'est pas autorisée pour ce site.");
  };

  // Chargement du script Google Maps + Places.
  var s = document.createElement("script");
  s.src =
    "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(GOOGLE_REVIEWS.apiKey) +
    "&libraries=places&language=fr&loading=async&callback=__qentinaInitReviews";
  s.async = true;
  s.onerror = function () { showState("Impossible de joindre Google Maps."); };
  document.head.appendChild(s);
})();
