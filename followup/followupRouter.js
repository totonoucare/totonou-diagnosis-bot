// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const memoryManager = require("../supabaseMemoryManager");
const { sendFollowupPromptToGPT } = require("./responseSender");

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} userId - ユーザーID（＝LINEのuserId）
 * @param {Array} answers - ユーザーの回答（Q1〜Q5）
 * @returns {Promise<Object>} - GPTコメント付きの再診結果 or null（未登録者）
 */
async function handleFollowupAnswers(userId, answers) {
  // 🔍 Supabaseから該当ユーザー情報を取得
  const user = await memoryManager.getUser(userId);

  // ❌ サブスク登録されていない場合は再診不可
  if (!user || !user.subscribed) {
    console.log(`⛔️ ユーザー ${userId} はサブスク未登録のため再診不可`);
    return null;
  }

  // ✅ context（初回診断結果）だけ取得
  const context = user.context || {};

  // GPTプロンプト含む再診結果生成
  const result = generateFollowupResult(answers, context);

  // GPTコメント生成
  const gptComment = await sendFollowupPromptToGPT(result.promptParts);

  return {
    ...result,
    gptComment,
  };
}

module.exports = handleFollowupAnswers;
