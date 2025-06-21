/**
 * フォローアップ診断の入力（Q1〜Q5）と、過去の体質情報（context）から
 * GPTへの送信に必要なプロンプト用データを構成する。
 *
 * @param {Array} answers - Q1〜Q5の回答（配列）
 * @param {Object} context - Supabaseに保存された診断結果＆アドバイス情報
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}) {
  const [q1 = {}, q2 = 0, q3 = {}, q4 = 0, q5 = ""] = answers;

  // 🔹そのまま保存したい回答の生データ
  const rawData = {
    symptom_level: parseInt(q1.symptom) || null,
    general_level: parseInt(q1.general) || null,
    sleep: parseInt(q2) || null,
    habits: q3.habits || null,
    breathing: q3.breathing || null,
    stretch: q3.stretch || null,
    tsubo: q3.tsubo || null,
    kampo: q3.kampo || null,
    motion_level: parseInt(q4) || null,
    difficulty: q5 || null,
  };

  const adviceArray = Array.isArray(context.advice) ? context.advice : [];

  const promptParts = {
    // 🩺 前回診断情報（context由来）
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",
    typeName: context.type || "未登録",
    traits: context.trait || "未登録",
    flowIssue: context.flowIssue || "未登録",
    organBurden: context.organBurden || "未登録",
    scores: context.scores || [],
    adviceCards: adviceArray,

    // 📝 フォローアップ回答（Q1〜Q5）
    symptomChange: q1,
    lifestyleChange: q2,
    habits: rawData.habits || "未実施",
    breathing: rawData.breathing || "未実施",
    stretch: rawData.stretch || "未実施",
    tsubo: rawData.tsubo || "未実施",
    kampo: rawData.kampo || "未使用",
    motionChange: q4,
    careTrouble: q5
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
