const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🧭 初回診断時motionの経絡対応
function getMeridianFromMotion(motion) {
  switch (motion) {
    case "前屈":
    case "立って前屈する":
      return "腎経／膀胱経（体背面ライン）";
    case "上体をそらす":
    case "上体をそらす（腰に手を当て）":
      return "脾経／胃経（前面ライン）";
    case "バンザイ":
    case "腕をバンザイする":
      return "心経／小腸経（腕の内側ライン）";
    case "腰を左右にねじる":
    case "腰を側屈":
      return "肝経／胆経（体側ライン）";
    case "首を後ろに倒す":
    case "首を左右に回す":
      return "肺経／大腸経（首前面ライン）";
    default:
      return "不明";
  }
}

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
今回の定期チェック診断の内容とデータベースの内容をすべて列挙してください。これは君に渡されてる情報がどれだけあるかのテストです。


【初回診断の結果】
- 主訴：${parts.symptom || "未登録"}
- 体質タイプ：${parts.typeName || "不明"}
- 傾向：${parts.traits || "不明"}
- 巡りの傾向：${parts.flowIssue || "不明"}
- 内臓の負担傾向：${parts.organBurden || "不明"}
- 初回診断時の動作テスト：${parts.motion || "未登録"}（${getMeridianFromMotion(parts.motion)}）

${scoreExplanation}

【ととのうガイド】
1. 💡体質改善習慣\n${find("体質改善")}
2. 🧘巡り呼吸\n${find("呼吸")}
3. 🤸経絡ストレッチ\n${find("ストレッチ")}
4. 🎯ツボケア\n${find("ツボ")}
5. 🌿漢方薬\n${find("漢方")}

【再診データ】
- 主訴の変化(Q1)：${parts.symptom_level || "未入力"}
- 全体の体調(Q1)：${parts.general_level || "未入力"}
- 生活リズムの整い具合(Q2)：
  ・睡眠：${parts.sleep || "未入力"}
  ・食事：${parts.meal || "未入力"}
  ・ストレス：${parts.stress || "未入力"}
- セルフケア実施状況(Q3)：
  ・習慣：${parts.habits || "未入力"}
  ・呼吸法：${parts.breathing || "未入力"}
  ・ストレッチ：${parts.stretch || "未入力"}
  ・ツボ：${parts.tsubo || "未入力"}
  ・漢方：${parts.kampo || "未入力"}
- 動作テストの変化(Q4)：${parts.motion_level || "未入力"}
- セルフケアで困ったこと（Q5）：${parts.q5_answer || "未入力"}
`;
}

async function sendFollowupResponse(userId, followupAnswers) {
  try {
    const context = await supabaseMemoryManager.getContext(userId);
    
    // 🔄 Q1〜Q5などの回答を優先してマージ
    const promptParts = {
      ...followupAnswers,
      ...context,
    };

    const prompt = buildPrompt(promptParts);

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "あなたは東洋医学に詳しいセルフケア伴走AIです。親しみやすく可愛げのあるキャラで、希望が持てるアドバイスを350文字前後で返してください。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const gptComment = chatCompletion.choices?.[0]?.message?.content || "解析に失敗しました。";

    return {
      gptComment,
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
