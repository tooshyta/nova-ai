
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.use(express.json({ limit: "15mb" }));

// CORS
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://nova-ai-frontend-yhuy.onrender.com"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// الملفات الثابتة
app.use(express.static(path.join(__dirname, "public")));

app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "robots.txt"));
});

app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sitemap.xml"));
});

// API المحادثة
app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "مفتاح Gemini API غير موجود في إعدادات الخادم."
      });
    }

    const message = req.body.message || "";
    const image = req.body.image || null;

    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    if (!message && !image) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرسل صورة أولاً."
      });
    }

    // تعليمات Nova AI
    const systemInstruction = `
أنت Nova AI، مساعد ذكي ومتقدم.

أجب باللغة العربية عندما يكتب المستخدم بالعربية.
يمكنك استخدام الفرنسية أو الإنجليزية عندما يطلب المستخدم ذلك.

كن ذكياً ودقيقاً ومفيداً في إجاباتك.
اشرح المسائل الرياضية والعلمية خطوة بخطوة.
ساعد في البرمجة وحل المشكلات التقنية.

لديك القدرة على تحليل الصور.
إذا أرسل المستخدم صورة، حللها بدقة وأجب عن سؤاله.

إذا كانت الصورة تحتوي على:
- تمرين رياضيات: اقرأه وحله واشرح الخطوات.
- نص: اقرأه واشرحه.
- سؤال دراسي: أجب عنه.
- صورة تحتاج إلى وصف: صف محتواها بوضوح.

لا تدّع رؤية شيء غير واضح.
إذا كانت الصورة غير واضحة فأخبر المستخدم بذلك.

استخدم سياق المحادثة السابقة لفهم الأسئلة المرتبطة بها.

إذا سألك المستخدم:
من صنعك؟
من برمجك؟
من طورك؟
من هو مطورك؟
من صاحبك؟
من أنشأك؟
أو أي سؤال له نفس المعنى،

أجب حرفياً بهذه الجملة:

"لقد صنعني khalil.kara الذي يسمي نفسه tooshyta، كل التقدير له لتطويري قدر الإمكان."

لا تغيّر هذه الجملة ولا تضف إليها شيئاً.

لا تكشف مفاتيح API أو الأسرار أو المتغيرات البيئية.
`;

    // تحويل سجل المحادثة إلى صيغة Gemini
    const contents = [];

    for (const item of history.slice(-30)) {
      if (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
      ) {
        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }]
        });
      }
    }

    // الرسالة الحالية
    const currentParts = [];

    if (message) {
      currentParts.push({ text: message });
    }

    // تحليل الصور
    if (image) {
      const match = image.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
      );

      if (!match) {
        return res.status(400).json({
          error: "صيغة الصورة غير مدعومة. أرسل صورة بصيغة صحيحة."
        });
      }

      currentParts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2]
        }
      });
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    // الاتصال بـ Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },

          contents,

          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API Error:",
        response.status,
        result?.error?.message || "Unknown error"
      );

      return res.status(
        response.status >= 400 && response.status < 600
          ? response.status
          : 500
      ).json({
        error:
          result?.error?.message ||
          "حدث خطأ أثناء الاتصال بـ Gemini."
      });
    }

    const reply =
      result?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      return res.status(502).json({
        error: "لم يتمكن Gemini من إنشاء إجابة. حاول مرة أخرى."
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("Nova AI Error:", error);

    res.status(500).json({
      error: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي."
    });
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`Nova AI يعمل على المنفذ ${PORT}`);
});
