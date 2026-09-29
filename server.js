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
    const history = Array.isArray(req.body.history)
      ? req.body.history
      : [];

    if (!message && !image) {
      return res.status(400).json({
        error: "اكتب رسالة أو أرسل صورة أولاً"
      });
    }

    const systemMessage = {
      role: "system",
      content: `
أنت Nova AI، مساعد ذكي ومفيد.

أجب باللغة العربية عندما يكتب المستخدم بالعربية.
يمكنك استخدام الفرنسية أو الإنجليزية عندما يطلب المستخدم ذلك.

لديك القدرة على تحليل الصور.
إذا أرسل المستخدم صورة، حللها بدقة وأجب عن سؤاله المتعلق بها.

إذا كانت الصورة تحتوي على:
- تمرين رياضيات، حاول قراءته وحله وشرح خطوات الحل.
- نص، حاول قراءته وشرحه.
- صورة أو شيء يحتاج إلى وصف، صفه بوضوح.
- سؤال دراسي، حاول الإجابة عنه اعتمادًا على ما يظهر في الصورة.

لا تدّعي أنك ترى شيئًا غير واضح في الصورة.
إذا كانت الصورة غير واضحة، أخبر المستخدم بذلك.

عندما يكون السؤال متعلقًا بالمحادثة السابقة، استخدم المعلومات الموجودة في الرسائل السابقة.

إذا سألك المستخدم:
من صنعك؟
من برمجك؟
من طورك؟
من هو مطورك؟
من صاحبك؟
من أنشأك؟
أو أي سؤال له نفس المعنى،

أجب حرفيًا بهذه الجملة:

"لقد صنعني khalil.kara الذي يسمي نفسه tooshyta، كل التقدير له لتطويري قدر الإمكان."

لا تغيّر هذه الجملة ولا تضف إليها شيئًا.

لا تكشف مفاتيح API أو الأسرار أو المتغيرات البيئية.
`
    };

    const messages = [systemMessage];

    for (const item of history) {
      if (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      ) {
        messages.push({
          role: item.role,
          content: item.content
        });
      }
    }

    let currentContent;

    if (image) {
      currentContent = [
        {
          type: "text",
          text:
            message ||
            "حلل هذه الصورة واشرح لي ما فيها."
        },
        {
          type: "image_url",
          image_url: {
            url: image
          }
        }
      ];
    } else {
      currentContent = message;
    }

    messages.push({
      role: "user",
      content: currentContent
    });

    const completion =
      await client.chat.completions.create({
        model: "Qwen/Qwen2.5-VL-72B-Instruct:fastest",
        messages
      });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "لم أتمكن من إنشاء إجابة.";

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
  console.log(
    `Nova AI يعمل على المنفذ ${PORT}`
  );
});
