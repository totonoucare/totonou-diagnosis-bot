function generateFollowupResult(answers, context = {}) {
  const [q1, q2, q3, q4, q5] = answers;

  // セルフケア実施内容（q3）は、各項目に対して A〜D を返してくる前提
  // context.symptom や context.motion は memoryManager.js から取得されると想定

  const rawData = {
    symptomChange: q1,        // Q1：主訴の変化
    overallCondition: q2,     // Q2：全体の体調
    careDetails: q3,          // Q3：セルフケア各項目と頻度
    motionTestChange: q4,     // Q4：前回動作テストの変化
    lifestyleChange: q5       // Q5：生活習慣の変化
  };

  // GPTに送るプロンプト（仮）：改善 or 悪化傾向とセルフケアの相関性を考察して再提案
  const promptForGPT = `
あなたは東洋医学・セルフケアの専門家です。
以下の情報をもとに、患者の改善傾向と現在のセルフケアの関連を考察し、
必要であれば別の視点から新たな仮説とセルフケア提案をしてください。

【前回主訴】${context.symptom || "未登録"}
【主訴の変化】${q1}
【体調全体】${q2}
【セルフケア実施内容】
- 習慣改善：${q3.habits || "未回答"}
- ストレッチ：${q3.stretch || "未回答"}
- 呼吸法：${q3.breathing || "未回答"}
- 漢方薬：${q3.kampo || "未回答"}
- その他：${q3.other || "未回答"}
【前回の動作テスト】${context.motion || "未登録"}
【動作変化】${q4}
【生活習慣の変化】${q5}

この内容から、今後1週間で見直すべきポイントや継続すべき点をシンプルに教えてください。
`;

  return {
    summary: "再診結果を受けて、仮説の再構築を行います。",
    rawData,
    promptForGPT
  };
}

module.exports = generateFollowupResult;
