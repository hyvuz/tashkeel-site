// مساعد مشترك للاتصال بـ Gemini. المفتاح يُقرأ من إعدادات Netlify فقط.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export async function askGemini(parts, schema) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("NO_KEY");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3 },
      }),
    }
  );
  if (!res.ok) throw new Error("GEMINI_" + res.status + ": " + (await res.text()).slice(0, 300));
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return JSON.parse(text);
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
    console.error(msg);
    return json({ ok: false, error: msg.startsWith("NO_KEY") ? "NO_KEY" : "AI_FAILED" }, msg.startsWith("NO_KEY") ? 503 : 502);
  }
}

// تنظيف بسيط للنصوص القادمة من المستخدم قبل إدخالها في التعليمات
export const clean = (s, n = 120) => String(s ?? "").replace(/[\r\n`{}<>]/g, " ").slice(0, n);
