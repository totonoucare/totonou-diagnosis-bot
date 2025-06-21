const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildPrompt(parts = {}) {
  const { scores = [], adviceCards = [] } = parts;
  const [score1, score2, score3] = scores;

  const scoreExplanation = scores.length === 3
    ? `
【初回診断時の体質スコア】
- 虚実（体力の絶対量）: ${score1}
- 寒熱（体内の熱状態）: ${score2}
- 気血バランス: ${score3}（+1=気虚／-1=血虚）

※ スコア定義
- 虚実： -1 = 虚（体力少ない）／+1 = 実（体力あり）
- 寒熱： -1 = 寒（冷え体質）／+1 = 熱（熱がこもる体質）
- 陰陽： -1 = 血虚（栄養・潤い不足）／+1 = 気虚（エネルギー不足）
`
    : "（体質スコアの記録はありません）";

  const find = (keyword) =>
    adviceCards.find(c => c.header?.includes(keyword))?.body || "（アドバイス未登録）";

  return `
あなたは、東洋医学とセルフケアに詳しいサポートAIです。
以下の情報をもとに、再診ユーザーに対してやさしく寄り添うようにアドバイスしてください。

1. 前回の「ととのうガイド」に沿って取り組めた点を1つだけ選んでしっかり褒めて応援してください（絵文字もOK）。
2. あまり実行できていなかった項目の中で、優先度が高いものを1つ選び、改善提案とヒントを添えてください。
3. コメントでは以下の優先度を考慮してください：
   • 1位：体質改善習慣　• 2位：呼吸法　• 3位：ストレッチ　• 4位：ツボ　• 5位：漢方薬
4. コメントは250文字以内で端的に。あたたかく、信頼できる語り口で。

【前回の診断結果】
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}

${scoreExplanation}

【ととのうガイド】
1. 💡体質改善習慣\n${find("体質改善")}
2. 🧘巡り呼吸\n${find("呼吸")}
3. 🧍経絡ストレッチ\n${find("ストレッチ")}
4. 🎯ツボケア\n${find("ツボ")}
5. 🌿漢方薬\n${find("漢方")}

【再診データ】
- 主訴：${parts.symptom || "未登録"}
- 主訴の変化：${parts.symptom_level || "未入力"}
- 全体の体調：${parts.general_level || "未入力"}
- 動作テストの変化：${parts.motion_level || "未入力"}

- セルフケア実践：
  ・睡眠：${parts.sleep || "未入力"}
  ・食事：${parts.meal || "未入力"}
  ・ストレス：${parts.stress || "未入力"}
  ・習慣：${parts.habits || "未入力"}
  ・呼吸法：${parts.breathing || "未入力"}
  ・ストレッチ：${parts.stretch || "未入力"}
  ・ツボ：${parts.tsubo || "未入力"}
  ・漢方：${parts.kampo || "未入力"}

- セルフケアで困ったこと：${parts.difficulty || "未入力"}
`;
}

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // 初回診断（context）取得
    const context = await supabaseMemoryManager.getContext(userId);

    // 再診データと統合
    const promptParts = {
      ...context,
      ...followupAnswers,
    };

    const prompt = buildPrompt(promptParts);

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは東洋医学に詳しいセルフケア支援AIです。親しみやすく、希望が持てるアドバイスを250文字以内で返してください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.82,
      max_tokens: 1200,
    });

    const gptComment = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";

    // ✅ 数値スコアを基に卒業判定・再診誘導
    const sym = parseInt(followupAnswers.symptom_level);
    const gen = parseInt(followupAnswers.general_level);

    let statusMessage = "";

    if (sym <= 2 && gen <= 2) {
      statusMessage = `🎉 主訴も全体の体調も改善していますね！\n今後はリマインド機能（月額半額）だけの継続もご検討いただけます。`;
    } else if (sym <= 2 && gen >= 3) {
      statusMessage = `🎯 主訴は落ち着きましたが、全体的な体調がまだ不安定なようです。\n再評価のため、もう一度初回診断を受けてみることをおすすめします。`;
    } else {
      statusMessage = `📊 改善の途中段階です。引き続きサポートいたしますので、一緒にととのえていきましょう！`;
    }

    return {
      gptComment,
      statusMessage,
    };
  } catch (err) {
    console.error("❌ フォローアップ解析エラー:", err);
    return {
      gptComment: "再診コメントの生成に失敗しました。",
      statusMessage: "エラーが発生しました。しばらくしてからお試しください。",
    };
  }
}

module.exports = {
  sendFollowupResponse,
};
