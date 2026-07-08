/* ============================================================
   QENTINA — Mise en Place · socle commun
   Modèle de configuration partagé entre l'espace salarié
   (index.html) et l'espace admin (admin.html).

   Contrainte : site 100 % statique (aucun serveur). La config
   des postes voyage donc dans le LIEN partagé (encodée en
   base64 dans le hash de l'URL), puis est mémorisée localement
   sur l'appareil qui l'ouvre.
   ============================================================ */
window.MEP = (function () {
  "use strict";

  const K_CFG = "qentina.mep.config";     // configuration des postes (partagée via le lien)
  const K_PROG = "qentina.mep.progress";  // avancement du jour (propre à chaque appareil)

  /* Génère un identifiant court et unique */
  function uid(prefix) {
    return (prefix || "id") + "_" +
      Math.random().toString(36).slice(2, 7) +
      Date.now().toString(36).slice(-4);
  }

  /* Fabrique une liste d'items {id,label} à partir de libellés */
  function mkItems(labels) {
    return labels.map((l) => ({ id: uid("it"), label: l }));
  }

  /* ----- Configuration par défaut (point de départ modifiable) ----- */
  function defaultConfig() {
    return {
      postes: [
        { id: uid("p"), name: "Ouverture", icon: "🔑", items: mkItems([
          "Allumer le four et vérifier la montée en température",
          "Contrôler les températures des frigos",
          "Vérifier la caisse et le fond de monnaie",
          "Mettre en route la machine à café",
        ]) },
        { id: uid("p"), name: "Poste pizza", icon: "🍕", items: mkItems([
          "Sortir et pointer les pâtons",
          "Préparer la sauce tomate du jour",
          "Râper / trancher les mozzarellas",
          "Disposer les garnitures en bacs",
          "Fariner le plan de travail",
        ]) },
        { id: uid("p"), name: "Poste froid / salades", icon: "🥗", items: mkItems([
          "Laver et essorer les salades",
          "Préparer les vinaigrettes",
          "Découper les crudités",
          "Vérifier les DLC des produits frais",
        ]) },
        { id: uid("p"), name: "Salle", icon: "🍽️", items: mkItems([
          "Dresser et nettoyer les tables",
          "Vérifier couverts et serviettes",
          "Réassort des cartes et menus",
          "Balayer et passer la serpillière",
        ]) },
        { id: uid("p"), name: "Bar / boissons", icon: "🥤", items: mkItems([
          "Réassort du frigo boissons",
          "Vérifier le stock de glaçons",
          "Contrôler tireuse / softs",
        ]) },
        { id: uid("p"), name: "Fermeture", icon: "🌙", items: mkItems([
          "Nettoyer le four et le plan de travail",
          "Filmer et ranger les bacs de garniture",
          "Sortir les poubelles",
          "Faire la caisse et clôturer",
          "Éteindre les équipements",
        ]) },
      ],
    };
  }

  /* Remet une config au propre (ids manquants, tableaux, etc.) */
  function normalize(cfg) {
    if (!cfg || !Array.isArray(cfg.postes)) return defaultConfig();
    cfg.postes.forEach((p) => {
      if (!p.id) p.id = uid("p");
      if (!p.icon) p.icon = "📋";
      if (!Array.isArray(p.items)) p.items = [];
      p.items = p.items.map((it) => {
        if (typeof it === "string") return { id: uid("it"), label: it };
        if (!it.id) it.id = uid("it");
        return it;
      });
    });
    return cfg;
  }

  /* ----- Persistance ----- */
  function loadConfig() {
    try {
      const raw = localStorage.getItem(K_CFG);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return defaultConfig();
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(K_CFG, JSON.stringify(cfg)); } catch (e) { /* quota */ }
  }
  function hasStoredConfig() {
    try { return !!localStorage.getItem(K_CFG); } catch (e) { return false; }
  }

  /* ----- Avancement du jour ----- */
  function loadProgress() {
    let p = { date: todayKey(), checked: {} };
    try {
      const raw = localStorage.getItem(K_PROG);
      if (raw) p = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    if (p.date !== todayKey()) { p = { date: todayKey(), checked: {} }; }
    if (!p.checked) p.checked = {};
    return p;
  }
  function saveProgress(p) {
    try { localStorage.setItem(K_PROG, JSON.stringify(p)); } catch (e) { /* quota */ }
  }

  /* ----- Encodage / décodage pour le lien partagé ----- */
  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return decodeURIComponent(escape(atob(s)));
  }
  function encodeConfig(cfg) { return b64urlEncode(JSON.stringify(cfg)); }
  function decodeConfig(s) {
    try { return normalize(JSON.parse(b64urlDecode(s))); }
    catch (e) { return null; }
  }

  /* Construit le lien salarié (index.html) contenant la config */
  function buildStaffLink(cfg) {
    const base = location.href.replace(/admin\.html.*$/i, "").replace(/#.*$/, "");
    const url = base + (base.endsWith("/") ? "" : "/") + "index.html";
    return url + "#cfg=" + encodeConfig(cfg);
  }

  /* ----- Utilitaires ----- */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function frenchDate() {
    return new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  return {
    uid: uid, mkItems: mkItems, defaultConfig: defaultConfig, normalize: normalize,
    loadConfig: loadConfig, saveConfig: saveConfig, hasStoredConfig: hasStoredConfig,
    loadProgress: loadProgress, saveProgress: saveProgress,
    encodeConfig: encodeConfig, decodeConfig: decodeConfig, buildStaffLink: buildStaffLink,
    todayKey: todayKey, frenchDate: frenchDate, escapeHtml: escapeHtml,
  };
})();
