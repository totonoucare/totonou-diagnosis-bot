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
  unknown: 'なんとなく不調・その他',
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

async function handleFollowup(event, client, lineId) {
  try {
    const replyToken = event.replyToken;
    let message = "";

    if (event.type === 'message' && event.message.type === 'text') {
      message = event.message.text.trim();
    } else if (event.type === 'postback' && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return client.replyMessage(replyToken, [{ type: 'text', text: '形式が不正です。A〜Eのボタンで回答してください。' }]);
    }

if (message === '定期チェックナビ') {
  const userRecord = await supabaseMemoryManager.getUser(lineId);
  if (!userRecord || (!userRecord.subscribed && !userRecord.trial_intro_done)) {
    await client.replyMessage(replyToken, [{
      type: 'text',
      text: 'この機能はサブスク会員様、もしくは無料お試し期間限定となっています🙏\n\nサブスク登録ページはメニュー内『ご案内リンク集』からアクセスいただけます✨'
    }]);
    return null;
  }

      userSession[lineId] = { step: 1, answers: {} };
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(lineId);
      return client.replyMessage(replyToken, [buildFlexMessage(q1, context)]);
    }

    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [{ type: 'text', text: '始めるには「定期チェッナビ」と送ってください。' }]);
    }

    const session = userSession[lineId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    if (question.isMulti && Array.isArray(question.options)) {
      const parts = message.split(':');
      if (parts.length !== 2) {
        return client.replyMessage(replyToken, [{ type: 'text', text: '回答形式に誤りがあります。ボタンを使ってください。' }]);
      }

      const [key, answer] = parts;
      if (!question.options.find(opt => opt.id === key)) {
        return client.replyMessage(replyToken, [{ type: 'text', text: '不正な選択肢です。ボタンから選んでください。' }]);
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[key] = answer;

      const remaining = question.options.map(sub => sub.id).filter(k => !(k in session.partialAnswers));
      if (remaining.length > 0) return;

      Object.assign(session.answers, session.partialAnswers);
      delete session.partialAnswers;
      session.step++;

    } else {
      const validDataValues = question.options.map(opt => opt.data);
      if (!validDataValues.includes(message)) {
        return client.replyMessage(replyToken, [{ type: 'text', text: '選択肢からお選びください。' }]);
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
    }

    if (session.step > questionSets.length) {
      const answers = session.answers;

      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

      const motionLevel = answers['motion_level'];
      if (motionLevel && /^[1-5]$/.test(motionLevel)) {
        await supabaseMemoryManager.updateUserFields(lineId, { motion_level: parseInt(motionLevel) });
      }

      // 🧠 解析中メッセージを reply
      await client.replyMessage(replyToken, [{
        type: 'text',
        text: '🧠AIが解析中です...\nしばらくお待ちください。'
      }]);

      // GPT処理 → 終わり次第 push
      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          await client.pushMessage(lineId, [{
            type: 'text',
            text: `📋【今回の定期チェック診断結果】\n${result?.gptComment || "（解析コメント取得に失敗しました）"}`
          }]);
          delete userSession[lineId];
        })
        .catch(async (err) => {
          console.error("❌ GPTコメント生成失敗:", err);
          await client.pushMessage(lineId, [{
            type: 'text',
            text: '診断コメントの生成中にエラーが発生しました。'
          }]);
          delete userSession[lineId];
        });

      return;
    }

    const nextQuestion = questionSets[session.step - 1];
    const nextContext = await supabaseMemoryManager.getContext(lineId);
    return client.replyMessage(replyToken, [{
      type: 'flex',
      altText: replacePlaceholders(nextQuestion.header, nextContext),
      contents: buildFlexMessage(nextQuestion, nextContext).contents
    }]);

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return client.replyMessage(event.replyToken, [{
      type: 'text',
      text: '診断中にエラーが発生しました。もう一度「定期チェックナビ」と送って再開してください。'
    }]);
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
  hasSession: (lineId) => !!userSession[lineId]
});
