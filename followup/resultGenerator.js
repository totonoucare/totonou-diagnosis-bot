function generateFollowupResult(answers, context = {}) {
  const [q1, q2, q3, q4, q5] = answers;

  const rawData = {
    symptomChange: q1,        // Q1：主訴の変化
    overallCondition: q2,     // Q2：全体の体調
    careDetails: q3,          // Q3：セルフケア実施内容（各項目）
    motionTestChange: q4,     // Q4：動作テストの変化
    lifestyleChange: q5       // Q5：生活習慣の変化
  };

  const promptParts = {
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",
    typeName: context.typeName || "未登録",
    planAdvice: context.planAdvice || "（前回のアドバイス未登録）",
    symptomChange: q1,
    overall: q2,
    habits: q3.habits || "未実施",
    stretch: q3.stretch || "未実施",
    breathing: q3.breathing || "未実施",
    kampo: q3.kampo || "未使用",
    otherCare: q3.other || "なし",
    motionChange: q4,
    lifestyle: q5
  };

  return { rawData, promptParts };
}

module.exports = generateFollowupResult;
