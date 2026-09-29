import express from "express";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN
});

app.use(express.json({ limit: "15mb" }));
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;
    const image = req.body.image;

    if (!message && !image) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرسل صورة أولاً"
      });
    }

    let userContent;

    if (image) {
      userContent = [
        {
          type: "text",
          text: message || "حلل هذه الصورة واشرح لي ما فيها."
        },
        {
          type: "image_url",
          image_url: {
            url: image
          }
        }
      ];
    } else {
      userContent = message;
    }

    const completion = await client.chat.completions.create({
      model: "Qwen/Qwen2.5-VL-72B-Instruct:fastest",

      messages: [
        {
          role: "system",
          content: `
أنت Nova AI، مساعد ذكي ومفيد.

أجب باللغة العربية عندما يكتب المستخدم بالعربية.

إذا أرسل المستخدم صورة، قم بتحليلها بدقة والإجابة عن سؤاله حولها.

إذا كانت الصورة تحتوي على تمرين أو مسألة، حاول قراءتها وحلها وشرح الحل.

إذا سألك المستخدم من صنعك أو من طورك أو من برمجك، أجب حرفيًا:
"لقد صنعني khalil.kara الذي يسمي نفسه tooshyta، كل التقدير له لتطويري قدر الإمكان."

لا تغيّر هذه الجملة.
`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "لم أتمكن من تحليل الصورة.";

    res.json({
      reply
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error:
        error?.message ||
        "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Nova AI يعمل على المنفذ ${PORT}`);
});
