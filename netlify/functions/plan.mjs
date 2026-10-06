// يقترح خطة تطوير عملية لموظف، مع زميل داعم يملك المهارة
import { askGemini, handle, clean } from "../lib/gemini.mjs";

const schema = {
  type: "OBJECT",
  properties: {
    skill: { type: "STRING" },
    activity: { type: "STRING", description: "نشاط عملي مرتبط بالمشروع" },
    deliverable: { type: "STRING" },
    supporterId: { type: "STRING" },
    supporterWhy: { type: "STRING" },
    weeks: { type: "INTEGER" },
    checkpoints: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { title: { type: "STRING" }, week: { type: "INTEGER" } }, required: ["title", "week"] },
    },
  },
  required: ["skill", "activity", "deliverable", "supporterId", "supporterWhy", "weeks", "checkpoints"],
};

export default (req) =>
  handle(req, async ({ employee = {}, gap = "", project = "", colleagues = [] }) => {
    const others = colleagues
      .filter((c) => c.id !== employee.id)
      .slice(0, 30)
      .map((c) => `- id=${clean(c.id, 10)} | ${clean(c.name)} | ${(c.skills || []).map((s) => clean(s, 40)).join("، ")}`)
      .join("\n");
    const text =
      "أنت مستشار تطوير في منصة «تشكيل». اقترح خطة تطوير قصيرة وعملية (2 إلى 6 أسابيع).\n" +
      `الموظف: ${clean(employee.name)} (${clean(employee.role)})\nالمهارة الناقصة: ${clean(gap)}\nالمشروع: ${clean(project)}\n\n` +
      "الزملاء المتاحون:\n" + others + "\n\n" +
      "اختر supporterId لزميل يملك المهارة أو أقرب لها، ولا تختر الموظف نفسه. " +
      "النشاط يكون جزء حقيقي من المشروع، ومحطتين أو ثلاث للمتابعة. اكتب بالعربي وبجمل قصيرة.";
    const out = await askGemini([{ text }], schema);
    if (out.supporterId === employee.id) out.supporterId = colleagues.find((c) => c.id !== employee.id)?.id || "";
    return out;
  });

export const config = { path: "/api/plan" };
