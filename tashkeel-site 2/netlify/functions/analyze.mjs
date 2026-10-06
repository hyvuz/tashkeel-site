// يقرأ ملفات PDF لخطة المشروع ويستخرج المهارات المطلوبة
import { askGemini, handle } from "../lib/gemini.mjs";

const schema = {
  type: "OBJECT",
  properties: {
    project: { type: "STRING", description: "اسم المشروع كما يظهر في الوثيقة، أو وصف قصير له" },
    requirements: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          skill: { type: "STRING", description: "اسم المهارة بالعربي، ويمكن إبقاء أسماء التقنيات بالإنجليزي" },
          priority: { type: "STRING", enum: ["أساسية", "اختيارية"] },
          source: { type: "STRING", enum: ["من الخطة", "مستنتجة"] },
          evidence: { type: "STRING", description: "جملة قصيرة من الوثيقة أو سبب الاستنتاج" },
        },
        required: ["skill", "priority", "source", "evidence"],
      },
    },
  },
  required: ["project", "requirements"],
};

export default (req) =>
  handle(req, async ({ files = [] }) => {
    const pdfs = files.slice(0, 3).filter((f) => f?.data);
    if (!pdfs.length) throw new Error("NO_FILES");
    const parts = pdfs.map((f) => ({ inline_data: { mime_type: "application/pdf", data: f.data } }));
    parts.push({
      text:
        "أنت محلل موارد بشرية في منصة «تشكيل». اقرأ وثائق خطة المشروع المرفقة، واستخرج من 4 إلى 8 مهارات يحتاجها الفريق لتنفيذ المشروع. " +
        "المهارة «من الخطة» إذا كانت مذكورة صراحة، و«مستنتجة» إذا استنتجتها من طبيعة العمل. " +
        "اكتب الدليل في جملة قصيرة بالعربي. لا تخترع معلومات غير موجودة في الوثائق.",
    });
    return await askGemini(parts, schema);
  });

export const config = { path: "/api/analyze" };
