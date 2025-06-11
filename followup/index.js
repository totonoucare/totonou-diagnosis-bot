const followupRouter = require('./followupRouter');

async function handleFollowup(event, client, userId, userMemory) {
  try {
    // ユーザーのメッセージ内容を取得
    const message = event.message.text;

    // Routerに渡して次の質問や診断結果を取得
    const reply = await followupRouter(message, userId, userMemory);

    // 応答内容（Flexまたはテキスト）を返す
    return reply;
  } catch (error) {
    console.error("❌ followup/index.js エラー:", error);
    return [{
      type: "text",
      text: "エラーが発生しました。もう一度お試しください。"
    }];
  }
}

module.exports = handleFollowup;
