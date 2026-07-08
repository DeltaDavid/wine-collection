// Cross-device wine sync backed by Cloudflare D1 (binding: DB).
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT wine, winery, region, country, rating, type, grape, img FROM wines ORDER BY id"
    ).all();
    return json(results || []);
  } catch (e) { return json({ error: String(e) }, 500); }
}

export async function onRequestPost({ request, env }) {
  try {
    const w = await request.json();
    if (!w || !w.wine) return json({ error: "missing wine name" }, 400);
    await env.DB.prepare(
      "INSERT INTO wines (wine, winery, region, country, rating, type, grape, img) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      String(w.wine),
      w.winery || "Unknown",
      w.region || "Unknown",
      w.country || "Unknown",
      Number(w.rating) || 0,
      w.type || "Unknown",
      w.grape || "Unknown",
      w.img || w.image || ""
    ).run();
    return json({ ok: true });
  } catch (e) { return json({ error: String(e) }, 500); }
}
