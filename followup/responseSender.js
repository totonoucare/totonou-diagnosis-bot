const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function buildPrompt(parts = {}) {
  const { scores = [], adviceCards = [] } = parts;
  const [score1, score2, score3] = scores;

  const scoreExplanation = scores.length === 3
    ? `
【前回の体質スコア】
- 虚実（体力の絶対量）: ${score1}
- 寒熱（体内の熱状態）: ${score2}
- 気血バランス: ${score3}（+1=気虚／-1=血虚）

※ スコア定義
- 虚実： -1 = 虚（体力少ない）／+1 = 実（体力あり）
- 寒熱： -1 = 寒（冷え体質）／+1 = 熱（熱がこもる体質）
- 陰陽： -1 = 血虚（栄養・潤い不足）／+1 = 気虚（エネルギー不足）
`
    : "（体質スコアの記録はありません）";

  const planAdvice = adviceCards.find(c => c.header?.includes("体質改善習慣"))?.body || "（体質改善アドバイス未登録）";
  const breathingAdvice = adviceCards.find(c => c.header?.includes("呼吸"))?.body || "（呼吸法アドバイス未登録）";
  const stretchAdvice = adviceCards.find(c => c.header?.includes("ストレッチ"))?.body || "（ストレッチアドバイス未登録）";
  const kampoAdvice = adviceCards.find(c => c.header?.includes("漢方"))?.body || "（漢方薬アドバイス未登録）";
  const tsuboAdvice = adviceCards.find(c => c.header?.includes("ツボ"))?.body || "（ツボアドバイス未登録）";

  return `
あなたは、東洋医学とセルフケアに詳しいサポートAIです。
以下の情報をもとに、再診ユーザーに対してやさしく寄り添うようにアドバイスしてください。

1.	前回の「ととのうガイド」に沿って取り組めた点を1つだけ選んでしっかり褒めて応援してください（絵文字もOK）。
	2.	「ととのうガイド」であまり実行できていなかった項目のうち、優先度が高いものを1つ選び、前向きに提案・ヒントを添えてください。
	3.	コメントでは、以下のセルフケア項目の優先順位を考慮してください（重要な順）：
	•	1位：体質改善習慣（食事・睡眠）
	•	2位：呼吸法（巡りととのえ呼吸）
	•	3位：経絡ストレッチ
	•	4位：ツボケア（押す・お灸など）
	•	5位：漢方薬（補助的）
	4.	コメントは1つか2つのポイントに絞って、250文字以内で簡潔かつ中身のある内容にしてください。
	5.	前回のアドバイス内容を正確に反映させることを最優先してください（ととのうガイドの各項目の文を参考にする）。


トーンは、**信頼できるパートナーのように**。あたたかく、フレンドリーで、でも芯のある語り口にしてください。

【前回の診断結果】
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}

${scoreExplanation}

【ととのうガイド（初回アドバイス）】
以下は、患者さんの体質に合わせて前回提案された具体的なセルフケアガイドです。
これらをしっかり参考にしてコメントを構成してください。

1. 💡体質改善習慣
${planAdvice}

2. 🧘巡りととのえ呼吸法
${breathingAdvice}

3. 🧍経絡ストレッチ
${stretchAdvice}

4. 🎯ツボケア
${tsuboAdvice}

5. 🌿漢方薬の選び方
${kampoAdvice}

【今回の再診データ】
- 主訴：${parts.symptom}
- 主訴の変化：${parts.symptomChange}
- 全体の体調：${parts.overall}
- セルフケア状況：
   ・習慣：${parts.habits}
   ・ストレッチ：${parts.stretch}
   ・呼吸法：${parts.breathing}
   ・漢方薬：${parts.kampo}
   ・ツボ・その他：${parts.otherCare}
- 動作テスト変化：${parts.motionChange}
- ライフスタイルの変化：${parts.lifestyle}
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
            "あなたは東洋医学に詳しく、患者と伴走するサポートAIです。やさしく、寄り添うように、ポジティブなフィードバックと実行しやすいアドバイスを短く伝えてください（絵文字もOK）。内容は250文字以内を目安に簡潔にまとめてください。ととのうガイド（初回アドバイス）をしっかり反映することが最重要です。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.82,
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
