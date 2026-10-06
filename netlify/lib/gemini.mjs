// مساعد مشترك للاتصال بـ Gemini. المفتاح يُقرأ من إعدادات Netlify فقط.
// نجرب الموديلات بالترتيب: إذا واحد مضغوط (503) أو غير متاح، ننتقل للي بعده
const MODELS = [...new Set([process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"].filter(Boolean))];
const LIMIT_MS = 24000; // نوقف قبل حد Netlify (30 ثانية) عشان نرجّع رد واضح

async function call(MODEL, parts, schema, thinking, ms) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const generationConfig = { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3, maxOutputTokens: 2048 };
  if (thinking) generationConfig.thinkingConfig = thinking;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
    });
    const body = await res.text();
    if (!res.ok) {
      const err = new Error(`GEMINI_${res.status}: ${body.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }
    const data = JSON.parse(body);
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    return JSON.parse(text);
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`TIMEOUT: Gemini (${MODEL}) took too long`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function askGemini(parts, schema) {
  const started = Date.now();
  let last;
  for (const MODEL of MODELS) {
    const left = LIMIT_MS - (Date.now() - started);
    if (left < 3000) break;
    const thinking = /gemini-3/.test(MODEL) ? { thinkingLevel: "low" } : /lite/.test(MODEL) ? null : { thinkingBudget: 0 };
    try {
      let out;
      try {
        out = await call(MODEL, parts, schema, thinking, left);
      } catch (e) {
        if (e.status !== 400 || !thinking) throw e;
        out = await call(MODEL, parts, schema, null, LIMIT_MS - (Date.now() - started));
      }
      console.log(`ok model=${MODEL} ${Date.now() - started}ms`);
      return out;
    } catch (e) {
      last = e;
      console.log(`model ${MODEL} failed:`, String(e.message).slice(0, 160));
      if (![404, 429, 500, 503].includes(e.status)) throw e;
    }
  }
  throw last || new Error("TIMEOUT: no model answered in time");
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function handle(req, fn) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const input = await req.json();
    return json({ ok: true, source: "gemini", ...(await fn(input)) });
  } catch (e) {
    const msg = String(e?.message || e);
    console.error("AI error:", msg);
    const code = msg.startsWith("NO_KEY") ? "NO_KEY" : msg.startsWith("TIMEOUT") ? "TIMEOUT" : "AI_FAILED";
    return json({ ok: false, error: code, detail: msg.slice(0, 300) }, code === "NO_KEY" ? 503 : 502);
  }
}

// تنظيف بسيط للنصوص القادمة من المستخدم قبل إدخالها في التعليمات
export const clean = (s, n = 120) => String(s ?? "").replace(/[\r\n`{}<>]/g, " ").slice(0, n);
