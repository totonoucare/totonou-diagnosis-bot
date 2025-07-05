// followup/index.js
const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
const { MessageBuilder, buildMultiQuestionFlex } = require('../utils/flexBuilder');

const userSession = {};

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

function replacePlaceholders(template, context = {}) {
  return template
    .replace(/\{\{symptom\}\}/g, symptomLabels[context.symptom] || '不明な主訴')
    .replace(/\{\{motion\}\}/g, context.motion || '特定の動作');
}

async function handleFollowup(event, client, lineId) {
  try {
    let message = "";

    if (event.type === 'message' && event.message.type === 'text') {
      message = event.message.text.trim();
    } else if (event.type === 'postback') {
      message = event.postback.data.trim();
    } else {
      return [{ type: 'text', text: '形式が不正です。A〜Eのボタンで回答してください。' }];
    }

    if (message === '定期チェック診断') {
      const userRecord = await supabaseMemoryManager.getUser(lineId);
      if (!userRecord?.subscribed) {
        return [{ type: 'text', text: 'この機能は「サブスク希望」を送信いただいた方のみご利用いただけます。' }];
      }
      userSession[lineId] = { step: 1, answers: {} };
      const q1 = questionSets[0];
      const context = await supabaseMemoryManager.getContext(lineId);
      return [buildFlexMessage(q1, context)];
    }

    if (!userSession[lineId]) {
      return [{ type: 'text', text: '再診を始めるには「定期チェック診断」と送ってください。' }];
    }

    const session = userSession[lineId];
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];
    const context = await supabaseMemoryManager.getContext(lineId);

    if (question.isMulti && Array.isArray(question.options)) {
      const [key, answer] = message.split(':');
      if (!key || !answer) return [];
      if (!question.options.find(opt => opt.id === key)) return [];

      session.partialAnswers ||= {};
      session.partialAnswers[key] = answer;

      const remaining = question.options.map(opt => opt.id).filter(id => !(id in session.partialAnswers));
      if (remaining.length > 0) return [];

      Object.assign(session.answers, session.partialAnswers);
      delete session.partialAnswers;
    } else {
      const valid = question.options.some(opt => opt.data === message);
      if (!valid) return [{ type: 'text', text: '選択肢からお選びください。' }];

      const keyName = question.id === "Q5" ? "q5_answer" :
                      question.id === "Q4" ? "motion_level" : question.id;

      let value = message;
      if (question.id === "Q4" && value.startsWith("Q4=")) {
        const num = parseInt(value.split("=")[1]);
        value = isNaN(num) ? null : num;
      }

      session.answers[keyName] = value;
    }

    // ➤ Q1〜Q5の最終回答時、replyMessage → pushMessageで次の質問を送る
    const summary = summarizeAnswer(question, session.answers, context);
    const reply = {
      type: 'text',
      text: `✅ ${summary.header}\n\n${summary.body}`
    };

    session.step++;
    const nextQuestion = questionSets[session.step - 1];

    // 最後まで回答した場合
    if (!nextQuestion) {
      await supabaseMemoryManager.setFollowupAnswers(lineId, session.answers);

      const motionLevel = session.answers['motion_level'];
      if (/^[1-5]$/.test(motionLevel)) {
        await supabaseMemoryManager.updateUserFields(lineId, { motion_level: parseInt(motionLevel) });
      }

      await client.replyMessage(event.replyToken, reply);
      await client.pushMessage(lineId, { type: 'text', text: '🧠 お体の変化をAIが解析中です...\n少々お待ちください。' });

      const result = await handleFollowupAnswers(lineId, session.answers);
      delete userSession[lineId];

      return [{
        type: 'text',
        text: `📋【今回の定期チェック診断結果】\n${result?.gptComment || "（解析コメント取得に失敗しました）"}`
      }];
    }

    // 通常：回答確認→次の質問
    await client.replyMessage(event.replyToken, reply);
    await client.pushMessage(lineId, buildFlexMessage(nextQuestion, context));
    return [];
  } catch (err) {
    console.error("❌ followup/index.js エラー:", err);
    return [{ type: 'text', text: '診断中にエラーが発生しました。もう一度お試しください。' }];
  }
}

function summarizeAnswer(question, answers, context) {
  const id = question.id;
  if (question.isMulti) {
    const lines = question.options.map(opt => {
      const key = opt.id;
      const label = replacePlaceholders(multiLabels[key] || key, context);
      return `・${label} → ${answers[key] || "未回答"}`;
    });
    return {
      header: multiLabels[id] || '回答内容',
      body: lines.join('\n')
    };
  }

  if (id === "Q5") {
    const map = {
      A: "やり方が分からなかった",
      B: "効果を感じなかった",
      C: "時間が取れなかった",
      D: "体に合わない気がした",
      E: "モチベーションが続かなかった",
      F: "特になし"
    };
    const val = answers.q5_answer?.split("=")[1] || "";
    return {
      header: replacePlaceholders(multiLabels[id], context),
      body: map[val] || "未回答"
    };
  }

  if (id === "Q4") {
    const motionLabel = replacePlaceholders(multiLabels[id], context);
    return { header: motionLabel, body: `→ ${answers.motion_level || "未回答"}` };
  }

  return {
    header: replacePlaceholders(multiLabels[id] || id, context),
    body: `→ ${answers[id] || "未回答"}`
  };
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
  hasSession: (lineId) => !!userSession[lineId],
});
