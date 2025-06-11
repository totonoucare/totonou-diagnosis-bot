// followup/index.js

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const memoryManager = require('./memoryManager');
const sendGPTResponse = require('./responseSender');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

// ユーザーの進行状態を記録
const userSession = {}; // userSession[userId] = { step: 1, answers: [] }

async function handleFollowup(event, client, userId) {
  try {
    let message = "";

    if (event.type === 'message' && event.message.type === 'text') {
      message = event.message.text.trim();
    } else if (event.type === 'postback' && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return [{
        type: 'text',
        text: '形式が不正です。A〜Eのボタンで回答してください。'
      }];
    }

    // セッション開始トリガー
    if (message === 'ととのう計画') {
      userSession[userId] = { step: 1, answers: [] };

      const q1 = questionSets[0];
      return [buildFlexMessage(q1)];
    }

    // セッションが存在しない
    if (!userSession[userId]) {
      return [{
        type: 'text',
        text: '再診を始めるには「ととのう計画」と送ってください。'
      }];
    }

    const session = userSession[userId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    console.log("📍 現在のステップ:", session.step);
    console.log("📝 現在の質問 ID:", question?.id);
    console.log("📝 options:", question?.options);

    // Q3の特別処理：複数選択肢の回答をまとめて記録
    if (question.id === 'Q3' && question.isMulti && message.includes(':')) {
      const parts = message.split(':');
      if (parts.length !== 2) {
        return [{ type: 'text', text: '回答形式に誤りがあります。ボタンを使ってください。' }];
      }

      const [key, answer] = parts;
      if (!['A', 'B', 'C', 'D'].includes(answer)) {
        return [{ type: 'text', text: 'A〜Dのボタンで選んでください。' }];
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[key] = answer;

      // すべての subQuestions に回答済みかチェック
      if (Object.keys(session.partialAnswers).length < question.subQuestions.length) {
        return []; // 次のボタン回答を待つ（何も返さない）
      }

      session.answers.push({ ...session.partialAnswers });
      delete session.partialAnswers;
      session.step++;

    } else {
      // 通常の質問に対する処理
      const answer = message.charAt(0).toUpperCase();
      const isValid = question.options.some(opt => opt.startsWith(answer));

      if (!isValid) {
        return [{
          type: 'text',
          text: 'A〜Eの中からボタンで選んでください。'
        }];
      }

      session.answers.push(answer);
      session.step++;
    }

    // 全質問完了 → GPT連携
    if (session.step > questionSets.length) {
      const answers = session.answers;
      const memory = memoryManager.getUserMemory(userId) || {};

      const context = {
        symptom: memory.symptom || '体の不調',
        motion: memory.motion || '特定の動作'
      };

      const result = await handleFollowupAnswers(userId, answers);
      const gptReply = await sendGPTResponse(result.promptForGPT);

      delete userSession[userId];

      return [{
        type: 'text',
        text: '📋【今回の再診結果】\n' + gptReply
      }];
    }

    const nextQuestion = questionSets[session.step - 1];
    return [buildFlexMessage(nextQuestion)];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「ととのう計画」と送って再開してください。'
    }];
  }
}

// Q1〜Q5の形式に応じてFlexを出し分け
function buildFlexMessage(question) {
  if (question.isMulti && question.subQuestions) {
    return buildMultiQuestionFlex({
      altText: question.header,
      header: question.header,
      questions: question.subQuestions
    });
  }

  return MessageBuilder({
    altText: question.header,
    header: question.header,
    body: question.body,
    buttons: question.options.map(opt => ({
      label: opt,
      data: opt.charAt(0),
      displayText: opt
    }))
  });
}

module.exports = Object.assign(handleFollowup, {
  hasSession: (userId) => !!userSession[userId]
});
