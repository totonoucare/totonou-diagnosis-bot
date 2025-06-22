/**
 * フォローアップ診断の入力（Q1〜Q5）と、過去の体質情報（context）から
 * GPTへの送信に必要なプロンプト用データを構成する。
 *
 * @param {Object} answers - Q1〜Q5の回答（オブジェクト形式）
 * @param {Object} context - Supabaseに保存された診断結果＆アドバイス情報
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}) {
  // 🔹そのまま保存したい回答の生データ
  const rawData = {
    symptom_level: parseInt(answers.symptom) || null,
    general_level: parseInt(answers.general) || null,
    sleep: parseInt(answers.sleep) || null,
    meal: parseInt(answers.meal) || null,
    stress: parseInt(answers.stress) || null,
    habits: answers.habits || null,
    breathing: answers.breathing || null,
    stretch: answers.stretch || null,
    tsubo: answers.tsubo || null,
    kampo: answers.kampo || null,
    motion_level: parseInt(answers.motion) || null,
    q5_answer: answers.q5_answer || null,
  };

  const adviceArray = Array.isArray(context.advice) ? context.advice : [];

  const promptParts = {
    // 🩺 前回診断情報（context由来）
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",
    typeName: context.type || "未登録",
    traits: context.trait || "未登録",
    flowIssue: context.flowType || "未登録",
    organBurden: context.organType || "未登録",
    scores: context.scores || [],
    adviceCards: adviceArray,

    // 📝 フォローアップ回答（Q1〜Q5）
    symptomChange: {
      symptom: rawData.symptom_level,
      general: rawData.general_level
    },
    lifestyleChange: {
      sleep: rawData.sleep,
      meal: rawData.meal,
      stress: rawData.stress
    },
    habits: rawData.habits || "未実施",
    breathing: rawData.breathing || "未実施",
    stretch: rawData.stretch || "未実施",
    tsubo: rawData.tsubo || "未実施",
    kampo: rawData.kampo || "未使用",
    motionChange: rawData.motion_level,
    careTrouble: rawData.q5_answer
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
