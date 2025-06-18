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
          content: `
あなたは東洋医学とセルフケアに精通した専門家です。

患者の初回診断（体質タイプ・内臓傾向・巡りの病理）と、再診で得られた5つの回答（主訴の変化・体調全体・セルフケア実施・動作の変化・生活習慣）をもとに、

以下の視点でアドバイスを作成してください：

1. 体質や傾向の変化を読み取り、セルフケアとの関連を評価してください。
2. 呼吸法は「ただ深呼吸する」ものではなく、中脘に手を当てて行う経絡呼吸（中焦への刺激）です。吐く・吸う・リズムなど、パターンの実践意義に沿ってコメントを。
3. ストレッチは経絡ストレッチで、体の連動性や内臓負担軽減を目的としています。臓腑負担や動作の変化と関連付けて評価してください。
4. 生活習慣や漢方の影響も考慮に入れてください。

🌱コメントには以下を必ず含めてください：
- ①良かった点のポジティブフィードバック（モチベ向上目的）
- ②継続しやすくするための工夫やヒント（患者目線で）
- ③次に意識してほしい1〜2つの具体的行動・視点（短く・明確に）

🌟トーンは温かく、親しみやすく。
📌箇条書きや絵文字を交えて、読みやすく簡潔にまとめてください。
        `.trim(),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.85,
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
