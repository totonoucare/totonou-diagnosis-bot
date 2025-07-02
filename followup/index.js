全文上書きコード書いて
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

const multiLabels = {
  symptom: "「{{symptom}}」のお悩みレベル",
  general: "全体的な調子",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  habits: "体質改善の習慣（温活・食事・睡眠など）",
  breathing: "巡りととのえ呼吸法",
  stretch: "内臓ととのえストレッチ",
  tsubo: "ツボケア（指圧・お灸）",
  kampo: "漢方薬の服用",
  Q4: "動作テストの変化",
  Q5: "セルフケアの課題"
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

    if (message === '定期チェック診断') {
      const userRecord = await supabaseMemoryManager.getUser(userId);
      if (!userRecord || !userRecord.subscribed) {
        return [{ type: 'text', text: 'この機能は「サブスク希望」を送信いただいた方のみご利用いただけます。' }];
      }

      userSession[userId] = { step: 1, answers: {} };
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

    if (question.isMulti && Array.isArray(question.options)) {
      const parts = message.split(':');
      if (parts.length !== 2) {
        return [{ type: 'text', text: '回答形式に誤りがあります。ボタンを使ってください。' }];
      }

      const [key, answer] = parts;
      if (!question.options.find(opt => opt.id === key)) {
        return [{ type: 'text', text: '不正な選択肢です。ボタンから選んでください。' }];
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[key] = answer;

      const remaining = question.options.map(sub => sub.id).filter(k => !(k in session.partialAnswers));
      if (remaining.length > 0) return [];

      Object.assign(session.answers, session.partialAnswers);
      delete session.partialAnswers;
      session.step++;

      const context = await supabaseMemoryManager.getContext(userId);
      const summary = question.options.map(opt => {
        const key = opt.id;
        const label = replacePlaceholders(multiLabels[key] || key, context);
        const value = session.answers[key];
        return `・${label} → ${value}`;
      }).join('\n');

      const headerMap = {
        Q1: '📝 症状と体調の変化',
        Q2: '🛌 生活リズムの整い具合',
        Q3: '🧘 セルフケアの実施状況'
      };
      const header = headerMap[question.id] || '✅ 回答を確認しました';

      await client.pushMessage(userId, {
        type: 'text',
        text: `✅ ${header} を確認しました！\n\n${summary}`
      });

    } else {
      const validDataValues = question.options.map(opt => opt.data);
      if (!validDataValues.includes(message)) {
        return [{ type: 'text', text: '選択肢からお選びください。' }];
      }

      const keyName = question.id === "Q5" ? "q5_answer" :
                      question.id === "Q4" ? "motion_level" :
                      question.id;

      let value = message;
      if (question.id === "Q4" && value.startsWith("Q4=")) {
        const num = parseInt(value.split("=")[1]);
        value = isNaN(num) ? null : num;
      }

      session.answers[keyName] = value;
      session.step++;

      const context = await supabaseMemoryManager.getContext(userId);

      if (question.id === "Q4") {
        const label = replacePlaceholders(multiLabels[question.id], context);
        await client.pushMessage(userId, {
          type: 'text',
          text: `✅ ${label} → ${value}`
        });
      }

      if (question.id === "Q5") {
        const q5TextMap = {
          A: "やり方が分からなかった",
          B: "効果を感じなかった",
          C: "時間が取れなかった",
          D: "体に合わない気がした",
          E: "モチベーションが続かなかった",
          F: "特になし"
        };
        const readable = q5TextMap[value?.split("=")[1]] || "不明";
        const label = replacePlaceholders(multiLabels[question.id], context);
        await client.pushMessage(userId, {
          type: 'text',
          text: `✅ ${label} → ${readable}`
        });
      }
    }

    if (session.step > questionSets.length) {
      const answers = session.answers;
      const context = await supabaseMemoryManager.getContext(userId);
      if (!context?.symptom || !context?.type) {
        console.warn("⚠️ context 情報が不完全です");
      }

      await supabaseMemoryManager.setFollowupAnswers(userId, answers);

      const motionLevel = answers['motion_level'];
      if (motionLevel && /^[1-5]$/.test(motionLevel)) {
        await supabaseMemoryManager.updateUserFields(userId, { motion_level: parseInt(motionLevel) });
      }

      await client.pushMessage(userId, {
        type: 'text',
        text: '🧠 お体の変化をAIが解析中です...\nちょっとだけお待ちくださいね。'
      });

      const result = await handleFollowupAnswers(userId, answers);
      delete userSession[userId];

      return [{
        type: 'text',
        text: `📋【今回の定期チェック診断結果】\n${result?.gptComment || "（解析コメント取得に失敗しました）"}`
      }];
    }

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
  if (question.isMulti && Array.isArray(question.options)) {
    return buildMultiQuestionFlex({
      altText: replacePlaceholders(question.header, context),
      header: replacePlaceholders(question.header, context),
      body: replacePlaceholders(question.body, context),
      questions: question.options.map(opt => ({
        key: opt.id,
        title: replacePlaceholders(multiLabels[opt.id] || opt.label || opt.id, context),
        items: opt.items
      }))
    });
  }

  return MessageBuilder({
    altText: replacePlaceholders(question.header, context),
    header: replacePlaceholders(question.header, context),
    body: replacePlaceholders(question.body, context),
    buttons: question.options.map(opt => ({
      label: opt.label,
      data: opt.data,
      displayText: opt.displayText
    }))
  });
}

module.exports = Object.assign(handleFollowup, {
  hasSession: (userId) => !!userSession[userId]
});
