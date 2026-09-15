/* QENTINA — consentement cookies (CNIL / RGPD)
 * - Umami (cloud.umami.is) est sans cookie et exempté de consentement : chargé toujours.
 * - Google Analytics (gtag.js) dépose des cookies : chargé UNIQUEMENT après acceptation.
 * - Le choix est mémorisé 6 mois (durée max recommandée par la CNIL), refus compris.
 * - window.qentinaConsent.open() rouvre le bandeau (lien "Cookies" du pied de page).
 */
(function () {
  "use strict";

  var GA_ID = "G-VY0VRENTEY";
  var STORAGE_KEY = "qentinaConsent";
  var CONSENT_TTL_MS = 182 * 24 * 60 * 60 * 1000; // ~6 mois
  var gaLoaded = false;
  var banner = null;

  function readChoice() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.analytics !== "boolean" || typeof data.at !== "number") return null;
      if (Date.now() - data.at > CONSENT_TTL_MS) { localStorage.removeItem(STORAGE_KEY); return null; }
      return data;
    } catch (e) { return null; }
  }

  function saveChoice(analytics) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ analytics: analytics, at: Date.now() })); } catch (e) {}
  }

  function loadGA() {
    if (gaLoaded) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted"
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function deleteGACookies() {
    var host = location.hostname;
    var domains = ["", host, "." + host];
    var parts = host.split(".");
    if (parts.length > 2) domains.push("." + parts.slice(-2).join("."));
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!/^(_ga|_ga_|_gid|_gat)/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : "");
      });
    });
  }

  function revokeGA() {
    if (window.gtag) {
      try { window.gtag("consent", "update", { analytics_storage: "denied" }); } catch (e) {}
    }
    deleteGACookies();
  }

  function applyChoice(analytics) {
    saveChoice(analytics);
    if (analytics) loadGA(); else revokeGA();
    closeBanner();
  }

  function closeBanner() {
    if (!banner) return;
    var el = banner;
    banner = null;
    el.classList.remove("is-shown");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500);
  }

  /* Sur l'accueil, intro.js pose la classe "has-intro" sur <html> pendant l'animation : on attend qu'elle parte. */
  function whenIntroDone(cb) {
    var root = document.documentElement;
    if (!root.classList.contains("has-intro")) { cb(); return; }
    var mo = new MutationObserver(function () {
      if (!root.classList.contains("has-intro")) { mo.disconnect(); cb(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  function openBanner() {
    if (banner) return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", openBanner); return; }
    var current = readChoice();
    banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Gestion des cookies");
    banner.innerHTML =
      '<div class="cookie-banner__inner">' +
        '<div class="cookie-banner__body">' +
          '<span class="cookie-banner__emoji" aria-hidden="true">🍪</span>' +
          '<p class="cookie-banner__text">Chez QENTINA, on préfère les pizzas aux cookies. ' +
            'Notre mesure d’audience de base est <strong>anonyme et sans cookie</strong>. ' +
            'Acceptez-vous en plus <strong>Google Analytics</strong> (cookies de statistiques) pour nous aider à améliorer le site ? ' +
            'Vous pouvez changer d’avis à tout moment via le lien « Cookies » en bas de page.</p>' +
        '</div>' +
        '<div class="cookie-banner__actions">' +
          '<button type="button" class="cookie-banner__btn cookie-banner__btn--refuse" data-consent="refuse">Refuser</button>' +
          '<button type="button" class="cookie-banner__btn cookie-banner__btn--accept" data-consent="accept">Accepter</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);
    whenIntroDone(function () {
      setTimeout(function () { if (banner) banner.classList.add("is-shown"); }, current ? 50 : 900);
    });
    banner.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-consent]");
      if (!btn) return;
      applyChoice(btn.getAttribute("data-consent") === "accept");
    });
  }

  function bindFooterLinks() {
    var links = document.querySelectorAll(".js-cookie-settings");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function (ev) { ev.preventDefault(); openBanner(); });
    }
  }

  var choice = readChoice();
  if (choice && choice.analytics) loadGA();

  function init() {
    bindFooterLinks();
    if (!choice) openBanner();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.qentinaConsent = {
    open: openBanner,
    accept: function () { applyChoice(true); },
    refuse: function () { applyChoice(false); },
    get: readChoice
  };
})();
