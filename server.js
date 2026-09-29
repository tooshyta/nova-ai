import express from "express";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN
});

app.use(express.json());
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({
        error: "اكتب رسالة أولاً"
      });
    }

    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b:fastest",
      messages: [
        {
          role: "system",
          content: "أنت Nova AI، مساعد ذكي ومفيد. أجب باللغة العربية عندما يكتب المستخدم بالعربية."
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Nova AI يعمل على المنفذ ${PORT}`);
});
