// followup/responseSender.js

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(parts) {
  return `
患者の初回診断結果と、今回の再診内容を以下にまとめます。
あなたは東洋医学の専門家として、改善点や継続すべき点を優しく、具体的にコメントしてください。

【前回診断結果】
- 体質タイプ：${parts.typeName}
- お体の傾向：${parts.traits}
- 巡りの傾向：${parts.flowIssue}
- 内臓の負担傾向：${parts.organBurden}
- ととのう計画：${parts.planAdvice}
- 推奨漢方リンク：${parts.link}

【主訴】${parts.symptom}
【主訴の変化】${parts.symptomChange}
【体調全体】${parts.overall}

【セルフケア実施状況】
- 習慣改善：${parts.habits}
- ストレッチ：${parts.stretch}
- 呼吸法：${parts.breathing}
- 漢方薬：${parts.kampo}
- その他：${parts.otherCare}

【動作テスト】
- 前回の動作：${parts.motion}
- 今回の動作変化：${parts.motionChange}

【生活習慣の変化】${parts.lifestyle}

以上を踏まえて、患者さんの体の変化と今後の“ととのう習慣”について、
温かい言葉と共にアドバイスをお願いします。
`;
}

async function sendFollowupPromptToGPT(promptParts) {
  const prompt = buildPrompt(promptParts);

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは東洋医学とセルフケアに精通した専門家です。患者の状態変化や取り組みに寄り添い、思いやりのある言葉で今後の指針を提案してください。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    return chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";
  } catch (error) {
    console.error("❌ GPT送信エラー:", error);
    return "エラーが発生しました。通信環境をご確認のうえ、もう一度お試しください。";
  }
}

module.exports = sendFollowupPromptToGPT;
