// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { sendFollowupResponse } = require("./responseSender"); // ✅ 関数名を統一

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} userId - ユーザーID（＝LINEのuserId）
 * @param {Array} answers - ユーザーの回答（Q1〜Q5）
 * @returns {Promise<Object|null>} - GPTコメント付きの再診結果 or null（未登録者）
 */
async function handleFollowupAnswers(userId, answers) {
  try {
    // 🔍 Supabaseから該当ユーザー情報を取得
    const user = await supabaseMemoryManager.getUser(userId);

    // ❌ サブスク登録されていない場合は再診不可
    if (!user || !user.subscribed) {
      console.log(`⛔️ ユーザー ${userId} はサブスク未登録のため再診不可`);
      return null;
    }

    // ✅ context（初回診断結果）を取得
    const context = await supabaseMemoryManager.getContext(userId);

    // 🎯 再診結果（回答5問＋前回データからプロンプト用partsを生成）
    const result = generateFollowupResult(answers, context);

    // ✅ 再診回答をSupabaseに保存（履歴形式）
    await supabaseMemoryManager.setFollowupAnswers(userId, answers);

    // 🤖 GPTコメント生成（東洋医学の専門家として返信）
    const { gptComment } = await sendFollowupResponse(userId, result.rawData);

    // 🧾 結果オブジェクトにコメントと状態を追加して返す
    return {
      ...result,
      gptComment,
      statusMessage,
    };
  } catch (err) {
    console.error("❌ 再診処理中にエラー:", err);
    return {
      error: "再診処理中にエラーが発生しました。",
      gptComment: "通信エラーにより解析に失敗しました。時間を置いてもう一度お試しください。",
      statusMessage: "",
    };
  }
}

module.exports = handleFollowupAnswers;
