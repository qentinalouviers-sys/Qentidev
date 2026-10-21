/* ============================================================
   QENTINA — Concours « La Nuit du Four Hanté » (Cloudflare Worker + D1)
   ------------------------------------------------------------
   Enregistre les scores du jeu qentina.fr/halloween/, tient le
   classement, délivre les codes tiramisu et exporte les gagnants.

   Liaisons à définir dans Cloudflare (Settings → Bindings / Variables) :
     DB               (D1)      → base « qentina-concours »
     ADMIN_KEY        (secret)  → mot de passe des exports (au choix)
     ALLOWED_ORIGINS  (option)  → par défaut https://qentina.fr,https://www.qentina.fr

   Routes publiques :
     POST /api/scores   → enregistre une partie, renvoie rang + top 5
     GET  /api/wheel    → état de la roue (ouverte, tiramisus restants aujourd'hui, gros lots restants)
     POST /api/wheel    → tirage de la roue, un seul par email
     GET  /api/top      → top 10 du classement
   Routes admin (?key=ADMIN_KEY) :
     GET  /api/admin/export?what=players   → CSV de tous les joueurs
     GET  /api/admin/export?what=finalists → CSV du top 5 avec emails
     GET  /api/admin/export?what=daily     → CSV des champions du jour
     GET  /api/admin/draw?n=1              → tirage au sort du plein d'essence
     GET  /api/admin/wheel-init            → tire les instants gagnants de la roue (à faire avant l'ouverture du 21/10 à 18 h)
     GET  /api/admin/export?what=wheel     → CSV de tous les tirages de la roue
     GET  /api/admin/export?what=instants  → CSV des instants gagnants et de leurs gagnants
     GET  /api/admin/code?code=TIRA-XXXXX  → vérifie un code gagnant (page comptoir)
     POST /api/admin/code?code=TIRA-XXXXX  → enregistre la remise du lot (une seule fois)

   Guide pas à pas : DEPLOIEMENT-CONCOURS.md
   ============================================================ */

// Heures de Paris converties en UTC (changement d'heure le 25 octobre).
const START = Date.parse("2026-10-21T16:00:00Z"); // mercredi 21/10 18:00 (UTC+2)
const END = Date.parse("2026-10-30T22:59:59Z");   // vendredi 30/10 23:59:59 (UTC+1)
const PURGE_AFTER = Date.parse("2027-01-31T00:00:00Z"); // RGPD : 3 mois après la fin
const TIRAMISU_AT = 15;
const TIRAMISU_MAX = 100; // les 100 premiers seulement
// Roue : 1 an de pizzas + 1 plein par instants gagnants, 150 tiramisus répartis sur 10 jours (21 → 30/10).
const WHEEL_TIRAMISU = 150;
const WHEEL_DAYS = 10;
const WHEEL_LOTS = ["pizzas", "plein"];
// Les instants gagnants tombent entre le 22/10 10 h et le 29/10 22 h (heure de Paris),
// pour qu'ils soient presque sûrement réclamés avant la clôture.
const INSTANT_FROM = Date.parse("2026-10-22T08:00:00Z");
const INSTANT_TO = Date.parse("2026-10-29T21:00:00Z");
const DEFAULT_ORIGINS = "https://qentina.fr,https://www.qentina.fr";

const BANNED = ["pute", "salope", "encul", "nique", "connard", "connasse", "batard", "nazi", "hitler",
  "tapette", "negre", "bite", "couille", "merde", "salaud", "enfoir", "abruti", "pede", "chatte", "sexe"];
const BANNED_TOKENS = ["con", "fdp", "pd", "ntm", "tg", "nik"];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/scores" && request.method === "POST") return await postScore(request, env, cors);
      if (url.pathname === "/api/top" && request.method === "GET") return await getTop(env, cors);
      if (url.pathname === "/api/wheel" && request.method === "GET") return await getWheel(env, cors);
      if (url.pathname === "/api/wheel" && request.method === "POST") return await postWheel(request, env, cors);
      if (url.pathname.startsWith("/api/admin/")) {
        if (!env.ADMIN_KEY || url.searchParams.get("key") !== env.ADMIN_KEY) return json({ error: "forbidden" }, 403, cors);
        if (url.pathname === "/api/admin/export") return await adminExport(url, env);
        if (url.pathname === "/api/admin/draw") return await adminDraw(url, env, cors);
        if (url.pathname === "/api/admin/wheel-init") return json(await initWheel(env.DB), 200, cors);
        if (url.pathname === "/api/admin/code") return await adminCode(url, request, env, cors);
      }
      return json({ error: "not_found" }, 404, cors);
    } catch (e) {
      return json({ error: "server", message: String(e && e.message || e) }, 500, cors);
    }
  },

  // Déclencheur planifié (facultatif) : efface les données après le 31 janvier 2027.
  async scheduled(event, env) {
    if (Date.now() < PURGE_AFTER) return;
    await env.DB.batch(["plays", "players", "wheel_spins", "wheel_lots", "redemptions"].map((t) => env.DB.prepare("DELETE FROM " + t)));
  },
};

/* ---------- Public ---------- */

async function postScore(request, env, cors) {
  const now = Date.now();
  if (now < START) return json({ error: "not_started" }, 403, cors);
  if (now > END) return json({ error: "closed" }, 403, cors);

  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "bad_request" }, 400, cors); }

  const pseudo = String(b.pseudo || "").trim().replace(/\s+/g, " ");
  const email = String(b.email || "").trim().toLowerCase();
  const score = toInt(b.score), pizzas = toInt(b.pizzas), hits = toInt(b.hits), duration = toInt(b.duration);

  if (!/^[\p{L}\p{N} _.\-']{2,16}$/u.test(pseudo)) return json({ error: "pseudo_invalid" }, 400, cors);
  if (isBanned(pseudo)) return json({ error: "pseudo_refused" }, 400, cors);
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "email_invalid" }, 400, cors);
  if (b.rules !== true) return json({ error: "rules_required" }, 400, cors);
  if ([score, pizzas, hits, duration].some((v) => v == null)) return json({ error: "bad_request" }, 400, cors);
  if (!plausible(score, pizzas, hits, duration)) return json({ error: "invalid_score" }, 422, cors);

  const db = env.DB;
  const iso = new Date(now).toISOString();
  let player = await db.prepare("SELECT * FROM players WHERE email = ?").bind(email).first();

  if (player && player.last_play_at && now - Date.parse(player.last_play_at) < 3000) {
    return json({ error: "too_fast" }, 429, cors);
  }

  // Un pseudo = une personne : il ne peut pas être repris par un autre email.
  const owner = await db.prepare("SELECT email FROM players WHERE pseudo = ? COLLATE NOCASE").bind(pseudo).first();
  if (owner && owner.email !== email) return json({ error: "pseudo_taken" }, 409, cors);

  if (!player) {
    await db.prepare(
      "INSERT INTO players (email, pseudo, best, best_pizzas, best_at, newsletter, created_at, plays, last_play_at) VALUES (?, ?, 0, 0, NULL, ?, ?, 0, ?)"
    ).bind(email, pseudo, b.newsletter ? 1 : 0, iso, iso).run();
    player = { email, pseudo, best: 0, best_pizzas: 0, best_at: null, tiramisu_code: null };
  }

  const improved = score > player.best;
  let code = player.tiramisu_code;
  let tiramisuOut = false;
  if (!code && pizzas >= TIRAMISU_AT) {
    const given = await db.prepare("SELECT COUNT(*) AS n FROM players WHERE tiramisu_code IS NOT NULL").first();
    if ((given ? given.n : 0) < TIRAMISU_MAX) code = makeCode("TIRA"); else tiramisuOut = true;
  }

  await db.batch([
    db.prepare("INSERT INTO plays (email, score, pizzas, day, created_at) VALUES (?, ?, ?, ?, ?)").bind(email, score, pizzas, parisDay(now), iso),
    db.prepare(
      `UPDATE players SET pseudo = ?, plays = plays + 1, last_play_at = ?,
         newsletter = ?,
         tiramisu_code = COALESCE(tiramisu_code, ?),
         best = CASE WHEN ? > best THEN ? ELSE best END,
         best_pizzas = CASE WHEN ? > best THEN ? ELSE best_pizzas END,
         best_at = CASE WHEN ? > best THEN ? ELSE best_at END
       WHERE email = ?`
    ).bind(pseudo, iso, b.newsletter ? 1 : 0, code, score, score, score, pizzas, score, iso, email),
  ]);

  const me = await db.prepare("SELECT pseudo, best, best_pizzas, best_at, tiramisu_code FROM players WHERE email = ?").bind(email).first();
  const rankRow = await db.prepare(
    "SELECT COUNT(*) AS n FROM players WHERE hidden = 0 AND best > 0 AND (best > ?1 OR (best = ?1 AND best_at < ?2))"
  ).bind(me.best, me.best_at || iso).first();
  const top = await topList(db, 5);

  return json({
    rank: (rankRow ? rankRow.n : 0) + 1,
    best: me.best,
    improved,
    tiramisu: me.tiramisu_code || null,
    tiramisuOut,
    me: { pseudo: me.pseudo, score: me.best, pizzas: me.best_pizzas, me: true },
    top: top.map((r) => (r.pseudo.toLowerCase() === me.pseudo.toLowerCase() ? { ...r, me: true } : r)),
  }, 200, cors);
}

async function getTop(env, cors) {
  const top = await topList(env.DB, 10);
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM players WHERE hidden = 0").first();
  return json({ top, players: count ? count.n : 0 }, 200, { ...cors, "Cache-Control": "public, max-age=10" });
}

async function topList(db, n) {
  const { results } = await db.prepare(
    "SELECT pseudo, best AS score, best_pizzas AS pizzas FROM players WHERE hidden = 0 AND best > 0 ORDER BY best DESC, best_at ASC LIMIT ?"
  ).bind(n).all();
  return results || [];
}

/* ---------- Roue ---------- */

const WHEEL_LABELS = { pizzas: "1 an de pizzas", plein: "Plein d'essence", tiramisu: "Tiramisu", perdu: "Pas de chance", pending: "En cours" };

// Stock cumulé : 150 × (jours écoulés / 7). Ce qui n'est pas gagné un jour reste disponible le lendemain.
function tiramisuCap(now) {
  // Jour calendaire de Paris (0 = mercredi 21/10), insensible au changement d'heure du 25/10.
  const elapsed = (Date.parse(parisDay(now) + "T00:00:00Z") - Date.parse(parisDay(START) + "T00:00:00Z")) / 86400000;
  const day = Math.min(WHEEL_DAYS - 1, Math.max(0, Math.round(elapsed)));
  return Math.round(WHEEL_TIRAMISU * (day + 1) / WHEEL_DAYS);
}

// Tire les instants gagnants une seule fois (ids fixes + INSERT OR IGNORE : sans effet si déjà fait).
async function initWheel(db) {
  const iso = new Date().toISOString();
  await db.batch(WHEEL_LOTS.map((kind, i) => {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const instant = new Date(INSTANT_FROM + (r[0] / 4294967296) * (INSTANT_TO - INSTANT_FROM)).toISOString();
    return db.prepare("INSERT OR IGNORE INTO wheel_lots (id, kind, instant, drawn_at) VALUES (?, ?, ?, ?)").bind(i + 1, kind, instant, iso);
  }));
  const { results } = await db.prepare("SELECT kind, drawn_at FROM wheel_lots ORDER BY id").all();
  return { ok: true, lots: results.map((r) => ({ lot: WHEEL_LABELS[r.kind], tire_au_sort_le: r.drawn_at })) };
}

async function wheelState(db, now) {
  const t = await db.prepare("SELECT COUNT(*) AS n FROM wheel_spins WHERE result = 'tiramisu'").first();
  const big = await db.prepare("SELECT kind FROM wheel_lots WHERE email IS NULL").all();
  const given = t ? t.n : 0;
  return {
    open: now >= START && now <= END,
    tiramisuLeftToday: Math.max(0, tiramisuCap(now) - given),
    tiramisuLeftTotal: Math.max(0, WHEEL_TIRAMISU - given),
    bigLeft: (big.results || []).map((r) => r.kind),
  };
}

async function getWheel(env, cors) {
  const now = Date.now();
  const lots = await env.DB.prepare("SELECT COUNT(*) AS n FROM wheel_lots").first();
  const state = await wheelState(env.DB, now);
  if (!lots || !lots.n) state.bigLeft = WHEEL_LOTS.slice();
  return json(state, 200, { ...cors, "Cache-Control": "public, max-age=15" });
}

async function postWheel(request, env, cors) {
  const now = Date.now();
  if (now < START) return json({ error: "not_started" }, 403, cors);
  if (now > END) return json({ error: "closed" }, 403, cors);

  let b;
  try { b = await request.json(); } catch (e) { return json({ error: "bad_request" }, 400, cors); }
  const email = String(b.email || "").trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "email_invalid" }, 400, cors);
  if (b.rules !== true) return json({ error: "rules_required" }, 400, cors);

  const db = env.DB;
  const iso = new Date(now).toISOString();

  // Un seul tirage par email : la clé primaire garantit l'unicité, même en cas de double clic.
  const ins = await db.prepare("INSERT OR IGNORE INTO wheel_spins (email, result, newsletter, created_at) VALUES (?, 'pending', ?, ?)")
    .bind(email, b.newsletter ? 1 : 0, iso).run();
  if (!ins.meta.changes) {
    const prev = await db.prepare("SELECT result, code FROM wheel_spins WHERE email = ?").bind(email).first();
    return json({ already: true, result: prev && prev.result !== "pending" ? prev.result : "perdu", code: prev ? prev.code : null }, 200, cors);
  }

  await initWheel(db); // sans effet si les instants ont déjà été tirés

  let result = "perdu", code = null;
  // Gros lot : le premier tirage après un instant gagnant non réclamé le remporte (mise à jour atomique).
  const claim = await db.prepare(
    `UPDATE wheel_lots SET email = ?, won_at = ?
      WHERE id = (SELECT id FROM wheel_lots WHERE email IS NULL AND instant <= ? ORDER BY instant LIMIT 1)
        AND email IS NULL`
  ).bind(email, iso, iso).run();
  if (claim.meta.changes) {
    const lot = await db.prepare("SELECT kind FROM wheel_lots WHERE email = ?").bind(email).first();
    result = lot.kind;
    code = makeCode("ROUE");
  } else {
    // Tiramisu, dans la limite du stock cumulé du jour (contrôle et écriture en une seule requête).
    const c = makeCode("ROUE");
    const t = await db.prepare(
      "UPDATE wheel_spins SET result = 'tiramisu', code = ? WHERE email = ? AND (SELECT COUNT(*) FROM wheel_spins WHERE result = 'tiramisu') < ?"
    ).bind(c, email, tiramisuCap(now)).run();
    if (t.meta.changes) { result = "tiramisu"; code = c; }
  }
  if (result !== "tiramisu") await db.prepare("UPDATE wheel_spins SET result = ?, code = ? WHERE email = ?").bind(result, code, email).run();

  return json({ result, code, ...(await wheelState(db, now)) }, 200, cors);
}

/* ---------- Comptoir : vérification et remise des codes ---------- */

const LOT_DEADLINE = Date.parse("2026-11-30T22:59:59Z"); // 30/11/2026 23:59 Paris : tiramisus à retirer avant

async function adminCode(url, request, env, cors) {
  const db = env.DB;
  // Table créée à la volée : aucune migration manuelle nécessaire.
  await db.prepare("CREATE TABLE IF NOT EXISTS redemptions (code TEXT PRIMARY KEY, redeemed_at TEXT NOT NULL)").run();
  const code = String(url.searchParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!/^(TIRA|ROUE)-[A-Z0-9]{5}$/.test(code)) return json({ found: false, error: "format" }, 200, cors);

  let info = null;
  if (code.startsWith("TIRA-")) {
    const r = await db.prepare("SELECT pseudo, email, hidden FROM players WHERE tiramisu_code = ?").bind(code).first();
    if (r) info = { source: "Jeu du Four Hanté", lot: "tiramisu", label: "Tiramisu offert", pseudo: r.pseudo, email: r.email, excluded: !!r.hidden, idRequired: false };
  } else {
    const r = await db.prepare("SELECT email, result FROM wheel_spins WHERE code = ?").bind(code).first();
    if (r) info = { source: "Roue d'Halloween", lot: r.result, label: WHEEL_LABELS[r.result] || r.result, pseudo: null, email: r.email, excluded: false, idRequired: r.result !== "tiramisu" };
  }
  if (!info) return json({ found: false, code }, 200, cors);

  const now = Date.now();
  info.expired = info.lot === "tiramisu" && now > LOT_DEADLINE;
  let justRedeemed = false;
  if (request.method === "POST" && !info.excluded && !info.expired) {
    const r = await db.prepare("INSERT OR IGNORE INTO redemptions (code, redeemed_at) VALUES (?, ?)").bind(code, new Date(now).toISOString()).run();
    justRedeemed = r.meta.changes === 1;
  }
  const red = await db.prepare("SELECT redeemed_at FROM redemptions WHERE code = ?").bind(code).first();
  return json({ found: true, code, ...info, redeemedAt: red ? red.redeemed_at : null, justRedeemed }, 200, cors);
}

/* ---------- Admin ---------- */

async function adminExport(url, env) {
  const what = url.searchParams.get("what") || "players";
  const db = env.DB;
  let rows, cols;
  if (what === "finalists") {
    cols = ["rang", "pseudo", "email", "score", "pizzas", "atteint_le"];
    const { results } = await db.prepare(
      "SELECT pseudo, email, best, best_pizzas, best_at FROM players WHERE hidden = 0 AND best > 0 ORDER BY best DESC, best_at ASC LIMIT 5"
    ).all();
    rows = results.map((r, i) => [i + 1, r.pseudo, r.email, r.best, r.best_pizzas, r.best_at]);
  } else if (what === "wheel") {
    cols = ["email", "resultat", "code", "newsletter", "tire_le"];
    const { results } = await db.prepare("SELECT email, result, code, newsletter, created_at FROM wheel_spins ORDER BY created_at ASC").all();
    rows = results.map((r) => [r.email, WHEEL_LABELS[r.result] || r.result, r.code || "", r.newsletter ? "oui" : "non", r.created_at]);
  } else if (what === "instants") {
    cols = ["lot", "instant_gagnant", "tire_au_sort_le", "gagnant", "gagne_le"];
    const { results } = await db.prepare("SELECT kind, instant, drawn_at, email, won_at FROM wheel_lots ORDER BY instant ASC").all();
    rows = results.map((r) => [WHEEL_LABELS[r.kind], r.instant, r.drawn_at, r.email || "(pas encore gagné)", r.won_at || ""]);
  } else if (what === "daily") {
    cols = ["jour", "pseudo", "email", "score"];
    const { results } = await db.prepare(
      `SELECT p.day, pl.pseudo, p.email, MAX(p.score) AS score, MIN(p.created_at) AS first_at
         FROM plays p JOIN players pl ON pl.email = p.email
        WHERE pl.hidden = 0
        GROUP BY p.day, p.email
        ORDER BY p.day ASC, score DESC, first_at ASC`
    ).all();
    // Un joueur ne gagne ce lot qu'une fois : s'il a déjà été champion, on prend le suivant du jour.
    const days = new Set(), winners = new Set();
    rows = [];
    for (const r of results) {
      if (days.has(r.day) || winners.has(r.email)) continue;
      days.add(r.day);
      winners.add(r.email);
      rows.push([r.day, r.pseudo, r.email, r.score]);
    }
  } else {
    cols = ["pseudo", "email", "meilleur_score", "pizzas", "atteint_le", "parties", "newsletter", "code_tiramisu", "inscrit_le", "masque"];
    const { results } = await db.prepare(
      "SELECT pseudo, email, best, best_pizzas, best_at, plays, newsletter, tiramisu_code, created_at, hidden FROM players ORDER BY best DESC, best_at ASC"
    ).all();
    rows = results.map((r) => [r.pseudo, r.email, r.best, r.best_pizzas, r.best_at, r.plays, r.newsletter ? "oui" : "non", r.tiramisu_code || "", r.created_at, r.hidden ? "oui" : "non"]);
  }
  const csv = "﻿" + [cols, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="concours-halloween-${what}.csv"`,
    },
  });
}

async function adminDraw(url, env, cors) {
  const n = Math.min(10, Math.max(1, toInt(url.searchParams.get("n")) || 1));
  const { results } = await env.DB.prepare("SELECT pseudo, email FROM players WHERE hidden = 0").all();
  const pool = results.slice();
  const winners = [];
  while (winners.length < n && pool.length) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    winners.push(pool.splice(r[0] % pool.length, 1)[0]);
  }
  return json({ participants: results.length, winners, drawn_at: new Date().toISOString() }, 200, cors);
}

/* ---------- Helpers ---------- */

// Bornes larges : bloquent les scores bricolés sans gêner un vrai joueur.
// Le grand prix se joue de toute façon en live sur la tablette du restaurant.
function plausible(score, pizzas, hits, duration) {
  if (score < 0 || pizzas < 0 || hits < 0 || duration < 0) return false;
  if (score > 100000 || hits > 5000) return false;
  if (pizzas > Math.floor(hits / 3)) return false;
  if (duration + 1 < hits * 0.2 + pizzas * 0.5) return false;
  return score <= hits * 35 + pizzas * 25 + duration * 6 + 50;
}

function isBanned(pseudo) {
  const flat = pseudo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  const squashed = flat.replace(/[^a-z]/g, "");
  if (BANNED.some((w) => squashed.includes(w))) return true;
  const tokens = flat.split(/[^a-z]+/).filter(Boolean);
  return tokens.some((t) => BANNED_TOKENS.includes(t));
}

function makeCode(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = new Uint8Array(5);
  crypto.getRandomValues(r);
  return prefix + "-" + Array.from(r, (v) => alphabet[v % alphabet.length]).join("");
}

function parisDay(ms) {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
