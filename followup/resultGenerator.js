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
    lifestyle: q2,
    careDetails: q3,
    motionTestChange: q4,
    careTrouble: q5
  };

  // 🔸 advice配列から特定のアドバイスを抽出
  const adviceArray = Array.isArray(context.advice) ? context.advice : [];
  const findAdviceByHeader = (keyword) =>
    adviceArray.find(card => card.header.includes(keyword))?.body || "（前回アドバイス未登録）";

  const promptParts = {
    // 🩺 前回診断情報（context由来）
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",

    typeName: context.type || "未登録",
    traits: context.trait || "未登録",
    flowIssue: context.flowIssue || "未登録",
    organBurden: context.organBurden || "未登録",
    scores: context.scores || [],

    // 🌿 セルフケア計画とリンク（カルーセルより取得）
    adviceCards: adviceArray,

    // 📝 フォローアップ回答（Q1〜Q5）
    symptomChange: q1,
    lifestyle: q2,
    habits: q3?.habits || "未実施",
    stretch: q3?.stretch || "未実施",
    breathing: q3?.breathing || "未実施",
    kampo: q3?.kampo || "未使用",
    otherCare: q3?.other || "なし",
    motionChange: q4,
    careTrouble: q5
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
