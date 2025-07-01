/**
 * フォローアップ診断の入力（Q1〜Q5）と、過去の体質情報（context）から
 * GPTへの送信に必要なプロンプト用データを構成する。
 *
 * @param {Object} answers - Q1〜Q5の回答（オブジェクト形式）
 * @param {Object} context - Supabaseに保存された診断結果＆アドバイス情報
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}) {
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
    motion_level: parseInt(answers.motion_level) || null,
    q5_answer: answers.q5_answer || null,
  };

  const advice = context.advice || {};

  const promptParts = {
    // 初回情報（Myととのうガイド）
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",
    advice: {
      habits: advice.habits || "未登録",
      breathing: advice.breathing || "未登録",
      stretch: advice.stretch || "未登録",
      tsubo: advice.tsubo || "未登録",
      kampo: advice.kampo || "未登録",
    },

    // Q1〜Q5（今回の定期チェック診断）
    Q1: {
      symptom: rawData.symptom_level,
      general: rawData.general_level,
    },
    Q2: {
      sleep: rawData.sleep,
      meal: rawData.meal,
      stress: rawData.stress,
    },
    Q3: {
      habits: rawData.habits || "未実施",
      breathing: rawData.breathing || "未実施",
      stretch: rawData.stretch || "未実施",
      tsubo: rawData.tsubo || "未実施",
      kampo: rawData.kampo || "未使用",
    },
    Q4: rawData.motion_level,
    Q5: rawData.q5_answer || "F", // 特になしをデフォに
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
