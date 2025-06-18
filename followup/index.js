// followup/index.js（完全上書き）
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

const userSession = {};

function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== 'string') return '';
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || '不明な主訴')
    .replace(/\{\{motion\}\}/g, context.motion || '特定の動作');
}

async function handleFollowup(event, client, userId) {
  try {
    let message = "";

    if (event.type === 'message' && event.message.type === 'text') {
      message = event.message.text.trim();
    } else if (event.type === 'postback' && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return [{ type: 'text', text: '形式が不正です。A〜Eのボタンで回答してください。' }];
    }

    // ✅ セッション開始
    if (message === '定期チェック診断') {
      const userRecord = await supabaseMemoryManager.getUser(userId);
      if (!userRecord?.subscribed) {
        return [{ type: 'text', text: 'この機能は「サブスク希望」を送信いただいた方のみご利用いただけます。' }];
      }

      userSession[userId] = { step: 1, answers: [] };
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(userId);
      return [buildFlexMessage(q1, context)];
    }

    if (!userSession[userId]) {
      return [{ type: 'text', text: '再診を始めるには「定期チェック診断」と送ってください。' }];
    }

    const session = userSession[userId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // Q3: 複数回答処理
    if (question.id === 'Q3' && question.isMulti && message.includes(':')) {
      const [key, answer] = message.split(':');
      if (!['A', 'B', 'C', 'D'].includes(answer)) {
        return [{ type: 'text', text: 'A〜Dの中からボタンを選んでください。' }];
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[key] = answer;

      if (Object.keys(session.partialAnswers).length < question.subQuestions.length) {
        return []; // 全部揃うまで返さない（応答抑制）
      }

      session.answers.push({ ...session.partialAnswers });
      delete session.partialAnswers;
      session.step++;
    } else {
      // 単一選択処理
      const answer = message.charAt(0).toUpperCase();
      const isValid = question.options.some(opt => opt.startsWith(answer));

      if (!isValid) {
        return [{ type: 'text', text: 'A〜Eのボタンで回答してください。' }];
      }

      session.answers.push(answer);
      session.step++;
    }

    // 質問終了後
    if (session.step > questionSets.length) {
      const context = await supabaseMemoryManager.getContext(userId);
      const result = await handleFollowupAnswers(userId, session.answers);
      delete userSession[userId];

      return [{
        type: 'text',
        text: `📋【今回の定期チェック診断結果】\n${result.gptComment}`
      }];
    }

    // 次の質問へ
    const nextQ = questionSets[session.step - 1];
    const context = await supabaseMemoryManager.getContext(userId);
    return [buildFlexMessage(nextQ, context)];
  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{ type: 'text', text: '診断中にエラーが発生しました。再度お試しください。' }];
  }
}

function buildFlexMessage(question, context = {}) {
  if (question.isMulti && question.subQuestions) {
    const updated = question.subQuestions.map(sub => ({
      ...sub,
      header: replacePlaceholders(sub.header, context),
      body: replacePlaceholders(sub.body, context),
    }));

    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      body: replacePlaceholders(question.body, context),
      questions: updated
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
