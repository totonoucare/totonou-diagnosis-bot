// followup/memoryManager.js

// ユーザーごとの情報を記憶（実運用時はDBに置き換え推奨）
const userMemory = {};

/**
 * 特定ユーザーの主訴・Mテスト結果を保存
 * @param {string} userId - LINEのuserId
 * @param {object} data - 保存するデータ（symptom, motion）
 */
function saveUserData(userId, data) {
  userMemory[userId] = {
    symptom: data.symptom || "",
    motion: data.motion || "",
    updatedAt: new Date()
  };
}

/**
 * ユーザーの保存済みデータを取得
 * @param {string} userId - LINEのuserId
 * @returns {object|null} - 記録があれば返す、なければnull
 */
function getUserData(userId) {
  return userMemory[userId] || null;
}

module.exports = {
  saveUserData,
  getUserData
};
