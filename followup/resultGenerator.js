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
    symptomChange: q1,       // Q1: 主訴の変化
    lifestyleChange: q2,     // Q2: 生活リズムの変化
    careImplementation: q3,  // Q3: 各セルフケアの実施状況（オブジェクト）
    motionTestChange: q4,    // Q4: 動作テストの変化
    careDifficulty: q5       // Q5: セルフケアで困った点（配列）
  };

  // 🔸 advice配列から特定のアドバイスを抽出（現状未使用だが今後拡張用に残す）
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
    lifestyleChange: q2,
    habits: q3?.habits || "未実施",
    breathing: q3?.breathing || "未実施",
    stretch: q3?.stretch || "未実施",
    tsubo: q3?.tsubo || "未実施",
    kampo: q3?.kampo || "未使用",
    motionChange: q4,
    careTrouble: q5
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
