// followup/responseSender.js
// 定期チェック：前回差分＋「褒めて伸ばす」コメント生成（GPT-5）
// 設計準拠：5本柱（習慣/呼吸/ストレッチ/ツボ/漢方）をフル参照して次の一歩を選ぶ

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * advice 配列から各項目を抽出してオブジェクトに変換（既存ロジック維持）
 * @param {Array} adviceArray - contextsテーブルのadvice配列
 * @returns {Object} - { habits, breathing, stretch, tsubo, kampo }
 */
function extractAdviceFields(adviceArray) {
  if (!Array.isArray(adviceArray)) return {};

  const getByHeader = (keyword) => {
    const item = adviceArray.find((a) => a.header.includes(keyword));
    return item ? item.body : "未登録";
  };

  return {
    habits:    getByHeader("体質改善習慣"),
    breathing: getByHeader("呼吸法"),
    stretch:   getByHeader("ストレッチ"),
    tsubo:     getByHeader("ツボ"),
    kampo:     getByHeader("漢方薬"),
  };
}

// 🗾 主訴変換（既存維持）
const symptomMap = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節痛",
  mental: "イライラや不安感",
  cold: "冷え・のぼせ・むくみ",
  skin: "頭皮や肌トラブル",
  pollen: "花粉症や鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

// ===== スコア計算（0〜100）・星（1〜5） =====
// Q定義（1良→5悪）と「継続/時々/未着手」を減点換算して合成スコアを作る
function computeScore(ans) {
  let penalty = 0;

  // Q1（主訴/全体）重み 0.35
  penalty += ((ans.symptom_level - 1) + (ans.general_level - 1)) * 3.5;

  // Q2（睡眠/食事/ストレス）重み 0.35
  penalty += ((ans.sleep - 1) + (ans.meal - 1) + (ans.stress - 1)) * 2.333;

  // Q3（セルフケア）重み 0.2
  const map = { "継続": 0, "継続中": 0, "時々": 1, "未着手": 2 };
  const careVals = [ans.habits, ans.breathing, ans.stretch, ans.tsubo, ans.kampo];
  const careScore = careVals.reduce((acc, v) => acc + (map[v] ?? 0), 0);
  penalty += careScore * 2;

  // Q4（動作）重み 0.1
  penalty += (ans.motion_level - 1) * 2.5;

  const raw = 100 - penalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const stars = Math.max(1, Math.min(5, Math.ceil(score / 20)));
  return { score, stars };
}

// ===== 改善点（前回→今回 下がった=改善） =====
function pickPraise(prev, cur) {
  if (!prev) return [];
  const diffs = [
    { key: "symptom_level", label: "主訴", d: prev.symptom_level - cur.symptom_level },
    { key: "sleep", label: "睡眠", d: prev.sleep - cur.sleep },
    { key: "meal", label: "食事", d: prev.meal - cur.meal },
    { key: "stress", label: "ストレス", d: prev.stress - cur.stress },
    { key: "motion_level", label: "動作", d: prev.motion_level - cur.motion_level },
  ];
  return diffs.filter(x => x.d > 0).sort((a,b) => b.d - a.d).slice(0, 2);
}

// ===== ボトルネック（数値が高い=乱れ） =====
function pickBottleneck(cur) {
  const arr = [
    { key: "meal", label: "食事", v: cur.meal },
    { key: "sleep", label: "睡眠", v: cur.sleep },
    { key: "stress", label: "ストレス", v: cur.stress },
    { key: "motion_level", label: "動作", v: cur.motion_level },
  ];
  return arr.filter(c => c.v >= 3).sort((a,b) => b.v - a.v)[0] || null;
}

// ===== 次の一歩：5本柱のうち「どれを前面に出すか」を選ぶ =====
// ルール：未着手優先 → 課題マップ優先 → それでもなければ習慣の小目標
function chooseNextPillar(ans) {
  // 未着手の柱を最優先（導入が最大効果）
  const pillars = [
    { k: "breathing", label: "呼吸法", v: ans.breathing },
    { k: "stretch",   label: "ストレッチ", v: ans.stretch },
    { k: "tsubo",     label: "ツボ", v: ans.tsubo },
    { k: "kampo",     label: "漢方薬", v: ans.kampo },
    { k: "habits",    label: "体質改善習慣", v: ans.habits },
  ];
  const notStarted = pillars.find(p => (p.v || "") === "未着手");
  if (notStarted) return notStarted.k;

  // 乱れているQ2/Q4と柱の紐付けで優先
  // stress>=3 → 呼吸法、meal>=3 → 習慣/漢方、motion>=3 → ストレッチ/ツボ、sleep>=3 → 習慣/呼吸法
  if (ans.stress >= 3) return "breathing";
  if (ans.meal   >= 3) return (ans.kampo === "未着手" ? "kampo" : "habits");
  if (ans.motion_level >= 3) return (ans.stretch === "未着手" ? "stretch" : "tsubo");
  if (ans.sleep  >= 3) return (ans.breathing === "未着手" ? "breathing" : "habits");

  // どれも大きく乱れていない場合は、習慣を微増
  return "habits";
}

// ===== メイン：フォローアップコメント生成 =====
/**
 * @param {string} userId - SupabaseのUUID（users.id）
 * @param {object} followupAnswers - 今回の定期チェック回答（保存直後の値を渡す）
 */
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // userId→lineId（既存フロー踏襲：context取得用）
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const user = users.find((u) => u.id === userId);
    if (!user || !user.line_id) {
      throw new Error(`❌ userId: ${userId} に対応する line_id が見つかりません`);
    }
    const lineId = user.line_id;

    // 初回体質ケア分析の context（5本柱テキスト含む）を取得
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context || !followupAnswers) {
      console.error("❌ context または followupAnswers が不足しています。");
      return null;
    }
    const { advice, motion, symptom } = context;
    const adviceParsed = Array.isArray(advice) ? extractAdviceFields(advice) : advice || {};
    const symptomJapanese = symptomMap[symptom] || symptom || "未登録";

    // 直近2件の followups を userId で取得（今回 vs 前回）
    const { latest, prev } = await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);
    const cur = followupAnswers || latest;
    if (!cur) {
      return {
        gptComment: "今回は記録が見つかりませんでした。もう一度、定期チェックを送ってください。",
        statusMessage: "no-current",
      };
    }

    // スコア＆差分
    const { score, stars } = computeScore(cur);
    const prevScore = prev ? computeScore(prev).score : null;
    const delta = prevScore === null ? null : (score - prevScore);

    // 改善点・課題・次の一歩（柱選定）
    const praise = prev ? pickPraise(prev, cur) : [];
    const bottleneck = pickBottleneck(cur);
    const nextPillar = chooseNextPillar(cur);

    // 次の一歩に挿し込む本文（辞書テキストそのもの）
    const nextStepText = adviceParsed[nextPillar] || "今日は1分だけでも、自分のケア時間を作ってみましょう。";

    // ヘッダ（点と星、差分表記）
    const starText = "★".repeat(stars) + "☆".repeat(5 - stars);
    const header = delta === null || delta === 0
      ? `今週の整いスコア：${score}点 ${starText}`
      : `今週の整いスコア：${score}点（${delta>0?'+':''}${delta}） ${starText}`;

    // GPT プロンプト：元ファイルの形式ルールを踏襲しつつ、短く厳格に
    const systemPrompt = `
あなたは「ととのうAI」。東洋医学の体質ケアに基づき、定期チェック結果から“褒めて伸ばす”コメントを作ります。
出力は次の形式・条件を厳守してください。

【形式】
1) 冒頭：全体の体調・変化をひと言（親しみやすく、絵文字OK）
2) 見出し「このまま続けるといいこと」：2〜3点（具体承認）
3) 見出し「次にやってみてほしいこと」：1〜2点（必ず nextStep を含む）
4) 締めのひとこと（前向き）
※ 箇条書きには絵文字を使い、*-# 等は使わない。

【制約】
- 全角250〜350字
- 冒頭の次の行に header をそのまま載せる
- praise が空でも、今できている小さな取り組みを具体承認する
- bottleneck があれば1点だけ触れる（やさしく課題提示）
- nextPillar に対応する nextStep を**本文に必ず含める**（意味改変禁止、言い換え可）
- 最後に注意書き：「※本サービスは医療行為ではなくセルフケア支援です。」
`.trim();

    const userPrompt = `
【header】
${header}

【主訴】${symptomJapanese}

【今回の定期チェック】
Q1: 主訴=${cur.symptom_level} / 全体=${cur.general_level}
Q2: 睡眠=${cur.sleep} / 食事=${cur.meal} / ストレス=${cur.stress}
Q3: 習慣=${cur.habits} / 呼吸法=${cur.breathing} / ストレッチ=${cur.stretch} / ツボ=${cur.tsubo} / 漢方薬=${cur.kampo}
Q4: 動作=${cur.motion_level}
Q5: 困りごと=${cur.q5_answer || "未入力"}

【改善点（前回→今回で良化）】
${praise.map(p => `${p.label}: ${p.d} 段階改善`).join(" / ") || "（特記事項なし）"}

【課題候補】
${bottleneck ? `${bottleneck.label}（スコア${bottleneck.v}）` : "（特記事項なし）"}

【ととのうケアガイド（5本柱）】
- 習慣：${adviceParsed.habits || "未登録"}
- 呼吸法：${adviceParsed.breathing || "未登録"}
- ストレッチ：${adviceParsed.stretch || "未登録"}
- ツボ：${adviceParsed.tsubo || "未登録"}
- 漢方薬：${adviceParsed.kampo || "未登録"}

【次の一歩（柱と本文）】
pillar: ${nextPillar}
nextStep: ${nextStepText}
`.trim();

    const rsp = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 480,
    });

    const replyText = rsp.choices?.[0]?.message?.content?.trim();
    return {
      gptComment: replyText || `${header}\n小さな積み重ねができています。次は「${nextPillar}」から一歩だけ始めましょう。\n※本サービスは医療行為ではなくセルフケア支援です。`,
      statusMessage: "ok",
    };
  } catch (error) {
    console.error("❌ OpenAI 応答エラー:", error);
    return {
      gptComment: "今週のフィードバック生成に失敗しました。時間を置いて再実行してください。",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
