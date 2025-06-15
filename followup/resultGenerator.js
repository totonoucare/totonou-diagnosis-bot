// followup/resultGenerator.js

/**
 * フォローアップ診断の入力（Q1〜Q5）と、過去の体質情報（context）から
 * GPTへの送信に必要なプロンプト用データを構成する。
 *
 * @param {Array} answers - Q1〜Q5の回答（配列）
 * @param {Object} context - Supabaseに保存された診断結果＆アドバイス情報
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}) {
  const [q1, q2, q3, q4, q5] = answers;

  // 🔹そのまま保存したい回答の生データ
  const rawData = {
    symptomChange: q1,
    overallCondition: q2,
    careDetails: q3,
    motionTestChange: q4,
    lifestyleChange: q5
  };

  // 🔸プロンプト用に構造化した情報
  const promptParts = {
    // 🩺 前回診断情報（context由来）
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",

    typeName: context.type || "未登録",  // ← context.type に統一
    traits: context.trait || "未登録",
    flowIssue: context.flowIssue || "未登録",
    organBurden: context.organBurden || "未登録",

    planAdvice: context.advice?.habit || "（前回アドバイス未登録）",
    link: context.advice?.kampo || "（未登録）",

    // 📝 フォローアップ回答
    symptomChange: q1,
    overall: q2,
    habits: q3?.habits || "未実施",
    stretch: q3?.stretch || "未実施",
    breathing: q3?.breathing || "未実施",
    kampo: q3?.kampo || "未使用",
    otherCare: q3?.other || "なし",
    motionChange: q4,
    lifestyle: q5
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
