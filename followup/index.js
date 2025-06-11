// followup/index.js

const handleFollowupAnswers = require("./followupRouter");
const memoryManager = require("./memoryManager");
const questionSets = require("./questionSets");
const { MessageBuilder } = require("../utils/flexBuilder");

const followupSessions = {}; // ユーザーごとの一時セッション保存

async function handleFollowup(event, client, userId) {
  try {
    const message = event.message.text?.trim();

    // 診断スタート合図：「ととのう計画」
    if (message === "ととのう計画") {
      followupSessions[userId] = { step: 0, answers: [] };

      const q = questionSets[0];
      const flex = MessageBuilder({
        altText: q.header,
        header: q.header,
        body: q.body,
        buttons: q.options.map(opt => ({
          label: opt,
          data: `followup|Q1|${opt[0]}`, // e.g., followup|Q1|A
        })),
      });

      await client.replyMessage(event.replyToken, flex);
      return;
    }

    // 回答がFlexの postback の場合（テキスト形式にも対応）
    if (message.startsWith("followup|")) {
      const [_, questionId, answerCode] = message.split("|");
      const session = followupSessions[userId];

      if (!session) {
        return [{
          type: "text",
          text: "先に「ととのう計画」と送って診断を開始してください。"
        }];
      }

      session.answers.push(answerCode);
      session.step++;

      if (session.step >= questionSets.length) {
        // 全問完了 → 回答処理へ
        const result = await handleFollowupAnswers(userId, session.answers);

        delete followupSessions[userId];

        return [{
          type: "text",
          text: "📋【今回の再診結果】\n" + result.gptComment
        }];
      }

      // 次の質問を表示
      const nextQ = questionSets[session.step];
      const flex = MessageBuilder({
        altText: nextQ.header,
        header: nextQ.header,
        body: nextQ.body,
        buttons: nextQ.options.map(opt => ({
          label: opt,
          data: `followup|${nextQ.id}|${opt[0]}`
        })),
      });

      await client.replyMessage(event.replyToken, flex);
      return;
    }

    // フォーマットエラー対応
    return [{
      type: "text",
      text: "「ととのう計画」と送信して診断を始めましょう。"
    }];
  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return [{
      type: "text",
      text: "診断処理中にエラーが発生しました。しばらくしてからもう一度お試しください。"
    }];
  }
}

module.exports = handleFollowup;
