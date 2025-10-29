/**
 * フォローアップ診断（ととのい度チェック）
 * Q1〜Q3（Q3＝動作テスト）＋carelog記録＋context.adviceを統合して
 * GPTに送るための rawData / promptParts を構成する。
 *
 * @param {Object} answers - 今回のととのい度チェック回答
 * @param {Object} context - Supabaseに保存された体質ケア分析結果＆アドバイス
 * @param {Object} carelogSummary - 直近のcarelog実施回数（{ habits, breathing, stretch, tsubo, kampo }）
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}, carelogSummary = {}) {
  // ✅ Q1〜Q3（現行3問）を正規化してrawDataにまとめる
  const rawData = {
    // Q1: 主訴（症状レベル）
    symptom_level: parseInt(answers.symptom) || null,

    // Q2: 生活リズム
    sleep: parseInt(answers.sleep) || null,
    meal: parseInt(answers.meal) || null,
    stress: parseInt(answers.stress) || null,

    // Q3: 動作テスト
    motion_level: parseInt(answers.motion_level) || null,

    // carelog実績（期間中の実施回数）
    carelog: {
      habits: carelogSummary.habits || 0,
      breathing: carelogSummary.breathing || 0,
      stretch: carelogSummary.stretch || 0,
      tsubo: carelogSummary.tsubo || 0,
      kampo: carelogSummary.kampo || 0,
    },
  };

  // ✅ context.advice が JSONB配列 or オブジェクトどちらでも対応
  const advice = (() => {
    if (!context.advice) return {};
    if (Array.isArray(context.advice)) {
      const result = {};
      for (const a of context.advice) {
        const h = a.header || "";
        if (/体質改善|習慣/.test(h)) result.habits = a.body;
        if (/呼吸/.test(h)) result.breathing = a.body;
        if (/ストレッチ/.test(h)) result.stretch = a.body;
        if (/ツボ/.test(h)) result.tsubo = a.body;
        if (/漢方/.test(h)) result.kampo = a.body;
      }
      return result;
    }
    return context.advice;
  })();

  // ✅ GPTプロンプト用の整形（advice + carelog両方含む）
  const promptParts = {
    // 体質・ケア分析情報
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",
    advice: {
      habits: advice.habits || "未登録",
      breathing: advice.breathing || "未登録",
      stretch: advice.stretch || "未登録",
      tsubo: advice.tsubo || "未登録",
      kampo: advice.kampo || "未登録",
    },

    // 実施回数（直近8日間）
    carelog: {
      habits: rawData.carelog.habits,
      breathing: rawData.carelog.breathing,
      stretch: rawData.carelog.stretch,
      tsubo: rawData.carelog.tsubo,
      kampo: rawData.carelog.kampo,
    },

    // Q1〜Q3（旧Q4）
    Q1: { symptom: rawData.symptom_level },
    Q2: {
      sleep: rawData.sleep,
      meal: rawData.meal,
      stress: rawData.stress,
    },
    Q3: { motion_level: rawData.motion_level },
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
