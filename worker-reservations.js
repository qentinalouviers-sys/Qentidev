/* ============================================================
   QENTINA — Réservations : récap de service & validation
   ------------------------------------------------------------
   100 % gratuit : aucun service payant, aucun compte à créer en plus
   de Cloudflare. Les emails partent par Web3Forms, que le site utilise
   déjà, et les réponses aux clients par votre propre messagerie.

   Ce Worker fait trois choses :

   1. Il enregistre chaque demande de réservation envoyée par le site.
   2. À l'heure du blocage (2 h avant le début du service), il vous envoie
      un email : « X réservations » + un lien vers la feuille de service.
   3. La feuille de service liste toutes les réservations avec, sur
      chacune, un bouton vert Valider et un bouton rouge Refuser. Le clic
      ouvre le message au client, déjà rédigé et modifiable ; vous
      l'envoyez ensuite par email, WhatsApp ou SMS en un geste.

   Variables à définir dans Cloudflare (Settings → Variables) :
     WEB3FORMS_KEY   (secret) → la clé Web3Forms déjà utilisée par le site
     SIGNING_SECRET  (secret) → phrase secrète au hasard, ≥ 32 caractères
                                (elle signe les liens de la feuille)
     RESTAURANT_EMAIL         → où recevoir le récap
     ALLOWED_ORIGIN           → https://qentina.fr
     PUBLIC_URL               → adresse publique de CE worker, sans / final

   Base de données : un binding D1 nommé DB (voir le guide).

   ⚠️ SERVICES et CLOSURES ci-dessous doivent rester identiques à ceux de
      script.js. Si vous changez vos horaires ou ajoutez une fermeture,
      modifiez les DEUX fichiers.
   ============================================================ */

/* ---------- Horaires (copie de script.js) ---------- */
const SERVICES = {
  2: [[720, 870], [1140, 1350]],
  3: [[720, 870], [1140, 1350]],
  4: [[720, 870], [1140, 1350]],
  5: [[720, 870], [1140, 1380]],
  6: [[1140, 1380]],
};
const CUTOFF = 120;        // le récap part 2 h avant le début du service
const CLOSURES = [
  { from: "2026-08-11", to: "2026-08-13", reason: "travaux" },
  { from: "2026-08-14", to: "2026-08-14", reason: "travaux", only: "Soir" },
];

const TEL = "02 59 16 20 93";

/* ---------- Utilitaires horaires ---------- */
const pad = (n) => (n < 10 ? "0" : "") + n;
const fmtMin = (m) => pad(Math.floor(m / 60)) + "h" + pad(m % 60);
const serviceLabel = (win) => (win[0] < 900 ? "Midi" : "Soir");

function closureFor(dateStr) {
  return CLOSURES.find((c) => dateStr >= c.from && dateStr <= c.to) || null;
}

function openServices(dateStr) {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  const svc = SERVICES[day] || [];
  const c = closureFor(dateStr);
  if (!c) return svc;
  if (!c.only) return [];
  return svc.filter((w) => serviceLabel(w) === c.only);
}

// L'heure de Paris, quel que soit le fuseau du serveur.
function parisNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    min: parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10),
  };
}

function frDate(dateStr) {
  try {
    return new Date(dateStr + "T12:00:00Z").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    });
  } catch { return dateStr; }
}

function parseSlot(timeStr) {
  const m = /^(\d{1,2})h(\d{2})$/.exec(String(timeStr || ""));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function serviceOf(dateStr, slotMin) {
  const win = openServices(dateStr).find((w) => slotMin >= w[0] && slotMin <= w[1]);
  return win ? serviceLabel(win) : null;
}

/* ---------- Liens signés ----------
   Sans signature, n'importe qui devinant l'adresse du Worker pourrait
   ouvrir la feuille de service ou valider une réservation. */
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
}

async function makeToken(payload, secret) {
  return `${payload}.${await sign(payload, secret)}`;
}

async function readToken(token, secret) {
  const t = String(token || "");
  const i = t.lastIndexOf(".");
  if (i < 1) return null;
  const payload = t.slice(0, i), sig = t.slice(i + 1);
  const expected = await sign(payload, secret);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expected.charCodeAt(k);
  return diff === 0 ? payload : null;
}

/* ---------- Messages pré-écrits ---------- */
const firstName = (full) => String(full || "").trim().split(/\s+/)[0] || "";

function defaultReply(r, action) {
  const when = `${frDate(r.date)} à ${r.time}`;
  if (action === "ok") {
    return `Bonjour ${firstName(r.name)},

C'est confirmé : nous vous attendons le ${when} pour ${r.guests || "votre table"}${r.place ? ` (${r.place})` : ""}.

Nous sommes au 20 rue Maréchal Foch à Louviers. Si vous avez le moindre imprévu, un mot au ${TEL} et c'est réglé.

À très vite,
QENTINA`;
  }
  return `Bonjour ${firstName(r.name)},

Merci pour votre demande du ${when}. Nous sommes malheureusement complets sur ce service, nous ne pourrons pas vous accueillir cette fois-ci.

Nous serions ravis de vous recevoir un autre soir : appelez-nous au ${TEL}, nous trouverons un créneau ensemble.

Avec toutes nos excuses,
QENTINA`;
}

const replySubject = (action) =>
  action === "ok" ? "Votre table est confirmée — QENTINA" : "Votre demande de réservation — QENTINA";

/* ---------- Envoi du récap (via Web3Forms, gratuit) ---------- */
async function sendRecapMail(env, { subject, fields }) {
  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      access_key: env.WEB3FORMS_KEY,
      subject,
      from_name: "QENTINA — feuille de service",
      ...fields,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.success) throw new Error(`Web3Forms ${res.status} ${JSON.stringify(out)}`);
  return true;
}

/* ---------- Gabarits ---------- */
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PAPER = "#f4ecd9", CARD = "#fbf5e7", INK = "#173033", TERRA = "#0f5460";
const GREEN = "#0f7a4a", RED = "#b3402c";

const page = (title, inner) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — QENTINA</title>
<style>
  body{margin:0;background:${PAPER};color:${INK};font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:22px 14px}
  .wrap{max-width:640px;margin:0 auto}
  .card{background:${CARD};border:1px solid rgba(23,48,51,.14);border-radius:18px;padding:18px;margin-bottom:14px}
  h1{font-size:22px;margin:0 0 6px}
  .eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${TERRA};margin:0 0 4px}
  .muted{color:#5e6b65;font-size:14px}
  .name{font-size:19px;font-weight:600;margin:0}
  .row{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
  .btn{display:inline-block;border:0;cursor:pointer;padding:12px 22px;border-radius:100px;font:inherit;
    font-weight:600;font-size:15px;text-decoration:none;text-align:center}
  .ok{background:${GREEN};color:#fff}.no{background:${RED};color:#fff}
  .ghost{background:#fff;color:${INK};border:1px solid rgba(23,48,51,.25)}
  .tag{display:inline-block;font-size:13px;font-weight:600;padding:4px 12px;border-radius:100px}
  .tag-ok{background:#e8f5ee;color:${GREEN}}.tag-no{background:#fbeae6;color:${RED}}
  textarea{width:100%;box-sizing:border-box;min-height:230px;padding:12px;border:1px solid rgba(23,48,51,.2);
    border-radius:12px;font:inherit;font-size:15px;line-height:1.5;background:#fff;resize:vertical}
  label{display:block;font-size:14px;font-weight:600;margin:16px 0 6px}
  .note{font-size:13px;color:#5e6b65;margin-top:12px}
  a.plain{color:${TERRA}}
</style></head><body><div class="wrap">${inner}</div></body></html>`;

function serviceSheet(env, rows, dateStr, service, tokens) {
  const covers = rows.reduce((n, r) => n + (parseInt(r.guests, 10) || 0), 0);
  const cards = rows.map((r) => {
    const done = r.status !== "pending";
    return `<div class="card">
      <p class="name">${esc(r.time)} — ${esc(r.name)} · ${esc(r.guests || "?")}</p>
      <p class="muted"><a class="plain" href="tel:${esc(r.phone)}">${esc(r.phone)}</a>
        ${r.email ? ` · <a class="plain" href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ""}</p>
      ${r.place ? `<p class="muted">${esc(r.place)}</p>` : ""}
      ${r.message ? `<p class="muted">💬 ${esc(r.message)}</p>` : ""}
      ${done
        ? `<p><span class="tag ${r.status === "confirmed" ? "tag-ok" : "tag-no"}">
             ${r.status === "confirmed" ? "✅ Validée" : "❌ Refusée"}</span></p>`
        : `<div class="row">
             <a class="btn ok" href="${env.PUBLIC_URL}/action?t=${tokens[r.id].ok}">✅ Valider</a>
             <a class="btn no" href="${env.PUBLIC_URL}/action?t=${tokens[r.id].no}">❌ Refuser</a>
           </div>`}
    </div>`;
  }).join("");

  return page(`Service du ${service.toLowerCase()}`, `
    <div class="card">
      <p class="eyebrow">Service du ${esc(service.toLowerCase())}</p>
      <h1>${esc(frDate(dateStr))}</h1>
      <p class="muted">${rows.length} réservation${rows.length > 1 ? "s" : ""} · ${covers} couvert${covers > 1 ? "s" : ""}</p>
    </div>
    ${cards || '<div class="card"><p class="muted">Aucune réservation pour ce service.</p></div>'}`);
}

function actionPage(env, r, action, token, done) {
  const ok = action === "ok";
  const body = defaultReply(r, action);
  const subject = replySubject(action);
  const enc = encodeURIComponent(body);
  const digits = String(r.phone || "").replace(/[^0-9+]/g, "");
  const waNum = digits.replace(/^\+/, "").replace(/^0/, "33");

  if (!done) {
    return page(ok ? "Valider" : "Refuser", `<div class="card">
      <h1 style="color:${ok ? GREEN : RED}">${ok ? "Valider" : "Refuser"} la réservation</h1>
      <p class="muted"><strong>${esc(r.name)}</strong> · ${esc(r.guests || "?")}<br>
        ${esc(frDate(r.date))} à ${esc(r.time)}<br>
        <a class="plain" href="tel:${esc(r.phone)}">${esc(r.phone)}</a>
        ${r.email ? ` · ${esc(r.email)}` : ""}</p>
      <form method="POST" action="${env.PUBLIC_URL}/action">
        <input type="hidden" name="t" value="${esc(token)}">
        <label for="msg">Message au client (modifiable)</label>
        <textarea id="msg" name="message">${esc(body)}</textarea>
        <div class="row">
          <button class="btn ${ok ? "ok" : "no"}" type="submit">Enregistrer et écrire au client</button>
        </div>
      </form>
    </div>`);
  }

  // Étape 2 : la réservation est enregistrée, on propose l'envoi.
  const msg = done.message;
  const e2 = encodeURIComponent(msg);
  return page("Message au client", `<div class="card">
    <p><span class="tag ${ok ? "tag-ok" : "tag-no"}">${ok ? "✅ Validée" : "❌ Refusée"}</span></p>
    <h1>Envoyer le message à ${esc(firstName(r.name))}</h1>
    <p class="muted">Choisissez le canal : le message est déjà rempli, il ne reste qu'à envoyer.</p>
    <div class="row">
      ${r.email ? `<a class="btn ok" href="mailto:${esc(r.email)}?subject=${encodeURIComponent(subject)}&body=${e2}">✉️ Par email</a>` : ""}
      <a class="btn ghost" href="https://wa.me/${waNum}?text=${e2}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn ghost" href="sms:${esc(digits)}?&body=${e2}">SMS</a>
      <a class="btn ghost" href="tel:${esc(digits)}">Appeler</a>
    </div>
    <p class="note">Le bouton « Par email » ouvre votre messagerie habituelle avec le message
      prêt : l'email partira donc de votre vraie adresse, et le client pourra vous répondre
      directement.</p>
    <label for="copy">Le message, si vous préférez le copier</label>
    <textarea id="copy" readonly>${esc(msg)}</textarea>
  </div>`);
}

const htmlRes = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

/* ============================================================
   Worker
   ============================================================ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    /* --- 1. Le site enregistre une demande --- */
    if (url.pathname === "/reservation" && request.method === "POST") {
      try {
        const b = await request.json();
        const date = String(b.date || "");
        const time = String(b.time || "");
        const slot = parseSlot(time);
        const email = String(b.email || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || slot === null || !b.name || !b.phone || !email) {
          return Response.json({ error: "champs_manquants" }, { status: 400, headers: cors });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return Response.json({ error: "email_invalide" }, { status: 400, headers: cors });
        }
        const service = serviceOf(date, slot);
        if (!service) return Response.json({ error: "creneau_ferme" }, { status: 400, headers: cors });

        await env.DB.prepare(
          `INSERT INTO reservations
           (id, created_at, date, time, slot_min, service, name, phone, email, guests, place, message, newsletter, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`
        ).bind(
          crypto.randomUUID(), new Date().toISOString(), date, time, slot, service,
          String(b.name).slice(0, 120), String(b.phone).slice(0, 40), email.slice(0, 160),
          b.guests ? String(b.guests).slice(0, 40) : null,
          b.place ? String(b.place).slice(0, 60) : null,
          b.message ? String(b.message).slice(0, 800) : null,
          b.newsletter ? String(b.newsletter).slice(0, 8) : "Non"
        ).run();

        return Response.json({ ok: true }, { headers: cors });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500, headers: cors });
      }
    }

    /* --- 2. La feuille de service (lien reçu par email) --- */
    if (url.pathname === "/service" && request.method === "GET") {
      const payload = await readToken(url.searchParams.get("t"), env.SIGNING_SECRET);
      if (!payload || !payload.startsWith("s:")) return htmlRes("<p>Lien invalide.</p>", 400);
      const [, date, service] = payload.split(":");

      const { results } = await env.DB.prepare(
        "SELECT * FROM reservations WHERE date = ? AND service = ? ORDER BY slot_min, created_at"
      ).bind(date, service).all();

      const tokens = {};
      for (const r of results || []) {
        tokens[r.id] = {
          ok: await makeToken(`a:${r.id}:ok`, env.SIGNING_SECRET),
          no: await makeToken(`a:${r.id}:no`, env.SIGNING_SECRET),
        };
      }
      return htmlRes(serviceSheet(env, results || [], date, service, tokens));
    }

    /* --- 3. Valider / Refuser --- */
    if (url.pathname === "/action") {
      const token = request.method === "POST"
        ? (await request.clone().formData()).get("t")
        : url.searchParams.get("t");
      const payload = await readToken(token, env.SIGNING_SECRET);
      if (!payload || !payload.startsWith("a:")) return htmlRes("<p>Lien invalide.</p>", 400);
      const [, id, action] = payload.split(":");
      if (action !== "ok" && action !== "no") return htmlRes("<p>Lien invalide.</p>", 400);

      const r = await env.DB.prepare("SELECT * FROM reservations WHERE id = ?").bind(id).first();
      if (!r) return htmlRes("<p>Réservation introuvable.</p>", 404);

      if (request.method === "GET") {
        if (r.status !== "pending") {
          return htmlRes(page("Déjà traitée", `<div class="card">
            <h1>Déjà traitée</h1>
            <p class="muted">Cette réservation a déjà été
              ${r.status === "confirmed" ? "validée" : "refusée"}.</p>
            <label for="copy">Le message envoyé</label>
            <textarea id="copy" readonly>${esc(r.reply || "")}</textarea></div>`));
        }
        return htmlRes(actionPage(env, r, action, token, null));
      }

      const form = await request.formData();
      const message = String(form.get("message") || defaultReply(r, action));
      const status = action === "ok" ? "confirmed" : "refused";
      await env.DB.prepare(
        "UPDATE reservations SET status = ?, handled_at = ?, reply = ? WHERE id = ? AND status = 'pending'"
      ).bind(status, new Date().toISOString(), message, r.id).run();

      return htmlRes(actionPage(env, { ...r, status }, action, token, { message }));
    }

    return new Response("QENTINA — service de réservation", { headers: cors });
  },

  /* --- 4. Récap automatique, 2 h avant chaque service --- */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDueRecaps(env));
  },
};

export async function sendDueRecaps(env, now = new Date()) {
  const { date, min } = parisNow(now);
  const sent = [];

  for (const win of openServices(date)) {
    const service = serviceLabel(win);
    const cutoff = win[0] - CUTOFF;
    if (min < cutoff || min >= win[0]) continue;

    const key = `${date}|${service}`;
    if (await env.DB.prepare("SELECT key FROM recaps WHERE key = ?").bind(key).first()) continue;

    const { results } = await env.DB.prepare(
      "SELECT * FROM reservations WHERE date = ? AND service = ? ORDER BY slot_min, created_at"
    ).bind(date, service).all();

    // Aucune réservation : pas d'email, on ne vous encombre pas pour rien.
    if (results && results.length) {
      const covers = results.reduce((n, r) => n + (parseInt(r.guests, 10) || 0), 0);
      const sheet = `${env.PUBLIC_URL}/service?t=${await makeToken(`s:${date}:${service}`, env.SIGNING_SECRET)}`;
      const detail = results.map((r) =>
        `${r.time} — ${r.name} · ${r.guests || "?"} · ${r.phone}${r.message ? ` · « ${r.message} »` : ""}`
      ).join("\n");

      await sendRecapMail(env, {
        subject: `${results.length} réservation${results.length > 1 ? "s" : ""} — service du ${service.toLowerCase()}, ${frDate(date)}`,
        fields: {
          Service: `${service} — ${frDate(date)}`,
          Résumé: `${results.length} réservation${results.length > 1 ? "s" : ""} · ${covers} couvert${covers > 1 ? "s" : ""}`,
          Détail: detail,
          "Feuille de service (valider ou refuser)": sheet,
        },
      });
      sent.push(key);
    }

    await env.DB.prepare("INSERT INTO recaps (key, sent_at) VALUES (?,?)")
      .bind(key, new Date().toISOString()).run();
  }
  return sent;
}

/* Exporté pour les tests hors ligne */
export const __test = {
  parisNow, openServices, serviceOf, serviceLabel, closureFor, defaultReply,
  makeToken, readToken, fmtMin, frDate, parseSlot, serviceSheet, actionPage, CUTOFF,
};
