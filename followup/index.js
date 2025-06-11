// followup/index.js

const handleFollowupAnswers = require("./followupRouter");
const memoryManager = require("./memoryManager");

async function handleFollowup(event, client, userId) {
  try {
    const message = event.message.text;

    const userMemory = memoryManager.getUserMemory(userId) || {};
    const answers = message.split(",").map(a => a.trim().toUpperCase());

    if (answers.length !== 5) {
      return [{
        type: "text",
        text: "5つの回答をカンマ区切りで送信してください（例：A,B,C,D,E）"
      }];
    }

    const result = await handleFollowupAnswers(userId, answers);

    return [
      {
        type: "text",
        text: "📋【今回の再診結果】\n" + result.gptComment
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
