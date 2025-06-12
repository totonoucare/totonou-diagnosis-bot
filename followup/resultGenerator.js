function generateFollowupResult(answers, context = {}) {
  const [q1, q2, q3, q4, q5] = answers;

  const rawData = {
    symptomChange: q1,
    overallCondition: q2,
    careDetails: q3,
    motionTestChange: q4,
    lifestyleChange: q5
  };

  const promptParts = {
    symptom: context.symptom || "未登録",
    motion: context.motion || "未登録",

    typeName: context.typeName || "未登録",
    traits: context.traits || "未登録",
    flowIssue: context.flowIssue || "未登録",
    organBurden: context.organBurden || "未登録",
    planAdvice: context.advice || "（前回アドバイス未登録）",
    link: context.link || "（未登録）",

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
