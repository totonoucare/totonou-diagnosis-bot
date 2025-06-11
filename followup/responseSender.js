// followup/responseSender.js

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // .env に API キーを保存
});

/**
 * GPTにフォローアップ診断プロンプトを渡してコメントを生成
 * @param {string} prompt - resultGeneratorで構成された自然言語プロンプト
 * @returns {Promise<string>} GPTからの返答メッセージ（思いやりあるアドバイス含む）
 */
async function sendFollowupPromptToGPT(prompt) {
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは思いやりのある東洋医学の専門家です。患者の体調・セルフケア状況をふまえて、専門的かつ優しいコメントを返してください。専門用語の乱用は避け、やさしく温かい言葉でまとめてください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8, // 少し柔らかめの表現を許容
      max_tokens: 800,
    });

    const reply = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";
    return reply;
  } catch (error) {
    console.error("❌ GPT送信エラー:", error);
    return "エラーが発生しました。通信環境をご確認のうえ、もう一度お試しください。";
  }
}

module.exports = sendFollowupPromptToGPT;
