// followup/index.js

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const memoryManager = require('../supabaseMemoryManager');
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

// ユーザーの進行状態を記録
const userSession = {}; // userSession[userId] = { step: 1, answers: [] }

// 置換関数：質問テンプレート内の{{symptom}}や{{motion}}を日本語に置き換える
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

    // ✅ セッション開始トリガー
    if (message === 'ケア状況分析&見直し') {
      userSession[userId] = { step: 1, answers: [] };

      const q1 = questionSets[0];
      const context = memoryManager.getContext(userId) || {};
      return [buildFlexMessage(q1, context)];
    }

    // ✅ セッションが存在しない
    if (!userSession[userId]) {
      return [{
        type: 'text',
        text: '再診を始めるには「ケア状況分析&見直し」と送ってください。'
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

    const nextQuestion = questionSets[session.step - 1];
    const context = memoryManager.getContext(userId) || {};
    return [buildFlexMessage(nextQuestion, context)];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「ととのう計画」と送って再開してください。'
    }];
  }
}

// Q1〜Q5の形式に応じてFlexを出し分け（contextを引数に追加）
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
   body: replacePlaceholders(question.body, context), // ←これを追加！
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
