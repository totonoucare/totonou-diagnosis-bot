// followup/index.js

const handleFollowupAnswers = require("./followupRouter");
const memoryManager = require("./memoryManager");
const sendGPTResponse = require("./responseSender");

async function handleFollowup(event, client, userId) {
  try {
    const message = event.message.text;

    // ユーザーのメモリー（主訴や前回動作）を取得
    const userMemory = memoryManager.getUserMemory(userId) || {};

    // メッセージ内容から5問の回答配列を取得（仮：カンマ区切り "A,B,C,D,E"）
    const answers = message.split(",").map(a => a.trim().toUpperCase());

    if (answers.length !== 5) {
      return [{
        type: "text",
        text: "5つの回答をカンマ区切りで送信してください（例：A,B,C,D,E）"
      }];
    }

    // 回答と文脈から診断構造を生成
    const result = await handleFollowupAnswers(userId, answers);

    // GPTで返答メッセージを作成
    const gptReply = await sendGPTResponse(result.promptForGPT);

    // GPTのコメントを含んだ返信をLINEメッセージ形式で返す
    return [
      {
        type: "text",
        text: "📋【今回の再診結果】\n" + gptReply
      }
    ];
  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return [{
      type: "text",
      text: "診断処理中にエラーが発生しました。しばらくしてからもう一度お試しください。"
    }];
  }
}

module.exports = handleFollowup;
