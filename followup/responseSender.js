const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function sendFollowupComment({ lineId, context, followupAnswers }) {
  if (!context || !followupAnswers) {
    console.error("❌ context または followupAnswers が不足しています。");
    return null;
  }

  const { advice, motion, symptom } = context;

  const systemPrompt = `
あなたは東洋医学に基づいたセルフケア支援の専門家です。

ユーザーの前回診断で作成された「Myととのうガイド（体質・巡りに基づいたセルフケア提案）」を参考に、
今回の定期チェック診断の結果（Q1〜Q5）を踏まえて、状態の変化やアドバイスをまとめてください。

診断コメントには以下の視点を含めてください：
1. 前回診断内容と比較した体調の変化（主訴症状・全体的体調）→ Q1より
2. 生活習慣の整い度合いと改善点 → Q2より
3. 各セルフケア実施状況と定着レベル → Q3と advice より
4. 経絡ストレッチ（Q4）と「motion」に基づくライン改善の観察 → motion + Q4 + advice.stretch を照合
5. Q5の困りごと（継続阻害要因）を踏まえた前向きなアドバイス

形式は以下にしてください：
- 冒頭で体調全体や変化をコメント（親しみやすい口調で）
- 「このまま続けるといいこと」リスト（良い習慣への称賛）
- 「次にやってみてほしいこと」リスト（今後の提案）
- 締めのひとこと（前向きに、一緒に続けようというニュアンス）

【回答スケール定義】
- Q1（体調）・Q2（生活リズム）・Q4（動作テストの変化）：
　　1＝とても良い（改善）〜 5＝悪化・不調
- Q3（セルフケア習慣）：
　　1＝継続中、2＝時々実施、3＝未着手
- Q5（セルフケアの困りごと）：
　　A＝やり方が分からなかった／B＝効果を感じなかった／
　　C＝時間が取れなかった／D＝体に合わない気がした／
　　E＝モチベーションが続かなかった／F＝特になし

【補足：Q4の「motion」→ 経絡マッピング】
motion に応じて、以下の経絡ラインに注目してコメントしてください：

- 首を後ろに倒す／左右に回す → 肺経／大腸経（首前面ライン）
- 腕をバンザイする → 心経／小腸経（腕の内側ライン）
- 立って前屈する → 腎経／膀胱経（体背面ライン）
- 腰を左右にねじるor側屈 → 肝経／胆経（体側ライン）
- 上体をそらす → 脾経／胃経（腹部・太もも前面ライン）

注意：
- advice.habits, breathing, stretch, tsubo, kampo はすべてMyととのうガイドの内容です。
- Q3の「継続中」項目はしっかり称賛し、「未着手」「時々」には励ましと改善ヒントを。
- Q5が A〜E の場合は、共感と気持ちに寄り添うフォローを加えてください。
`;

  const userPrompt = `
【主訴】${symptom}

【Myととのうガイド（前回診断ベース）】
- 習慣：${advice?.habits || "未登録"}
- 呼吸法：${advice?.breathing || "未登録"}
- ストレッチ：${advice?.stretch || "未登録"}
- ツボケア：${advice?.tsubo || "未登録"}
- 漢方薬：${advice?.kampo || "未登録"}

【初回の動作テスト】${motion}

【今回の定期チェック診断結果】
Q1. 「${symptom}」のつらさ：${followupAnswers.Q1.symptom}
　　全体の体調：${followupAnswers.Q1.general}
Q2. 睡眠：${followupAnswers.Q2.sleep} ／ 食事：${followupAnswers.Q2.meal} ／ ストレス：${followupAnswers.Q2.stress}
Q3. セルフケア実施状況：
　- 習慣：${followupAnswers.Q3.habits}
　- 呼吸法：${followupAnswers.Q3.breathing}
　- ストレッチ：${followupAnswers.Q3.stretch}
　- ツボ：${followupAnswers.Q3.tsubo}
　- 漢方薬：${followupAnswers.Q3.kampo}
Q4. 動作テストの改善度：${followupAnswers.Q4}
Q5. セルフケアで困ったこと：${followupAnswers.Q5}
`;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt.trim() },
        { role: "user", content: userPrompt.trim() }
      ],
      temperature: 0.7
    });

    const replyText = chatCompletion.choices?.[0]?.message?.content || "";
    return replyText;
  } catch (error) {
    console.error("❌ OpenAI 応答エラー:", error);
    return null;
  }
}

module.exports = { sendFollowupComment };
