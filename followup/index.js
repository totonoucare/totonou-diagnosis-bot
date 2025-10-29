// followup/index.js
// ===============================================
// 「ととのい度チェック」週次チェックフロー
// Q1: 主訴（体調） / Q2: 生活リズム / Q3: 動作テスト
// ===============================================

const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

// ======== ラベル定義 ========
const symptomLabels = {
  stomach: '胃腸の調子',
  sleep: '睡眠・集中力',
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
  symptom: "「{{symptom}}」を含む体調レベル",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  motion_level: "動作テストの変化",
};

// ======== セッション管理 ========
const userSession = {};

// ======== テンプレ置換 ========
function replacePlaceholders(template, context = {}) {
  if (!template || typeof template !== 'string') return '';
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || '不明な主訴')
    .replace(/\{\{motion\}\}/g, motionLabels[context.motion] || '指定の動作');
}

// ======== メイン処理 ========
async function handleFollowup(event, client, lineId) {
  try {
    const replyToken = event.replyToken;
    let message = "";

    if (event.type === 'message' && event.message.type === 'text') {
      message = event.message.text.trim();
    } else if (event.type === 'postback' && event.postback.data) {
      message = event.postback.data.trim();
    } else {
      return client.replyMessage(replyToken, [
        { type: 'text', text: '形式が不正です。ボタンで回答してください。' }
      ]);
    }

    // === チェック開始 ===
    if (message === 'ととのい度チェック開始') {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (!userRecord || (!userRecord.subscribed && !userRecord.trial_intro_done)) {
        await client.replyMessage(replyToken, [{
          type: 'text',
          text: 'この機能はサブスクまたはお試し期間中にご利用いただけます🙏\nメニュー内「サービス案内」から登録できます✨'
        }]);
        return;
      }

      userSession[lineId] = { step: 1, answers: {} };
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(lineId);
      return client.replyMessage(replyToken, [buildFlexMessage(q1, context)]);
    }

    // === 質問中でない場合 ===
    if (!userSession[lineId]) {
      return client.replyMessage(replyToken, [
        { type: 'text', text: '始めるには「ととのい度チェック開始」を押してください。' }
      ]);
    }

    const session = userSession[lineId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // === 複数選択質問 ===
    if (question.isMulti && Array.isArray(question.options)) {
      const parts = message.split(':');
      if (parts.length !== 2) {
        return client.replyMessage(replyToken, [
          { type: 'text', text: '回答形式に誤りがあります。ボタンを使ってください。' }
        ]);
      }

      const [key, answer] = parts;
      if (!question.options.find(opt => opt.id === key)) {
        return client.replyMessage(replyToken, [
          { type: 'text', text: '不正な選択肢です。ボタンから選んでください。' }
        ]);
      }

      if (!session.partialAnswers) session.partialAnswers = {};
      session.partialAnswers[key] = answer;

      const remaining = question.options.map(sub => sub.id).filter(k => !(k in session.partialAnswers));
      if (remaining.length > 0) return;

      Object.assign(session.answers, session.partialAnswers);
      delete session.partialAnswers;
      session.step++;

    } else {
      // === 単一質問（動作テスト） ===
      const validDataValues = question.options.map(opt => opt.data);
      if (!validDataValues.includes(message)) {
        return client.replyMessage(replyToken, [
          { type: 'text', text: '選択肢からお選びください。' }
        ]);
      }

      let value = message;
      if (value.startsWith("Q3=")) {
        const num = parseInt(value.split("=")[1]);
        value = isNaN(num) ? null : num;
      }

      session.answers.motion_level = value;
      session.step++;
    }

    // === 最終ステップ完了 ===
    if (session.step > questionSets.length) {
      const answers = session.answers;

      await supabaseMemoryManager.setFollowupAnswers(lineId, answers);

      // 🔄 処理中リプライ
      await client.replyMessage(replyToken, [{
        type: 'text',
        text: '✅ チェック完了！\n🧠 トトノウAIがスコア・今週のケアプランを作成中です…\n1分ほどお待ちください🙏'
      }]);

      // 🔁 GPT出力をプッシュ
      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          try {
            if (result?.sections?.flexList?.length) {
              await client.pushMessage(lineId, result.sections.flexList);
            } else {
              await client.pushMessage(lineId, [{
                type: 'text',
                text: `📋 今回のととのい度チェック\n\n${result?.gptComment || "解析がうまくいきませんでした。"}`
              }]);
            }
          } finally {
            delete userSession[lineId];
          }
        })
        .catch(async (err) => {
          console.error("❌ GPTコメント生成失敗:", err);
          await client.pushMessage(lineId, [
            { type: 'text', text: '診断コメントの生成中にエラーが発生しました。' }
          ]);
          delete userSession[lineId];
        });

      return;
    }

    // === 次の質問へ ===
    const nextQuestion = questionSets[session.step - 1];
    const nextContext = await supabaseMemoryManager.getContext(lineId);
    return client.replyMessage(replyToken, [{
      type: 'flex',
      altText: replacePlaceholders(nextQuestion.header, nextContext),
      contents: buildFlexMessage(nextQuestion, nextContext).contents
    }]);

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return client.replyMessage(event.replyToken, [
      { type: 'text', text: 'エラーが発生しました。時間をおいて再試行してください。' }
    ]);
  }
}

// ======== 質問Flex生成 ========
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
