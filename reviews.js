/* ============================================================
   QENTINA — Avis Google (API JavaScript Google Places)
   ------------------------------------------------------------
   La clé ci-dessous est RESTREINTE par domaine (referrer HTTP) :
   elle ne fonctionne que depuis le site officiel QENTINA et reste
   donc inutilisable ailleurs. C'est la méthode recommandée par
   Google pour un site statique.

   Pré-requis côté Google Cloud pour cette clé :
     - APIs activées : « Maps JavaScript API » ET « Places API »
     - Restriction de site web (referrer) incluant :
         https://qentinalouviers-sys.github.io/*
   ============================================================ */
var GOOGLE_REVIEWS = {
  apiKey: "AIzaSyDoP4ojCuUzQIf9EFmkgWcEBcPtSFWcIGQ",
  placeId: "",
  query: "QENTINA pizzeria 20 rue Maréchal Foch 27400 Louviers"
};

(function () {
  "use strict";

  var section = document.getElementById("avis");
  var grid = document.getElementById("reviewsGrid");
  var ratingEl = document.getElementById("reviewsRating");
  if (!section || !grid) return;

  if (!GOOGLE_REVIEWS.apiKey || GOOGLE_REVIEWS.apiKey.indexOf("__") === 0) {
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

  function renderRating(place) {
    if (!place.rating) return;
    var score = place.rating.toFixed(1).replace(".", ",");
    var total = place.user_ratings_total ? " · " + place.user_ratings_total + " avis" : "";
    ratingEl.innerHTML =
      '<span class="reviews__score">' + score + "</span>" +
      stars(place.rating) +
      '<span class="reviews__count">' + total + "</span>";

    // Badge flottant de la note, mis en avant dès l'ouverture
    var badge = document.getElementById("heroRating");
    if (badge) {
      var num = document.getElementById("heroRatingNum");
      var st = document.getElementById("heroRatingStars");
      var cnt = document.getElementById("heroRatingCount");
      if (num) num.textContent = score;
      if (st) st.innerHTML = stars(place.rating);
      if (cnt) cnt.textContent = place.user_ratings_total ? place.user_ratings_total + " avis Google" : "sur Google";
      if (place.url) badge.href = place.url;
      badge.hidden = false;
      requestAnimationFrame(function () { badge.classList.add("is-in"); });
    }
  }

  function renderPhotos(photos) {
    var wrap = document.getElementById("reviewsPhotos");
    if (!wrap) return;
    if (!photos || !photos.length) { wrap.style.display = "none"; return; }
    var list = photos.slice(0, 6);
    wrap.innerHTML = list.map(function (ph) {
      var url;
      try { url = ph.getUrl({ maxWidth: 600, maxHeight: 600 }); } catch (e) { return ""; }
      return '<a class="gphoto" href="' + url + '" target="_blank" rel="noopener" aria-label="Agrandir la photo">' +
        '<img src="' + url + '" alt="Photo de la pizzeria QENTINA" loading="lazy" referrerpolicy="no-referrer" /></a>';
    }).join("");
  }

  function renderReviews(reviews) {
    if (!reviews || !reviews.length) {
      showState("Aucun avis à afficher pour le moment.");
      return;
    }
    var list = reviews.slice(0, 5);
    var cards = list.map(function (r) {
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
    });

    // 6e tuile : invitation à laisser un avis (équilibre la grille et incite au dépôt)
    var writeEl = document.getElementById("reviewWrite");
    var writeHref = writeEl ? writeEl.getAttribute("href") : "#";
    var cta =
      '<a class="review review--cta reveal" href="' + escapeHtml(writeHref) + '" target="_blank" rel="noopener">' +
        '<span class="review--cta__plus" aria-hidden="true">+</span>' +
        '<p class="review--cta__title">Vous aussi&nbsp;?</p>' +
        '<p class="review--cta__text">Partagez votre expérience et régalez les gourmands de Louviers.</p>' +
        '<span class="review--cta__link">Laisser un avis&nbsp;→</span>' +
      "</a>";

    grid.innerHTML = cards.join("") + cta;

    grid.querySelectorAll(".reveal").forEach(function (el, i) {
      el.style.setProperty("--d", (i * 0.06) + "s");
      requestAnimationFrame(function () { el.classList.add("is-visible"); });
    });
  }

  window.__qentinaInitReviews = function () {
    try {
      var service = new google.maps.places.PlacesService(document.createElement("div"));
      var fields = ["name", "rating", "user_ratings_total", "reviews", "url", "photos"];

      function setWriteLink(placeId) {
        var write = document.getElementById("reviewWrite");
        if (write && placeId) {
          write.href = "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(placeId);
        }
      }

      function details(placeId) {
        setWriteLink(placeId);
        service.getDetails(
          { placeId: placeId, fields: fields, language: "fr" },
          function (place, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              renderRating(place);
              renderPhotos(place.photos);
              renderReviews(place.reviews);
              if (place.url) {
                var more = document.getElementById("reviewsMore");
                if (more) more.href = place.url;
              }
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

  // Erreur d'authentification Google (clé non autorisée pour ce domaine, API non activée…)
  window.gm_authFailure = function () {
    showState("La clé Google n'est pas autorisée pour ce site (vérifiez les restrictions et les API activées).");
  };

  var s = document.createElement("script");
  s.src =
    "https://maps.googleapis.com/maps/api/js?key=" +
    encodeURIComponent(GOOGLE_REVIEWS.apiKey) +
    "&libraries=places&language=fr&loading=async&callback=__qentinaInitReviews";
  s.async = true;
  s.onerror = function () { showState("Impossible de joindre Google Maps."); };
  document.head.appendChild(s);
})();
