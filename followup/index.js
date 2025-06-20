// followup/index.js
const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

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

const q3Labels = {
  habits: "体質改善の習慣（温活・食事・睡眠など）",
  breathing: "巡りととのえ呼吸法",
  stretch: "内臓ととのえストレッチ",
  tsubo: "ツボケア（指圧・お灸）",
  kampo: "漢方薬の服用"
};

const userSession = {}; // userSession[userId] = { step, answers }

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

    // ✅ セッション開始
    if (message === '定期チェック診断') {
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

    // ✅ セッション未開始
    if (!userSession[userId]) {
      return [{
        type: 'text',
        text: '再診を始めるには「定期チェック診断」と送ってください。'
      }];
    }

    const session = userSession[userId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // ✅ 複数選択（Q1〜Q3）
    if (question.isMulti) {
      const answerIndex = message.charAt(0).toUpperCase();
      const validOptions = ['A', 'B', 'C', 'D', 'E'];
      if (!validOptions.includes(answerIndex)) {
        return [{ type: 'text', text: 'A〜Eの中からボタンで選んでください。' }];
      }

      const targetSub = question.options.find((sub, i) => {
        return !session.partialAnswers || !(sub.id in session.partialAnswers);
      });

      if (!targetSub) {
        return [{ type: 'text', text: 'すでにすべて回答済みです。次に進みます。' }];
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[targetSub.id] = answerIndex;

      const remaining = question.options.filter(opt => !(opt.id in session.partialAnswers));
      if (remaining.length > 0) {
        const remainingLabels = remaining.map(k => q3Labels[k.id] || k.label).join('・');
        return [{
          type: 'text',
          text: `✅ 回答ありがとうございます。\n残りの項目：${remainingLabels} をご回答ください。`
        }];
      }

      session.answers.push({ ...session.partialAnswers });
      delete session.partialAnswers;
      session.step++;

    } else {
      // ✅ 単一選択
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

    // ✅ 終了処理
    if (session.step > questionSets.length) {
      const answers = session.answers;
      const context = await supabaseMemoryManager.getContext(userId);

      // 🔥📝 ここで再診内容を保存！（追加した処理）
      await supabaseMemoryManager.saveFollowup(userId, answers);

      await client.pushMessage(userId, {
        type: 'text',
        text: '🧠 お体の変化をAIが解析中です...\nちょっとだけお待ちくださいね。',
      });

      const result = await handleFollowupAnswers(userId, answers);
      delete userSession[userId];

      return [{
        type: 'text',
        text: '📋【今回の定期チェック診断結果】\n' + result.gptComment
      }];
    }

    // ✅ 次の質問
    const nextQuestion = questionSets[session.step - 1];
    const context = await supabaseMemoryManager.getContext(userId);
    return [buildFlexMessage(nextQuestion, context)];

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「定期チェック診断」と送って再開してください。'
    }];
  }
}

function buildFlexMessage(question, context = {}) {
  if (question.isMulti) {
    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      body: replacePlaceholders(question.body, context),
      questions: question.options.map(opt => ({
        key: opt.id,
        title: opt.label,
        options: opt.items
      }))
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
