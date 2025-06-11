const progressDictionary = require("./progressDictionary");
const memoryManager = require("./memoryManager");

function generateResult({ userId, mainSymptom, motionTest, answers }) {
  const [q1, q2, q3, q4, q5, q6] = answers;

  // 🔍 1. 前回主訴の改善傾向コメント
  const progress = progressDictionary[q1] || "今回の変化に合わせて、次の仮説を立てていきましょう。";

  // 🧘‍♂️ 2. 実施セルフケアの評価
  const careComment = generateCareComment(q3, q4);

  // 🔄 3. 経絡動作テストの再チェック
  const motionFeedback = motionTest
    ? `前回「${motionTest}」で違和感を感じていたとのことですが、今回の体感はいかがでしたか？`
    : "今回も、違和感を感じやすい動作があれば教えてください。";

  // 🌱 4. 生活リズムの変化からの一言
  const lifeChange = generateLifeComment(q5);

  // 🔁 5. 今後の仮説（今は固定文、後ほどGPT連携）
  const hypothesis = "この1週間の変化をふまえて、次は「今の生活習慣」に焦点を当ててみましょう。";

  // 💾 記録更新
  memoryManager.updateUserMemory(userId, {
    lastCheckin: new Date().toISOString(),
    mainSymptom,
    motionTest,
    lastAnswers: answers
  });

  // 📦 結果返却
  return {
    progress,
    careComment,
    motionFeedback,
    lifeChange,
    hypothesis
  };
}

// 🧩 セルフケア実施に対するコメント生成
function generateCareComment(careArray, frequency) {
  const careLabels = {
    habit: "生活習慣の改善",
    stretch: "ストレッチ",
    breathing: "巡り改善呼吸法",
    kampo: "漢方薬の服用",
    original: "独自のセルフケア"
  };

  if (!Array.isArray(careArray) || careArray.length === 0) {
    return "今回はセルフケアの実践が少なかったようです。次回は1つだけでも試してみると変化が出やすくなります。";
  }

  const tried = careArray.map(key => careLabels[key] || key).join("・");
  const freqComment = {
    "毎日": "とても良い習慣が身についています！",
    "週2〜3": "無理なく続けられていて良いペースです。",
    "あまりしていない": "次回は1つに絞って取り組むのもおすすめです。"
  };

  return `今週は【${tried}】に取り組まれていましたね。\n${freqComment[frequency] || ""}`;
}

// 🌙 生活リズムに関するコメント
function generateLifeComment(answer) {
  if (!answer) return "";
  return `この1週間の生活の変化として「${answer}」が挙げられました。体調とのつながりを意識してみましょう。`;
}

module.exports = generateResult;
