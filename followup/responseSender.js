// followup/responseSender.js

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * advice 配列から各項目を抽出してオブジェクトに変換する
 * @param {Array} adviceArray - contextsテーブルのadvice配列
 * @returns {Object} - { habits, breathing, stretch, tsubo, kampo }
 */
function extractAdviceFields(adviceArray) {
  if (!Array.isArray(adviceArray)) return {};

  const getByHeader = (keyword) => {
    const item = adviceArray.find(a => a.header.includes(keyword));
    return item ? item.body : "未登録";
  };

  return {
    habits: getByHeader("体質改善習慣"),
    breathing: getByHeader("呼吸法"),
    stretch: getByHeader("ストレッチ"),
    tsubo: getByHeader("ツボ"),
    kampo: getByHeader("漢方薬"),
  };
}

// 🗾 英語→日本語 主訴変換マップ
const symptomMap = {
  "stomach": "胃腸の調子",
  "sleep": "睡眠・集中力",
  "pain": "肩こり・腰痛・関節痛",
  "mental": "イライラや不安感",
  "cold": "冷え・のぼせ・むくみ",
  "skin": "頭皮や肌トラブル",
  "pollen": "花粉症や鼻炎",
  "women": "女性特有のお悩み",
  "unknown": "なんとなく不調・不定愁訴",
};


/**
 * フォローアップ回答と過去のcontextからGPTコメントを生成する
 * @param {string} userId - SupabaseのUUID（users.id）
 * @param {object} followupAnswers - フォローアップ診断の回答データ
 * @returns {Promise<{gptComment: string, statusMessage: string} | null>}
 */
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // ✅ userId（UUID）から lineId を取得
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`❌ userId: ${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

    // 🧠 context（初回体質ケア分析の情報）を取得
    const context = await supabaseMemoryManager.getContext(lineId);

    if (!context || !followupAnswers) {
      console.error("❌ context または followupAnswers が不足しています。");
      return null;
    }

    const { advice, motion, symptom } = context;

    // adviceが配列かどうかを判定して整形
    const adviceParsed = Array.isArray(advice) ? extractAdviceFields(advice) : advice || {};
    const symptomJapanese = symptomMap[symptom] || symptom || "未登録";

    const systemPrompt = `
あなたは東洋医学専門の鍼灸師・医薬品登録販売者が監修したセルフケア支援の専門家AI「トトノウくん」です。

ユーザーの初回体質ケア分析で作成された「ととのうケアガイド（体質・巡りに基づいたセルフケア提案）」を参考に、
今回の定期チェックナビの結果（Q1〜Q5）を踏まえて、状態の変化やアドバイスをまとめてください。

診断コメントには以下の視点を含めてください：
1. 初回体質ケア分析時のお悩み（symptomJapanese）のレベルを5と比較した、お悩みの改善度合いおよび全体的な体調の変化→ Q1より
2. 生活習慣の整い度合いと改善点 → Q2と advice.habits より
3. 各セルフケア実施状況と定着レベル → Q3と advice より
4. 経絡ストレッチ（Q4）と「motion」に基づくライン改善の観察 → motion + Q4 + advice.stretch を照合
5. Q5の困りごと（継続阻害要因）を踏まえた前向きなアドバイス

形式は以下にしてください：
- 冒頭で体調全体や変化を手短にコメント（可愛げのある親しみやすい口調で、絵文字を駆使して）
- 「このまま続けるといいこと」リスト（良い習慣への称賛）
- 「次にやってみてほしいこと」リスト（今後の提案）
- 締めのひとこと（前向きに、一緒に続けようというニュアンス）
- 各リストの前にわかりやすい絵文字をつけ、余計な記号(*,-,#など)は使わないこと。

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
`.trim();

    const userPrompt = `
【お悩み】${symptomJapanese || "未登録"}

【ととのうケアガイド（体質ケア分析ベース）】
- 習慣：${adviceParsed.habits || "未登録"}
- 呼吸法：${adviceParsed.breathing || "未登録"}
- ストレッチ：${adviceParsed.stretch || "未登録"}
- ツボケア：${adviceParsed.tsubo || "未登録"}
- 漢方薬：${adviceParsed.kampo || "未登録"}

【初回の動作テスト】${motion || "未登録"}

【今回の定期チェックナビ結果】
Q1. 「${symptomJapanese}」のつらさ：${followupAnswers?.symptom_level || "未入力"}
　　全体の体調：${followupAnswers?.general_level || "未入力"}
Q2. 睡眠：${followupAnswers?.sleep || "未入力"} ／ 食事：${followupAnswers?.meal || "未入力"} ／ ストレス：${followupAnswers?.stress || "未入力"}
Q3. セルフケア実施状況：
　- 習慣：${followupAnswers?.habits || "未入力"}
　- 呼吸法：${followupAnswers?.breathing || "未入力"}
　- ストレッチ：${followupAnswers?.stretch || "未入力"}
　- ツボ：${followupAnswers?.tsubo || "未入力"}
　- 漢方薬：${followupAnswers?.kampo || "未入力"}
Q4. 動作テストの改善度：${followupAnswers?.motion_level || "未入力"}
Q5. セルフケアで困ったこと：${followupAnswers?.q5_answer || "未入力"}
`.trim();

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
    });

    const replyText = chatCompletion.choices?.[0]?.message?.content?.trim() || "";

    return {
      gptComment: replyText,
      statusMessage: "",
    };
  } catch (error) {
    console.error("❌ OpenAI 応答エラー:", error);
    return {
      gptComment: "GPT応答時にエラーが発生しました。時間を置いて再度お試しください。",
      statusMessage: "",
    };
  }
}

module.exports = { sendFollowupResponse };
