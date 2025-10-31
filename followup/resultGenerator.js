/**
 * フォローアップ診断（ととのい度チェック）
 * Q1〜Q3（Q3＝動作テスト）＋carelog記録＋context.adviceを統合して
 * GPTに送るための rawData / promptParts を構成する。
 *
 * @param {Object} answers - 今回のととのい度チェック回答
 * @param {Object} context - Supabaseに保存された体質ケア分析結果＆アドバイス
 * @param {Object} carelogSummary - 直近のcarelog実施日数（{ habits, breathing, stretch, tsubo, kampo }）
 * @returns {{ rawData: Object, promptParts: Object }}
 */
function generateFollowupResult(answers, context = {}, carelogSummary = {}) {
  // ✅ Q1〜Q3（体調スコア）を正規化して rawData にまとめる
  const rawData = {
    symptom_level: parseInt(answers.symptom) || null,
    sleep: parseInt(answers.sleep) || null,
    meal: parseInt(answers.meal) || null,
    stress: parseInt(answers.stress) || null,
    motion_level: parseInt(answers.motion_level) || null,

    // 🔹 実施日数を確実に整数化（undefined対策に ?? でフォールバック）
    carelog: {
      habits: carelogSummary.habits ?? 0,
      breathing: carelogSummary.breathing ?? 0,
      stretch: carelogSummary.stretch ?? 0,
      tsubo: carelogSummary.tsubo ?? 0,
      kampo: carelogSummary.kampo ?? 0,
    },

    // 🔹 利用開始日
    start_date: context.created_at || null,
  };

  // ✅ context.advice が配列またはオブジェクト両対応
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

  // ✅ GPTに渡すためのプロンプト構成（motionを直接使用）
  const promptParts = {
    type: context.type || "未登録",
    trait: context.trait || "未登録",
    flowType: context.flowType || "未登録",
    organType: context.organType || "未登録",
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録", // ← 修正: motionInfo削除、直接参照

    advice: {
      habits: advice.habits || "未登録",
      breathing: advice.breathing || "未登録",
      stretch: advice.stretch || "未登録",
      tsubo: advice.tsubo || "未登録",
      kampo: advice.kampo || "未登録",
    },

    carelog: { ...rawData.carelog },
    Q1: { symptom: rawData.symptom_level },
    Q2: { sleep: rawData.sleep, meal: rawData.meal, stress: rawData.stress },
    Q3: { motion_level: rawData.motion_level },
    start_date: rawData.start_date,
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
