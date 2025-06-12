// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const memoryManager = require("../memoryManager");
const sendFollowupPromptToGPT = require("./responseSender");

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} userId - ユーザーID
 * @param {Array} answers - ユーザーの回答（Q1〜Q5）
 * @returns {Promise<Object>} - GPTコメント付きの再診結果
 */
async function handleFollowupAnswers(userId, answers) {
  // ユーザーごとの前回の主訴・動作テスト記憶を取得
  const memory = memoryManager.getUserMemory(userId) || {};
  const context = {
    symptom: memory.symptom || "体の不調",
    motion: memory.motion || "特定の動作",
  };

  // GPTプロンプト含むデータ構成
  const result = generateFollowupResult(answers, context);

  // GPTでコメント生成
  const gptComment = await sendFollowupPromptToGPT(result.promptForGPT);

  // 結果にGPTコメントを添付
  return {
    ...result,
    gptComment,
  };
}

module.exports = handleFollowupAnswers;
