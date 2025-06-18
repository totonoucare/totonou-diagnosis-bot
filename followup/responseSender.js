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

  const planAdvice = adviceCards.find((c) =>
    c.header?.includes("体質改善習慣")
  )?.body || "（初回のアドバイスが取得できませんでした）";

  const stretchAdvice = adviceCards.find((c) =>
    c.header?.includes("ストレッチ")
  )?.body || "（ストレッチのアドバイス未登録）";

  const breathingAdvice = adviceCards.find((c) =>
    c.header?.includes("呼吸法")
  )?.body || "（呼吸法のアドバイス未登録）";

  const kampoAdvice = adviceCards.find((c) =>
    c.header?.includes("漢方薬")
  )?.body || "（漢方薬のアドバイス未登録）";

  const tsuboAdvice = adviceCards.find((c) =>
    c.header?.includes("ツボ")
  )?.body || "（ツボのアドバイス未登録）";

  return `
あなたは東洋医学とセルフケアに精通したAIパートナー「ととのうAI」です。
以下の診断データに基づき、患者さんの努力と体の変化をねぎらいながら、
ポジティブで前向きなアドバイスを伝えてください。
口調は「温かく・親しみやすく・少しだけカジュアル」にしてください。
専門家というより「一緒にがんばる伴走パートナーAI」の立ち位置です。

🎯 指示：
- 読みやすく、長すぎない内容にしてください（目安：400文字前後）
- セルフケア項目（呼吸法・ストレッチなど）の初回提案ケア(ととのうガイド)をベースにしつつ、今回の評価も踏まえて「どう改善すればいいか」を簡潔に書いてください
- 提案したセルフケアをあまり実践せずに不調が快方に向かっていない場合は、言葉を選んで優しく促すようにしてください
- ストレッチや呼吸法が“なんで大事なのか”を、経絡・巡り・内臓などの説明もライトに含めて触れてください
- アドバイスは“やってみたくなるように”楽しく・励ますトーンで
- 必ず1つ以上は「これは続けてほしい！」というポイントを入れてください
- 絵文字も適度に使って、明るく励ますようにしてください。※余計な記号(""や#など)など、コード文のような記号は入れないでください。

📦 前回診断結果
- タイプ：${parts.typeName}
- 傾向：${parts.traits}
- 巡り：${parts.flowIssue}
- 内臓：${parts.organBurden}

${scoreExplanation}

🧭 前回アドバイス（ととのう計画）
${planAdvice}

💨 呼吸法アドバイス
${breathingAdvice}

🤸 経絡ストレッチアドバイス
${stretchAdvice}

🌿 漢方薬アドバイス
${kampoAdvice}

🎯 ツボ・その他のアドバイス
${tsuboAdvice}

📝 今回の再診回答
- 主訴：${parts.symptom}
- 主訴の変化：${parts.symptomChange}
- 全体の体調：${parts.overall}
- 呼吸法：${parts.breathing}
- ストレッチ：${parts.stretch}
- 漢方薬：${parts.kampo}
- その他：${parts.otherCare}
- 動作テスト：${parts.motion} → ${parts.motionChange}
- ライフスタイル変化：${parts.lifestyle}
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
            "あなたは東洋医学に詳しく、患者と伴走するパートナーAIです。優しく、わかりやすく、応援の気持ちを込めてアドバイスしてください。絵文字も適度にOK。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.85,
      max_tokens: 1200,
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
