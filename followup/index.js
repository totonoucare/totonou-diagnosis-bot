// followup/index.js
const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
const { MessageBuilder, buildMultiQuestionFlex, buildFollowupCarousel } = require('../utils/flexBuilder');

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

const multiLabels = {
  symptom: "「{{symptom}}」のお悩みレベル",
  general: "全体的な調子",
  sleep: "睡眠の状態",
  meal: "食事の状態",
  stress: "ストレスの状態",
  habits: "体質改善習慣",
  breathing: "巡りととのう呼吸法",
  stretch: "経絡ストレッチ",
  tsubo: "あなたのツボケア",
  kampo: "漢方薬の活用",
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

/** gptComment を3カードに強制分割（見出しベース or 機械分割） */
function splitCommentToThreeCards(gptComment = '') {
  const text = (gptComment || '').trim();
  const lines = text ? text.split(/\r?\n/).filter(l => l.trim()) : [];
  const idxKeep = lines.findIndex(l => l.includes('このまま続けるといいこと'));
  const idxNext = lines.findIndex(l => l.includes('次にやってみてほしいこと'));

  let p1 = [], p2 = [], p3 = [];
  if (idxKeep !== -1 && idxNext !== -1 && idxKeep < idxNext) {
    p1 = lines.slice(0, idxKeep);
    p2 = lines.slice(idxKeep, idxNext);
    p3 = lines.slice(idxNext);
  } else {
    const n = Math.max(lines.length, 3);
    const a = Math.floor(n * 0.33);
    const b = Math.floor(n * 0.66);
    p1 = lines.slice(0, a || 1);
    p2 = lines.slice(a || 1, b || 2);
    p3 = lines.slice(b || 2);
  }

  const mk = (title, arr) => ({
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "md" },
        { type: "separator", margin: "md" },
        { type: "text", text: (arr.join("\n") || "（解析結果の取得に失敗しました）"), wrap: true, size: "sm" }
      ]
    }
  });

  return [
    mk("📋 今回の定期チェック", p1),
    mk("😊 このまま続けるといいこと", p2),
    mk("🧭 次にやってみてほしいこと", p3)
  ];
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

    if (message === '定期チェックナビ開始') {
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
      return client.replyMessage(replyToken, [{ type: 'text', text: '始めるには「定期チェックナビ開始」と送ってください。' }]);
    }

    const session = userSession[lineId];
    const question = questionSets[session.step - 1];

    // マルチ設問
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
      // 単一設問
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

    // 完了 → 解析へ
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // 解析中メッセージ（軽量）
      await client.replyMessage(replyToken, [{ type: 'text', text: '🧠 解析中です… 少しだけお待ちください。' }]);

      // 解析 & push（カルーセル1通のみ）
      const result = await handleFollowupAnswers(lineId, answers);

      // 1) まず result.cards を優先
      let cards = Array.isArray(result?.cards) ? result.cards : null;

      // 2) 無ければ gptComment から3枚生成
      if (!cards) cards = splitCommentToThreeCards(result?.gptComment || '');

      // 3) 念のため最終フォールバック
      if (!cards || !cards.length) {
        cards = splitCommentToThreeCards("今回の記録を受け取りました。\n\nこのまま続けるといいこと\n小さな積み重ねができています。\n\n次にやってみてほしいこと\n今日は1分だけ呼吸を深めましょう。");
      }

      await client.pushMessage(lineId, [{
        type: 'flex',
        altText: '今回の定期チェックナビ',
        contents: buildFollowupCarousel(cards)
      }]);

      delete userSession[lineId];
      return;
    }

    // 次の設問
    const nextQuestion = questionSets[session.step - 1];
    const nextContext = await supabaseMemoryManager.getContext(lineId);
    return client.replyMessage(replyToken, [{
      type: 'flex',
      altText: replacePlaceholders(nextQuestion.header, nextContext),
      contents: buildFlexMessage(nextQuestion, nextContext).contents
    }]);

  } catch (err) {
    console.error('❌ followup/index.js エラー:', err);
    return client.replyMessage(event.replyToken, [{ type: 'text', text: 'すでに操作済みです。' }]);
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
