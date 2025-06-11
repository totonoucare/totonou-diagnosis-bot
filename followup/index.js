// followup/index.js

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const memoryManager = require('./memoryManager');
const sendGPTResponse = require('./responseSender');
const { MessageBuilder } = require('../utils/flexBuilder');

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

    // 回答の検証（A〜E）
    const answer = message.charAt(0).toUpperCase();
    const isValid = question.options.some(opt => opt.startsWith(answer));

    if (!isValid) {
      return [{
        type: 'text',
        text: 'A〜Eの中からボタンで選んでください。'
      }];
    }

    // 回答記録（Q3が特殊形式のときだけ拡張）
    if (question.id === 'Q3') {
      session.answers.push({
        habits: answer,
        stretch: answer,
        breathing: answer,
        kampo: answer,
        other: answer
      });
    } else {
      session.answers.push(answer);
    }

    session.step++;

    // 質問終了 → 診断結果生成
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

    // 次の質問を出力
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

// Flexメッセージを生成（共通部品利用）
function buildFlexMessage(question) {
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

module.exports = handleFollowup;
