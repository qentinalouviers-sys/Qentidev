/* ============================================================
   QENTINA — Proxy d'avis Google (Cloudflare Worker)
   ------------------------------------------------------------
   Ce mini-serveur garde votre clé API Google SECRÈTE.
   Le site web n'appelle que ce proxy ; la clé n'apparaît jamais
   dans le code public du site.

   Variables à définir dans Cloudflare (Settings → Variables) :
     GOOGLE_API_KEY  (secret)   → votre clé API Google (Places API activée)
     ALLOWED_ORIGIN             → https://qentinalouviers-sys.github.io
     PLACE_ID        (optionnel)→ identifiant précis de l'établissement
     PLACE_QUERY     (optionnel)→ recherche texte si pas de PLACE_ID

   Voir le guide : DEPLOIEMENT-AVIS.md
   ============================================================ */

const DEFAULT_QUERY = "QENTINA pizzeria 20 rue Maréchal Foch 27400 Louviers";

export default {
  async fetch(request, env, ctx) {
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=3600",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const key = env.GOOGLE_API_KEY;
    if (!key) return json({ error: "missing_key" }, 500, cors);

    // Cache Cloudflare : on évite de rappeler Google à chaque visite (max ~1h).
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).origin + "/avis-cache", request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      // 1) Identifiant de l'établissement
      let placeId = env.PLACE_ID;
      if (!placeId) {
        const q = env.PLACE_QUERY || DEFAULT_QUERY;
        const findUrl =
          "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
          "?input=" + encodeURIComponent(q) +
          "&inputtype=textquery&fields=place_id&key=" + key;
        const f = await fetch(findUrl).then((r) => r.json());
        if (f.status !== "OK" || !f.candidates || !f.candidates[0]) {
          return json({ error: "place_not_found", status: f.status }, 200, cors);
        }
        placeId = f.candidates[0].place_id;
      }

      // 2) Détails + avis
      const detUrl =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        "?place_id=" + encodeURIComponent(placeId) +
        "&fields=name,rating,user_ratings_total,reviews,url" +
        "&reviews_sort=newest&language=fr&key=" + key;
      const d = await fetch(detUrl).then((r) => r.json());
      if (d.status !== "OK") {
        return json({ error: "details_failed", status: d.status }, 200, cors);
      }

      const p = d.result || {};
      // On ne renvoie QUE le nécessaire — jamais la clé.
      const payload = {
        name: p.name || "",
        rating: p.rating || null,
        total: p.user_ratings_total || 0,
        url: p.url || "",
        reviews: (p.reviews || []).map((r) => ({
          author_name: r.author_name,
          profile_photo_url: r.profile_photo_url,
          rating: r.rating,
          text: r.text,
          relative_time_description: r.relative_time_description,
        })),
      };

      const res = json(payload, 200, cors);
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    } catch (e) {
      return json({ error: "exception", message: String(e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
  });
}
