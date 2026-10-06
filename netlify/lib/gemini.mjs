// مساعد مشترك للاتصال بـ Gemini. المفتاح يُقرأ من إعدادات Netlify فقط.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const LIMIT_MS = 24000; // نوقف قبل حد Netlify (30 ثانية) عشان نرجّع رد واضح

async function call(parts, schema, thinking) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const generationConfig = { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3, maxOutputTokens: 2048 };
  if (thinking) generationConfig.thinkingConfig = thinking;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), LIMIT_MS);
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
    if (e.name === "AbortError") throw new Error(`TIMEOUT: Gemini (${MODEL}) took more than ${LIMIT_MS / 1000}s`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function askGemini(parts, schema) {
  const started = Date.now();
  // نطفّي "التفكير" عشان الرد يكون أسرع. إذا الموديل ما يدعم هالإعداد، نعيد المحاولة بدونه.
  const thinking = /gemini-3/.test(MODEL) ? { thinkingLevel: "low" } : { thinkingBudget: 0 };
  try {
    const out = await call(parts, schema, thinking);
    console.log(`ok model=${MODEL} ${Date.now() - started}ms`);
    return out;
  } catch (e) {
    if (e.status === 400) {
      console.log("retrying without thinkingConfig:", String(e.message).slice(0, 200));
      const out = await call(parts, schema, null);
      console.log(`ok (retry) model=${MODEL} ${Date.now() - started}ms`);
      return out;
    }
    throw e;
  }
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
