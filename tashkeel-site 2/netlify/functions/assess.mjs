// يقارن المهارات المطلوبة بمهارات الفريق ويصنّف كل موظف
import { askGemini, handle, clean } from "../lib/gemini.mjs";

const schema = {
  type: "OBJECT",
  properties: {
    assessments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          category: { type: "STRING", enum: ["ready", "dev", "ver", "lim"] },
          gap: { type: "STRING", description: "أهم مهارة ناقصة، أو فارغ إذا ما فيه" },
          reason: { type: "STRING", description: "سبب التصنيف في جملة قصيرة بالعربي" },
        },
        required: ["id", "category", "gap", "reason"],
      },
    },
  },
  required: ["assessments"],
};

export default (req) =>
  handle(req, async ({ requirements = [], employees = [] }) => {
    const reqs = requirements.slice(0, 12).map((r) => `- ${clean(r.skill)} (${clean(r.priority, 10)})`).join("\n");
    const team = employees
      .slice(0, 30)
      .map((e) => `- id=${clean(e.id, 10)} | ${clean(e.name)} | ${clean(e.role)} | المهارات: ${(e.skills || []).map((s) => clean(s, 40)).join("، ")} | الأدلة: ${Number(e.evidence) || 0}`)
      .join("\n");
    const text =
      "أنت محلل جاهزية في منصة «تشكيل». القرار النهائي للمدير، وأنت تقترح فقط.\n" +
      "المهارات المطلوبة للمشروع:\n" + reqs + "\n\nالفريق:\n" + team + "\n\n" +
      "صنّف كل موظف في فئة واحدة:\n" +
      "ready = يغطي المهارات الأساسية القريبة من دوره بأدلة كافية.\n" +
      "dev = دوره مرتبط بالمشروع لكن تنقصه مهارة أساسية ويمكن تطويرها.\n" +
      "ver = يبدو مناسبًا لكن أدلته قليلة (1 أو أقل) فيحتاج تحقق.\n" +
      "lim = دوره بعيد عن احتياج المشروع.\n" +
      "أرجع تقييمًا لكل id، والسبب في جملة قصيرة بلهجة بسيطة.";
    return await askGemini([{ text }], schema);
  });

export const config = { path: "/api/assess" };
