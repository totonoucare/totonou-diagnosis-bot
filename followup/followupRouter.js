// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { sendFollowupResponse } = require("./responseSender"); // ✅ 関数名を統一

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} userId - ユーザーID（＝LINEのuserId）
 * @param {Array|string|object} answers - ユーザーの回答（形式に応じて処理分岐）
 * @returns {Promise<Object|null>} - GPTコメント付きの再診結果 or null（未登録者）
 */
async function handleFollowupAnswers(userId, answers) {
  try {
    // 🔍 Supabaseから該当ユーザー情報を取得
    const user = await supabaseMemoryManager.getUser(userId);

    if (!user || !user.subscribed) {
      console.log(`⛔️ ユーザー ${userId} はサブスク未登録のため再診不可`);
      return null;
    }

    // ✅ context（初回診断結果）を取得
    const context = await supabaseMemoryManager.getContext(userId);

    // 🧩 answers の形式チェック
    let parsedAnswers = {};

    if (Array.isArray(answers)) {
      // 例: ["motion_level=3", "q5_answer=B"]
      for (const ans of answers) {
        const [key, value] = ans.split("=");
        if (key && value !== undefined) {
          parsedAnswers[key] = value;
        }
      }
    } else if (typeof answers === 'object' && answers !== null) {
      // すでに { motion_level: "3", q5_answer: "B" } の形式
      parsedAnswers = answers;
    } else {
      throw new Error("answers形式が不正です");
    }

    // 🎯 再診結果の生成
    const result = generateFollowupResult(parsedAnswers, context);

    // 💾 Supabaseへ保存
    await supabaseMemoryManager.setFollowupAnswers(userId, parsedAnswers);

    // 🤖 GPTコメント生成
    const { gptComment, statusMessage } = await sendFollowupResponse(userId, result.rawData);

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
