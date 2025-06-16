// followup/index.js
const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

// 主訴と動作の日本語変換マップ
const symptomLabels = {
  stomach: '胃腸の調子',
  sleep: '睡眠改善・集中力',
  pain: '肩こり・腰痛・関節',
  mental: 'イライラや不安感',
  cold: '体温バランス・むくみ',
  skin: '頭髪や肌の健康',
  pollen: '花粉症・鼻炎',
  women: '女性特有のお悩み',
  unknown: 'なんとなく不調・不定愁訴',
};

const motionLabels = {
  A: '首を後ろに倒すor左右に回す',
  B: '腕をバンザイする',
  C: '前屈する',
  D: '腰を左右にねじるor側屈',
  E: '上体をそらす',
};

const userSession = {}; // userSession[userId] = { step: 1, answers: [] }

function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== 'string') return '';
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || '不明な主訴')
    .replace(/\{\{motion\}\}/g, motionLabels[context.motion] || '特定の動作');
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

    // ✅ 「サブスク希望」で subscribed: true に登録
    if (message === 'サブスク希望') {
      try {
        await supabaseMemoryManager.markSubscribed(userId);
        return [{
          type: 'text',
          text: '✅ サブスク登録が完了しました！\n再診を始めるには「ケア状況分析＆見直し」と送ってください。'
        }];
      } catch (err) {
        console.error('❌ サブスク登録エラー:', err);
        return [{
          type: 'text',
          text: 'サブスク登録中にエラーが発生しました。もう一度お試しください。'
        }];
      }
    }

    // ✅ セッション開始トリガー（subscribed限定）
    if (message === 'ケア状況分析&見直し') {
      const userRecord = await supabaseMemoryManager.getUser(userId);
      if (!userRecord || !userRecord.subscribed) {
        return [{
          type: 'text',
          text: 'この機能は「サブスク希望」を送信いただいた方のみご利用いただけます。'
        }];
      }

      userSession[userId] = { step: 1, answers: [] };
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(userId);
      return [buildFlexMessage(q1, context)];
    }

    // ✅ セッションがない場合のリジェクト
    if (!userSession[userId]) {
      return [{
        type: 'text',
        text: '再診を始めるには「ケア状況分析＆見直し」と送ってください。'
      }];
    }

    const session = userSession[userId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // ✅ Q3の複数選択処理
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
        return []; // 続きの回答を待機
      }

      session.answers.push({ ...session.partialAnswers });
      delete session.partialAnswers;
      session.step++;

    } else {
      // ✅ 単一選択処理
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

    // ✅ 終了判定：全質問終了後に再診結果出力
    if (session.step > questionSets.length) {
      const answers = session.answers;
      const context = await supabaseMemoryManager.getContext(userId);

      if (!context?.symptom || !context?.type) {
        console.warn("⚠️ context 情報が不完全です");
      }

      const result = await handleFollowupAnswers(userId, answers);
      delete userSession[userId];

      return [{
        type: 'text',
        text: '📋【今回の再診結果】\n' + result.gptComment
      }];
    }

    // ✅ 次の質問へ
    const nextQuestion = questionSets[session.step - 1];
    const context = await supabaseMemoryManager.getContext(userId);
    return [buildFlexMessage(nextQuestion, context)];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「ケア状況分析＆見直し」と送って再開してください。'
    }];
  }
}

function buildFlexMessage(question, context = {}) {
  if (question.isMulti && question.subQuestions) {
    const updatedSubs = question.subQuestions.map(sub => ({
      ...sub,
      header: replacePlaceholders(sub.header, context),
      body: replacePlaceholders(sub.body, context)
    }));
    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      body: replacePlaceholders(question.body, context),
      questions: updatedSubs
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
