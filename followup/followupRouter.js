const generateResult = require("./resultGenerator");
const questionSets = require("./questionSets");
const memoryManager = require("./memoryManager");

function handleFollowupAnswers(userId, answers) {
  // answers: [Q1, Q2, Q3, Q4, Q5, Q6]
  // Q1: 前回主訴に対する変化
  // Q2: 全体の体調変化
  // Q3: 実施したセルフケア内容（複数選択）
  // Q4: セルフケアの実施頻度
  // Q5: 睡眠/食事/ストレスなどの生活変化
  // Q6: 経絡テストの変化（前回動作に対して）

  const memory = memoryManager.getUserMemory(userId) || {};
  const { mainSymptom = "体の不調", motionTest = "どこかの動作" } = memory;

  const result = generateResult({
    userId,
    mainSymptom,
    motionTest,
    answers
  });

  return result;
}

module.exports = handleFollowupAnswers;
