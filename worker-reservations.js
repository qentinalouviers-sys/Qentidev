/* ============================================================
   QENTINA — Réservations : récap de service & validation
   ------------------------------------------------------------
   Ce Worker Cloudflare (gratuit) fait trois choses :

   1. Il enregistre chaque demande de réservation envoyée par le site.
   2. À l'heure du blocage (2 h avant le début du service), il vous envoie
      UN SEUL email récapitulant toutes les réservations de ce service.
   3. Chaque réservation du récap a deux boutons — Valider / Refuser — qui
      ouvrent une page où le message au client est déjà écrit. Vous le
      modifiez si besoin, puis vous envoyez.

   Variables à définir dans Cloudflare (Settings → Variables) :
     BREVO_API_KEY   (secret) → clé API Brevo (envoi des emails)
     SIGNING_SECRET  (secret) → phrase secrète au hasard, ≥ 32 caractères
                                (elle signe les liens Valider/Refuser)
     RESTAURANT_EMAIL         → où recevoir le récap (qentina.louviers@gmail.com)
     SENDER_EMAIL             → adresse d'expédition validée dans Brevo
     ALLOWED_ORIGIN           → https://qentina.fr
     PUBLIC_URL               → adresse publique de CE worker
                                (ex. https://qentina-resa.xxx.workers.dev)

   Base de données : un binding D1 nommé DB (voir le guide de déploiement).

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
const TEL_E164 = "+33259162093";

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

// À quel service appartient ce créneau ?
function serviceOf(dateStr, slotMin) {
  const win = openServices(dateStr).find((w) => slotMin >= w[0] && slotMin <= w[1]);
  return win ? serviceLabel(win) : null;
}

/* ---------- Signature des liens Valider / Refuser ---------- */
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

async function makeToken(id, action, secret) {
  const payload = `${id}.${action}`;
  return `${payload}.${await sign(payload, secret)}`;
}

async function readToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [id, action, sig] = parts;
  if (action !== "ok" && action !== "no") return null;
  const expected = await sign(`${id}.${action}`, secret);
  // Comparaison à temps constant
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? { id, action } : null;
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

/* ---------- Envoi d'emails (Brevo) ---------- */
async function sendMail(env, { to, toName, subject, html, replyTo }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "QENTINA", email: env.SENDER_EMAIL },
      to: [{ email: to, name: toName || undefined }],
      replyTo: replyTo ? { email: replyTo } : undefined,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status} ${await res.text()}`);
  return true;
}

/* ---------- Gabarits HTML ---------- */
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PAPER = "#f4ecd9", CARD = "#fbf5e7", INK = "#173033", TERRA = "#0f5460";

function recapEmail(env, rows, dateStr, service, tokens) {
  const cards = rows.map((r) => {
    const t = tokens[r.id];
    const contact = [
      `<a href="tel:${esc(r.phone)}" style="color:${TERRA}">${esc(r.phone)}</a>`,
      r.email ? `<a href="mailto:${esc(r.email)}" style="color:${TERRA}">${esc(r.email)}</a>` : "pas d'email",
    ].join(" · ");
    const done = r.status !== "pending";
    return `
      <tr><td style="padding:0 0 14px">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid rgba(23,48,51,.14);border-radius:14px">
          <tr><td style="padding:16px 18px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK}">
            <div style="font-size:19px;font-weight:600">${esc(r.time)} — ${esc(r.name)} · ${esc(r.guests || "?")}</div>
            <div style="font-size:14px;color:#5e6b65;margin-top:4px">${contact}</div>
            ${r.place ? `<div style="font-size:14px;color:#5e6b65;margin-top:2px">${esc(r.place)}</div>` : ""}
            ${r.message ? `<div style="font-size:14px;margin-top:8px;padding:8px 10px;background:#fff;border-radius:8px">💬 ${esc(r.message)}</div>` : ""}
            ${done
              ? `<div style="margin-top:12px;font-size:14px;font-weight:600;color:${r.status === "confirmed" ? "#0f7a4a" : "#b3402c"}">
                   ${r.status === "confirmed" ? "✅ Déjà validée" : "❌ Déjà refusée"}
                 </div>`
              : `<div style="margin-top:14px">
                   <a href="${env.PUBLIC_URL}/action?t=${t.ok}"
                      style="display:inline-block;background:#0f7a4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:100px;font-weight:600;font-size:15px;margin-right:8px">✅ Valider</a>
                   <a href="${env.PUBLIC_URL}/action?t=${t.no}"
                      style="display:inline-block;background:#b3402c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:100px;font-weight:600;font-size:15px">❌ Refuser</a>
                 </div>`}
          </td></tr>
        </table>
      </td></tr>`;
  }).join("");

  const covers = rows.reduce((n, r) => n + (parseInt(r.guests, 10) || 0), 0);
  return `
  <div style="background:${PAPER};padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto">
      <tr><td style="padding-bottom:18px;color:${INK}">
        <div style="font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:${TERRA}">Service du ${esc(service.toLowerCase())}</div>
        <div style="font-size:26px;font-weight:600;margin-top:6px">${esc(frDate(dateStr))}</div>
        <div style="font-size:15px;color:#5e6b65;margin-top:6px">
          ${rows.length} réservation${rows.length > 1 ? "s" : ""} · ${covers} couvert${covers > 1 ? "s" : ""}
          — les réservations en ligne sont closes pour ce service.
        </div>
      </td></tr>
      ${cards}
      <tr><td style="padding-top:8px;font-size:12px;color:#5e6b65">
        Récapitulatif envoyé automatiquement 2 h avant le service par le site QENTINA.
      </td></tr>
    </table>
  </div>`;
}

function actionPage(env, r, action, token, sent) {
  const ok = action === "ok";
  const color = ok ? "#0f7a4a" : "#b3402c";
  const title = ok ? "Valider la réservation" : "Refuser la réservation";
  const body = defaultReply(r, action);
  const waText = encodeURIComponent(body);
  const phoneDigits = String(r.phone || "").replace(/[^0-9+]/g, "");
  const waNum = phoneDigits.replace(/^\+/, "").replace(/^0/, "33");

  const sentBox = sent
    ? `<p style="background:#e8f5ee;border:1px solid #0f7a4a;color:#0f5a37;padding:12px 14px;border-radius:12px">
         ${sent === "email" ? "Message envoyé par email au client." : "Réservation enregistrée. Envoyez le message au client ci-dessous."}
       </p>` : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — QENTINA</title>
  <style>
    body{margin:0;background:${PAPER};color:${INK};font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px 14px}
    .wrap{max-width:600px;margin:0 auto}
    .card{background:${CARD};border:1px solid rgba(23,48,51,.14);border-radius:18px;padding:20px}
    h1{font-size:22px;margin:0 0 4px;color:${color}}
    .meta{color:#5e6b65;font-size:15px;margin-bottom:16px}
    label{display:block;font-size:14px;font-weight:600;margin:16px 0 6px}
    textarea{width:100%;box-sizing:border-box;min-height:220px;padding:12px;border:1px solid rgba(23,48,51,.2);
      border-radius:12px;font:inherit;font-size:15px;line-height:1.5;background:#fff;resize:vertical}
    .btn{display:inline-block;border:0;cursor:pointer;padding:13px 26px;border-radius:100px;font:inherit;
      font-weight:600;font-size:16px;text-decoration:none;text-align:center}
    .primary{background:${color};color:#fff}
    .ghost{background:#fff;color:${INK};border:1px solid rgba(23,48,51,.25)}
    .row{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
    .note{font-size:13px;color:#5e6b65;margin-top:14px}
  </style></head><body><div class="wrap"><div class="card">
    <h1>${title}</h1>
    <div class="meta"><strong>${esc(r.name)}</strong> · ${esc(r.guests || "?")}<br>
      ${esc(frDate(r.date))} à ${esc(r.time)}<br>
      <a href="tel:${esc(r.phone)}" style="color:${TERRA}">${esc(r.phone)}</a>
      ${r.email ? ` · ${esc(r.email)}` : " · pas d'email"}</div>
    ${sentBox}
    ${sent ? "" : `
    <form method="POST" action="${env.PUBLIC_URL}/action">
      <input type="hidden" name="t" value="${esc(token)}">
      <label for="msg">Message au client (modifiable)</label>
      <textarea id="msg" name="message">${esc(body)}</textarea>
      <div class="row">
        <button class="btn primary" type="submit">
          ${r.email ? "Envoyer et " + (ok ? "valider" : "refuser") : (ok ? "Valider" : "Refuser")}
        </button>
      </div>
      ${r.email ? "" : `<p class="note">Ce client n'a pas laissé d'email. Après enregistrement,
        vous pourrez lui envoyer le message par WhatsApp ou SMS en un clic.</p>`}
    </form>`}
    ${sent === "manual" ? `
    <div class="row">
      <a class="btn primary" href="https://wa.me/${waNum}?text=${waText}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn ghost" href="sms:${esc(phoneDigits)}?&body=${waText}">SMS</a>
      <a class="btn ghost" href="tel:${esc(phoneDigits)}">Appeler</a>
    </div>` : ""}
  </div></div></body></html>`;
}

const html = (body, status = 200) =>
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || slot === null || !b.name || !b.phone) {
          return Response.json({ error: "champs_manquants" }, { status: 400, headers: cors });
        }
        // On revérifie côté serveur : un créneau fermé n'entre pas en base.
        const service = serviceOf(date, slot);
        if (!service) return Response.json({ error: "creneau_ferme" }, { status: 400, headers: cors });

        await env.DB.prepare(
          `INSERT INTO reservations
           (id, created_at, date, time, slot_min, service, name, phone, email, guests, place, message, newsletter, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'pending')`
        ).bind(
          crypto.randomUUID(), new Date().toISOString(), date, time, slot, service,
          String(b.name).slice(0, 120), String(b.phone).slice(0, 40),
          b.email ? String(b.email).slice(0, 160) : null,
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

    /* --- 2. Clic sur Valider / Refuser --- */
    if (url.pathname === "/action") {
      const token = request.method === "POST"
        ? (await request.formData()).get("t")
        : url.searchParams.get("t");
      const parsed = await readToken(token, env.SIGNING_SECRET);
      if (!parsed) return html("<p>Lien invalide ou expiré.</p>", 400);

      const r = await env.DB.prepare("SELECT * FROM reservations WHERE id = ?")
        .bind(parsed.id).first();
      if (!r) return html("<p>Réservation introuvable.</p>", 404);

      // Affichage du formulaire (clic depuis l'email)
      if (request.method === "GET") {
        if (r.status !== "pending") {
          return html(`<div style="font-family:sans-serif;padding:32px;max-width:520px;margin:auto">
            <h1 style="color:${TERRA}">Déjà traitée</h1>
            <p>Cette réservation a déjà été ${r.status === "confirmed" ? "validée" : "refusée"}.</p></div>`);
        }
        return html(actionPage(env, r, parsed.action, token, null));
      }

      // Envoi effectif
      const form = await request.clone().formData();
      const message = String(form.get("message") || defaultReply(r, parsed.action));
      const status = parsed.action === "ok" ? "confirmed" : "refused";

      await env.DB.prepare(
        "UPDATE reservations SET status = ?, handled_at = ?, reply = ? WHERE id = ? AND status = 'pending'"
      ).bind(status, new Date().toISOString(), message, r.id).run();

      let sent = "manual";
      if (r.email) {
        try {
          await sendMail(env, {
            to: r.email,
            toName: r.name,
            replyTo: env.RESTAURANT_EMAIL,
            subject: parsed.action === "ok"
              ? `Votre table est confirmée — QENTINA`
              : `Votre demande de réservation — QENTINA`,
            html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;
                     line-height:1.55;color:${INK};white-space:pre-wrap">${esc(message)}</div>`,
          });
          sent = "email";
        } catch (e) {
          sent = "manual"; // l'envoi a échoué : on bascule sur WhatsApp/SMS
        }
      }
      return html(actionPage(env, { ...r, status }, parsed.action, token, sent));
    }

    return new Response("QENTINA — service de réservation", { headers: cors });
  },

  /* --- 3. Récap automatique, 2 h avant chaque service --- */
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
    // Fenêtre : du blocage jusqu'au début du service (le cron passe toutes les 15 min).
    if (min < cutoff || min >= win[0]) continue;

    const key = `${date}|${service}`;
    const already = await env.DB.prepare("SELECT key FROM recaps WHERE key = ?").bind(key).first();
    if (already) continue;

    const { results } = await env.DB.prepare(
      "SELECT * FROM reservations WHERE date = ? AND service = ? ORDER BY slot_min, created_at"
    ).bind(date, service).all();

    // Aucune réservation : pas d'email, on ne vous encombre pas pour rien.
    if (!results || !results.length) {
      await env.DB.prepare("INSERT INTO recaps (key, sent_at) VALUES (?,?)")
        .bind(key, new Date().toISOString()).run();
      continue;
    }

    const tokens = {};
    for (const r of results) {
      tokens[r.id] = {
        ok: await makeToken(r.id, "ok", env.SIGNING_SECRET),
        no: await makeToken(r.id, "no", env.SIGNING_SECRET),
      };
    }

    await sendMail(env, {
      to: env.RESTAURANT_EMAIL,
      subject: `${results.length} réservation${results.length > 1 ? "s" : ""} — service du ${service.toLowerCase()}, ${frDate(date)}`,
      html: recapEmail(env, results, date, service, tokens),
    });

    await env.DB.prepare("INSERT INTO recaps (key, sent_at) VALUES (?,?)")
      .bind(key, new Date().toISOString()).run();
    sent.push(key);
  }
  return sent;
}

/* Exporté pour les tests hors ligne */
export const __test = {
  parisNow, openServices, serviceOf, serviceLabel, closureFor,
  defaultReply, makeToken, readToken, fmtMin, frDate, parseSlot, CUTOFF,
};
