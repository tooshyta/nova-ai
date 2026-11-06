
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ترتيب النماذج: الأساسي ثم الاحتياطية
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite"
];

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

// أخطاء تستدعي الانتقال إلى نموذج احتياطي
function shouldFallback(status) {
  return [
    408,
    429,
    500,
    502,
    503,
    504
  ].includes(status);
}

// استخراج الإجابة
function extractReply(result) {
  const steps = Array.isArray(result?.steps)
    ? result.steps
    : [];

  return steps
    .filter(step => step.type === "model_output")
    .flatMap(step =>
      Array.isArray(step.content) ? step.content : []
    )
    .filter(part =>
      part.type === "text" &&
      typeof part.text === "string"
    )
    .map(part => part.text)
    .join("")
    .trim();
}

// API المحادثة
app.post("/api/chat", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "مفتاح Gemini API غير موجود في إعدادات الخادم."
      });
    }

    const message =
      typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

    const image =
      typeof req.body.image === "string"
        ? req.body.image
        : null;

    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    if (!message && !image) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرسل صورة أولاً."
      });
    }

    // تجهيز سجل المحادثة
    const historyText = history
      .slice(-20)
      .filter(item =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
      )
      .map(item => {
        const role =
          item.role === "assistant"
            ? "Nova AI"
            : "المستخدم";

        return `${role}: ${item.content}`;
      })
      .join("\n\n");

    // تجهيز المدخلات
    const input = [];

    if (historyText) {
      input.push({
        type: "text",
        text: `سجل المحادثة السابقة:\n${historyText}`
      });
    }

    if (message) {
      input.push({
        type: "text",
        text: `رسالة المستخدم الحالية:\n${message}`
      });
    }

    // تحليل الصور
    if (image) {
      const match = image.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/
      );

      if (!match) {
        return res.status(400).json({
          error: "صيغة الصورة غير مدعومة."
        });
      }

      input.push({
        type: "image",
        mime_type: match[1],
        data: match[2]
      });
    }

    let lastError = null;

    // تجربة النماذج بالترتيب
    for (const model of GEMINI_MODELS) {
      console.log(`Nova AI trying model: ${model}`);

      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify({
              model,
              system_instruction: systemInstruction,
              input,
              store: false,
              generation_config: {
                thinking_level: "low"
              }
            }),
            signal: AbortSignal.timeout(25000)
          }
        );

        const responseText = await response.text();

        let result;

        try {
          result = JSON.parse(responseText);
        } catch {
          result = {};
        }

        if (!response.ok) {
          const errorMessage =
            result?.error?.message ||
            responseText ||
            "Unknown Gemini error";

          console.error(
            `Gemini ${model} Error ${response.status}:`,
            errorMessage
          );

          lastError = errorMessage;

          if (shouldFallback(response.status)) {
            console.log(`Switching from ${model} to next model...`);
            continue;
          }

          return res.status(response.status).json({
            error: errorMessage
          });
        }

        const reply = extractReply(result);

        if (!reply) {
          lastError = "لم يرجع النموذج إجابة نصية.";
          console.error(`Empty response from ${model}`);
          continue;
        }

        console.log(`Nova AI answered using: ${model}`);

        return res.json({
          reply,
          model
        });

      } catch (error) {
        lastError = error.message;

        console.error(
          `Connection error with ${model}:`,
          error.message
        );

        // الانتقال للنموذج التالي
        continue;
      }
    }

    console.error(
      "All Gemini models failed:",
      lastError
    );

    return res.status(503).json({
      error: "جميع نماذج الذكاء الاصطناعي مشغولة حالياً. حاول مجدداً بعد قليل."
    });

  } catch (error) {
    console.error("Nova AI Error:", error);

    return res.status(500).json({
      error: "حدث خطأ داخلي أثناء معالجة الطلب."
    });
  }
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`Nova AI يعمل على المنفذ ${PORT}`);
});
