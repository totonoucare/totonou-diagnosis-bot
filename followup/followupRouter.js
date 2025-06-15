// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const memoryManager = require("../supabaseMemoryManager");
const { sendFollowupPromptToGPT } = require("./responseSender");

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} userId - ユーザーID
 * @param {Array} answers - ユーザーの回答（Q1〜Q5）
 * @returns {Promise<Object>} - GPTコメント付きの再診結果
 */
async function handleFollowupAnswers(userId, answers) {
  // ✅ 初回診断の文脈だけ取得（contextだけでOK）
  const context = memoryManager.getContext(userId) || {};  // ←ここだけ変更でOK

  // GPTプロンプト含むデータ構成
  const result = generateFollowupResult(answers, context);

  // GPTでコメント生成
  const gptComment = await sendFollowupPromptToGPT(result.promptParts);

  return {
    ...result,
    gptComment,
  };
}

module.exports = handleFollowupAnswers;
