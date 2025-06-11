const progressDictionary = require("./progressDictionary");
const memoryManager = require("./memoryManager");

function generateResult({ userId, mainSymptom, motionTest, answers }) {
  const [q1, q2, q3, q4, q5, q6] = answers;

  // 🔍 1. 前回主訴の改善傾向を記述
  const progress = progressDictionary[q1] || "変化に応じた仮説を立てていきましょう。";

  // 🧘‍♀️ 2. セルフケア評価
  const careComment = generateCareComment(q3, q4);

  // 🔄 3. 動作テストの再結果を反映
  const motionFeedback = motionTest
    ? `前回「${motionTest}」で違和感を感じていたとのことですが、今回の体感はいかがでしたか？`
    : "今回も気になる動作があれば教えてください。";

  // 🧭 4. 生活リズム変化の一言コメント
  const lifeChange = generateLifeComment(q5);

  // 🧠 5. 今後の検証方針（GPT連携用コメントも可能）
  const hypothesis = "この1週間の変化をふまえ、次は〇〇を重点的にケアしてみましょう。";

  // 🗂️ ユーザー記録を更新
  memoryManager.updateUserMemory(userId, {
    lastCheckin: new Date().toISOString(),
    mainSymptom,
    motionTest,
    lastAnswers: answers
  });

  // 🔚 結果として返すオブジェクト
  return {
    progress,
    careComment,
    motionFeedback,
    lifeChange,
    hypothesis
  };
}

// セルフケアの内容と頻度に応じたコメント生成
function generateCareComment(careArray, frequency) {
  const careLabels = {
    stretch: "ストレッチ",
    breathing: "深呼吸",
    chukan: "中脘呼吸",
    kampo: "漢方薬"
  };

  if (!Array.isArray(careArray) || careArray.length === 0) {
    return "今回の1週間はセルフケアの実践が少なかったようです。次週は無理のない範囲で試してみましょう。";
  }

  const tried = careArray.map(key => careLabels[key] || key).join("・");
  const freqComment = {
    "毎日": "非常に良い習慣づけができています！",
    "週2〜3": "無理なく続けられていて良い流れです。",
    "あまりしていない": "次は1つだけでも続けてみると変化が見えやすいですよ。"
  };

  return `今週は【${tried}】を実施されていたようですね。\n${freqComment[frequency] || ""}`;
}

// 生活変化に応じたコメント（シンプル化）
function generateLifeComment(answer) {
  if (!answer) return "";
  return `この1週間の生活変化として【${answer}】が挙げられました。体調との関係を意識してみましょう。`;
}

module.exports = generateResult;
