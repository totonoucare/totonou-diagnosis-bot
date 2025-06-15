// followup/responseSender.js

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(parts = {}) {
  const { scores = [], adviceCards = [] } = parts;

  const [score1, score2, score3] = scores;
  const scoreExplanation =
    scores.length === 3
      ? `
【前回の体質スコア】
- 虚実（体力の絶対量）: ${score1}
- 寒熱（体内の熱状態）: ${score2}
- 気血バランス（+1:気虚, -1:血虚）: ${score3}

※ スコア定義：
  - 虚実： -1 = 虚（体力少ない）／+1 = 実（体力あり）
  - 寒熱： -1 = 寒（冷え体質）／+1 = 熱（熱がこもる体質）
  - 陰陽： -1 = 血虚（栄養・潤い不足）／+1 = 気虚（エネルギー不足）
`
      : "（体質スコアの記録はありません）";

  const planAdviceCard = adviceCards.find((card) =>
    card.header?.includes("体質改善習慣")
  );
  const planAdvice = planAdviceCard?.body || "不明";

  return `
患者の初回診断結果と、今回の再診内容を以下にまとめます。
あなたは東洋医学の専門家として、改善点や継続すべき点を優しく、具体的にコメントしてください。

【前回診断結果】
- 体質タイプ：${parts.typeName || "不明"}
- お体の傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}
- ととのう計画：${planAdvice}
- 推奨漢方リンク：${parts.link || "なし"}

${scoreExplanation}

【主訴】${parts.symptom || "不明"}
【主訴の変化】${parts.symptomChange || "不明"}
【体調全体】${parts.overall || "不明"}

【セルフケア実施状況】
- 習慣改善：${parts.habits || "未回答"}
- ストレッチ：${parts.stretch || "未回答"}
- 呼吸法：${parts.breathing || "未回答"}
- 漢方薬：${parts.kampo || "未回答"}
- その他：${parts.otherCare || "未回答"}

【動作テスト】
- 前回の動作：${parts.motion || "不明"}
- 今回の動作変化：${parts.motionChange || "不明"}

【生活習慣の変化】${parts.lifestyle || "未記入"}

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

module.exports = {
  sendFollowupPromptToGPT,
  buildPrompt,
};
