// ユーザーごとの再診情報（本番ではDB推奨）
const userMemory = {};

/**
 * 再診用データを初期化（Q1から開始）
 */
function initializeFollowup(userId) {
  userMemory[userId] = {
    step: 0,
    answers: [],
    updatedAt: new Date()
  };
}

/**
 * 現在の再診データを取得
 */
function getUserMemory(userId) {
  return userMemory[userId] || null;
}

/**
 * 回答を追加し、次のステップに進める
 */
function recordAnswer(userId, answer) {
  if (!userMemory[userId]) initializeFollowup(userId);
  userMemory[userId].answers.push(answer);
  userMemory[userId].step += 1;
  userMemory[userId].updatedAt = new Date();
}

/**
 * 再診データを全消去（使い終わったら呼ぶ）
 */
function clearFollowup(userId) {
  delete userMemory[userId];
}

module.exports = {
  initializeFollowup,
  getUserMemory,
  recordAnswer,
  clearFollowup
};
