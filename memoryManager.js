// ユーザーごとの診断・再診情報（本番ではDB推奨）
const userMemory = {};

/**
 * 再診用データを初期化（Q1から開始）
 */
function initializeFollowup(userId) {
  userMemory[userId] = {
    step: 0,
    answers: [],
    context: {}, // 初回診断情報などを格納
    updatedAt: new Date()
  };
}

/**
 * 現在のユーザーデータ（再診含む）を取得
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
 * 初回診断データなどの文脈情報を保存（主訴や体質タイプなど）
 * 例：{ symptom: "肩こり", typeName: "気虚タイプ", traits: "...", ... }
 */
function setInitialContext(userId, contextObj) {
  if (!userMemory[userId]) initializeFollowup(userId);
  userMemory[userId].context = {
    ...userMemory[userId].context,
    ...contextObj
  };
  userMemory[userId].updatedAt = new Date();
}

/**
 * 現在の文脈情報（初回診断の記録）だけ取得
 */
function getContext(userId) {
  return userMemory[userId]?.context || {};
}

/**
 * 再診データと診断文脈を全削除（リセット時）
 */
function clearFollowup(userId) {
  delete userMemory[userId];
}

module.exports = {
  initializeFollowup,
  getUserMemory,
  getContext,
  recordAnswer,
  setInitialContext,
  clearFollowup
};
