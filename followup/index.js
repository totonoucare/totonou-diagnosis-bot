// followup/index.js

const questions = require("./questionSets"); // Q1〜Q5を含む配列
const handleFollowupAnswers = require("./followupRouter");
const memory = require("./memoryManager");

/**
 * 再診用の診断フローを管理する関数（B案：1問ずつ進行）
 */
async function handleFollowup(event, client, userId) {
  try {
    const message = event.message.text.trim().toUpperCase();
    let session = memory.getFollowupMemory(userId);

    // ① 最初の起動メッセージだった場合（「ととのう計画」など）
    if (!session) {
      memory.initializeFollowup(userId);
      return [buildQuestionMessage(0)];
    }

    // ② A〜Eの回答かどうかチェック（不正な場合はやり直し）
    if (!["A", "B", "C", "D", "E"].includes(message)) {
      return [{
        type: "text",
        text: "A〜Eの中から1つ選んで返信してください。"
      }];
    }

    // ③ 回答を記録し、次のステップへ
    memory.recordAnswer(userId, message);
    session = memory.getFollowupMemory(userId); // 更新後を再取得

    // ④ 全5問が終わったら診断ロジックへ
    if (session.step === 5) {
      const result = await handleFollowupAnswers(userId, session.answers);
      memory.clearFollowup(userId);

      return [{
        type: "text",
        text: "📋【今回の再診結果】\n" + result.gptComment
      }];
    }

    // ⑤ 次の質問を表示
    return [buildQuestionMessage(session.step)];

  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return [{
      type: "text",
      text: "診断処理中にエラーが発生しました。しばらくしてからもう一度お試しください。"
    }];
  }
}

/**
 * 指定ステップのFlex質問を構築
 */
function buildQuestionMessage(step) {
  const question = questions[step];
  return {
    type: "flex",
    altText: `【Q${step + 1}】${question.header}`,
    contents: question.flex
  };
}

module.exports = handleFollowup;
