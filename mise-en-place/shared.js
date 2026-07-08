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
  const K_LOG = "qentina.mep.haccp.log";  // journal HACCP daté (traçabilité)

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
      haccp: defaultHaccp(),
    };
  }

  /* ----- Relevés HACCP par défaut (obligatoires avant/après service) ----- */
  function defaultHaccp() {
    return {
      moments: [
        { id: uid("m"), name: "Avant service" },
        { id: uid("m"), name: "Après service" },
      ],
      points: [
        { id: uid("h"), name: "Frigo pizza (positif)", min: 0, max: 4 },
        { id: uid("h"), name: "Frigo préparations (positif)", min: 0, max: 4 },
        { id: uid("h"), name: "Vitrine réfrigérée", min: 0, max: 4 },
        { id: uid("h"), name: "Congélateur", min: -30, max: -18 },
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
    // HACCP
    if (!cfg.haccp || typeof cfg.haccp !== "object") cfg.haccp = defaultHaccp();
    if (!Array.isArray(cfg.haccp.moments) || !cfg.haccp.moments.length) {
      cfg.haccp.moments = defaultHaccp().moments;
    }
    if (!Array.isArray(cfg.haccp.points)) cfg.haccp.points = [];
    cfg.haccp.moments.forEach((m) => { if (!m.id) m.id = uid("m"); });
    cfg.haccp.points.forEach((pt) => {
      if (!pt.id) pt.id = uid("h");
      pt.min = Number(pt.min); pt.max = Number(pt.max);
      if (isNaN(pt.min)) pt.min = 0;
      if (isNaN(pt.max)) pt.max = 4;
    });
    return cfg;
  }

  /* Conformité d'un relevé : 'ok', 'bad' ou 'empty' */
  function haccpState(value, point) {
    if (value === "" || value === null || value === undefined) return "empty";
    const v = Number(value);
    if (isNaN(v)) return "empty";
    return v >= point.min && v <= point.max ? "ok" : "bad";
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
    let p = { date: todayKey(), checked: {}, haccp: {} };
    try {
      const raw = localStorage.getItem(K_PROG);
      if (raw) p = JSON.parse(raw);
    } catch (e) { /* ignore */ }
    if (p.date !== todayKey()) { p = { date: todayKey(), checked: {}, haccp: {} }; }
    if (!p.checked) p.checked = {};
    if (!p.haccp) p.haccp = {};   // { momentId: { pointId: { v, action } } }
    return p;
  }
  function saveProgress(p) {
    try { localStorage.setItem(K_PROG, JSON.stringify(p)); } catch (e) { /* quota */ }
  }

  /* ----- Journal HACCP (traçabilité, conservé localement) ----- */
  function loadHaccpLog() {
    try { const r = localStorage.getItem(K_LOG); if (r) return JSON.parse(r); } catch (e) {}
    return [];
  }
  function saveHaccpLog(log) {
    try { localStorage.setItem(K_LOG, JSON.stringify(log)); } catch (e) {}
  }
  /* Met à jour l'enregistrement du jour à partir des relevés courants */
  function recordHaccpDay(cfg, progress) {
    const log = loadHaccpLog();
    const rows = [];
    cfg.haccp.moments.forEach((m) => {
      cfg.haccp.points.forEach((pt) => {
        const cell = (progress.haccp[m.id] || {})[pt.id];
        if (!cell || cell.v === "" || cell.v == null) return;
        const st = haccpState(cell.v, pt);
        rows.push({
          moment: m.name, point: pt.name, min: pt.min, max: pt.max,
          value: cell.v, conform: st === "ok",
          action: st === "bad" ? (cell.action || "") : "",
        });
      });
    });
    const rec = { date: todayKey(), dateFr: frenchDate(), rows: rows };
    const i = log.findIndex((d) => d.date === rec.date);
    if (i >= 0) log[i] = rec; else log.push(rec);
    // Conserve ~15 mois de traçabilité
    log.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (log.length > 460) log.length = 460;
    saveHaccpLog(log);
    return rec;
  }
  /* Export CSV de tout le journal (séparateur ; pour Excel FR) */
  function haccpCsv() {
    const log = loadHaccpLog();
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const head = ["Date", "Moment", "Équipement", "Température (°C)", "Seuil min", "Seuil max", "Conformité", "Action corrective"];
    const lines = [head.map(esc).join(";")];
    log.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((d) => {
      d.rows.forEach((r) => {
        lines.push([d.dateFr, r.moment, r.point, r.value, r.min, r.max,
          r.conform ? "Conforme" : "NON CONFORME", r.action].map(esc).join(";"));
      });
    });
    return "﻿" + lines.join("\r\n");   // BOM pour l'ouverture directe dans Excel
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
    uid: uid, mkItems: mkItems, defaultConfig: defaultConfig, defaultHaccp: defaultHaccp,
    normalize: normalize, haccpState: haccpState,
    loadConfig: loadConfig, saveConfig: saveConfig, hasStoredConfig: hasStoredConfig,
    loadProgress: loadProgress, saveProgress: saveProgress,
    loadHaccpLog: loadHaccpLog, recordHaccpDay: recordHaccpDay, haccpCsv: haccpCsv,
    encodeConfig: encodeConfig, decodeConfig: decodeConfig, buildStaffLink: buildStaffLink,
    todayKey: todayKey, frenchDate: frenchDate, escapeHtml: escapeHtml,
  };
})();
