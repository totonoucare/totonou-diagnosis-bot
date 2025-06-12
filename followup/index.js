// followup/index.js

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const memoryManager = require('../memoryManager');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

// ユーザーの進行状態を記録
const userSession = {}; // userSession[userId] = { step: 1, answers: [] }

// ✅ symptom / motion を埋め込むプレースホルダー置換関数
function replacePlaceholders(text, context) {
  return text
    .replace(/{{symptom}}/g, context?.symptom || '不明な主訴')
    .replace(/{{motion}}/g, context?.motion || '不明な動作');
}

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

    // ✅ セッション開始トリガー
    if (message === 'ととのう計画') {
      userSession[userId] = { step: 1, answers: [] };

      const q1 = questionSets[0];
      return [buildFlexMessage(q1, memoryManager.getContext(userId))];
    }

    // ✅ セッションが存在しない
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

    // ✅ Q3：複数選択肢をまとめて処理
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

      if (Object.keys(session.partialAnswers).length < question.subQuestions.length) {
        return []; // 続く選択を待機
      }

      session.answers.push({ ...session.partialAnswers });
      delete session.partialAnswers;
      session.step++;

    } else {
      // ✅ 通常の単一回答処理
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

    // ✅ 全質問完了 → GPT処理
    if (session.step > questionSets.length) {
      const answers = session.answers;
      const context = memoryManager.getContext(userId) || {};
      console.log("📤 フォローアップ用 context:", context);

      if (!context.symptom || !context.typeName) {
        console.warn("⚠️ context 情報が不完全。symptom/typeNameが未定義です");
      }

      const result = await handleFollowupAnswers(userId, answers);
      console.log("💬 GPTコメント:", result.gptComment);

      delete userSession[userId];

      return [{
        type: 'text',
        text: '📋【今回の再診結果】\n' + result.gptComment
      }];
    }

    // ✅ 次の質問へ
    const nextQuestion = questionSets[session.step - 1];
    return [buildFlexMessage(nextQuestion, memoryManager.getContext(userId))];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「ととのう計画」と送って再開してください。'
    }];
  }
}

// Q1〜Q5の形式に応じてFlexを出し分け（プレースホルダー処理あり）
function buildFlexMessage(question, context = {}) {
  if (question.isMulti && question.subQuestions) {
    const replacedSubs = question.subQuestions.map(q => ({
      ...q,
      body: replacePlaceholders(q.body, context),
    }));

    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      questions: replacedSubs
    });
  }

  return MessageBuilder({
    altText: replacePlaceholders(question.header, context),
    header: replacePlaceholders(question.header, context),
    body: replacePlaceholders(question.body, context),
    buttons: question.options.map(opt => ({
      label: opt,
      data: opt.includes(':') ? opt : opt.charAt(0),
      displayText: opt
    }))
  });
}

module.exports = Object.assign(handleFollowup, {
  hasSession: (userId) => !!userSession[userId]
});
