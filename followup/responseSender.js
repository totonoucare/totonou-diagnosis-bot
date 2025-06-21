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
あなたは、東洋医学とセルフケアに詳しいサポートAIです
以下の情報をもとに、再診ユーザーに対してやさしく寄り添うようにアドバイスしてください

1. 初回診断時に提示した「ととのうガイド」という5つのセルフケア項目（Q3の質問項目に該当）に沿って取り組めた点を1つだけ選んでしっかり褒めて応援してください（絵文字も入れて）
2. Q3で実行度合いが低かったセルフケア項目の中でも、優先度が高いものを2つ選び、改善提案とヒントを添えてください
3. コメントでは以下の優先度を考慮してください：
   • 1位：体質改善習慣　• 2位：呼吸法　• 3位：ストレッチ　• 4位：ツボ　• 5位：漢方薬
4. コメントは300文字前後で端的に。あたたかく、信頼できる語り口で

【スケール定義】
- Q1/Q2/Q4：1＝とても良い（改善）／5＝悪化・不調
- Q3（セルフケア習慣）：未実施 < 時々 < ほぼ毎日
- Q5：セルフケアで一番困ったことを選択（A:やり方が分からなかった／B:効果を感じなかった／C:時間が取れなかった／D:体に合わない気がした／E:モチベが続かなかった／F:その他）

【初回診断の結果】
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}

${scoreExplanation}

【ととのうガイド】
1. 💡体質改善習慣\n${find("体質改善")}
2. 🧘巡り呼吸\n${find("呼吸")}
3. 🤸経絡ストレッチ\n${find("ストレッチ")}
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

- セルフケアで困ったこと（Q5）：${parts.q5_answer || "未入力"}
`;
}

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    const context = await supabaseMemoryManager.getContext(userId);
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
            "あなたは東洋医学に詳しいセルフケア支援AIです。親しみやすく、希望が持てるアドバイスを300文字前後で返してください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const gptComment = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";

    const sym = parseInt(followupAnswers.symptom_level);
    const gen = parseInt(followupAnswers.general_level);

    let statusMessage = "";

    if (sym <= 2 && gen <= 2) {
      statusMessage = `🎉 お悩みの症状も全体の体調も改善していますね！\n今後はリマインド機能のみ（月額半額）の継続もご検討いただけます。`;
    } else if (sym <= 2 && gen >= 3) {
      statusMessage = `🎯 お悩みの症状は落ち着きましたが、全体的な体調がまだ不安定なようですね。\n再評価のため、もう一度初回診断を受けてみることをおすすめします🌱`;
    } else {
      statusMessage = `📊 改善の途中段階ですが、続けていくと着実にお身体は変化していきます！引き続きサポートいたしますので、安心して一緒にととのえていきましょう！`;
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
