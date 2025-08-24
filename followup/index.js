// followup/index.js
const questionSets = require('./questionSets');
const handleFollowupAnswers = require('./followupRouter');
const supabaseMemoryManager = require('../supabaseMemoryManager');
// ✅ カルーセル出力ビルダー（utils/flexBuilder.js 側に実装済み想定）
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
  symptom: "「{{symptom\}\}」のお悩みレベル",
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

/**
 * gptComment を 3セクション（①冒頭+スコア ②続ける ③次に…）に強制パース
 * 見出しは「このまま続けるといいこと」「次にやってみてほしいこと」を目印にする
 * うまく見つからない場合は素直に三分割するだけの安全策
 */
function splitCommentToThreeCards(gptComment = '') {
  const text = (gptComment || '').trim();
  if (!text) return null;

  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const idxKeep = lines.findIndex(l => l.includes('このまま続けるといいこと'));
  const idxNext = lines.findIndex(l => l.includes('次にやってみてほしいこと'));

  let part1 = [], part2 = [], part3 = [];

  if (idxKeep !== -1 && idxNext !== -1 && idxKeep < idxNext) {
    part1 = lines.slice(0, idxKeep);
    part2 = lines.slice(idxKeep, idxNext);
    part3 = lines.slice(idxNext);
  } else {
    // 見出しが取れない場合は機械的に三分割
    const n = lines.length;
    const a = Math.max(1, Math.floor(n * 0.33));
    const b = Math.max(a + 1, Math.floor(n * 0.66));
    part1 = lines.slice(0, a);
    part2 = lines.slice(a, b);
    part3 = lines.slice(b);
  }

  const mkBubble = (title, arr) => ({
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: title, weight: "bold", size: "md" },
        { type: "separator", margin: "md" },
        { type: "text", text: arr.join("\n"), wrap: true, size: "sm" }
      ]
    }
  });

  const title1 = "📋 今回の定期チェック";
  const title2 = "😊 このまま続けるといいこと";
  const title3 = "🧭 次にやってみてほしいこと";

  return [ mkBubble(title1, part1), mkBubble(title2, part2), mkBubble(title3, part3) ];
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

    // セッション開始
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
    const currentStep = session.step;
    const question = questionSets[currentStep - 1];

    // マルチ設問（Q1〜Q3）
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
      // 単一設問（Q4/Q5）
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

    // 回答完了 → 解析へ
    if (session.step > questionSets.length) {
      const answers = session.answers;

      // Q4の動作レベルを users に控え（任意）
      const motionLevel = answers['motion_level'];
      if (motionLevel && /^[1-5]$/.test(motionLevel)) {
        await supabaseMemoryManager.updateUserFields(lineId, { motion_level: parseInt(motionLevel) });
      }

      // 解析中メッセージ
      await client.replyMessage(replyToken, [{
        type: 'text',
        text: '🧠トトノウAIが解析中です...\nお待ちいただく間に、下記のURLをタップして今回の『ととのう継続ポイント』をお受け取りください！👇\nhttps://u.lin.ee/i8yUyKF'
      }]);

      // GPT処理 → 終わり次第 push（カルーセルのみ送る）
      handleFollowupAnswers(lineId, answers)
        .then(async (result) => {
          // 1) まず result.cards を優先
          let cards = Array.isArray(result?.cards) ? result.cards : null;

          // 2) 無ければ gptComment から3枚生成
          if (!cards) {
            const fromText = splitCommentToThreeCards(result?.gptComment || '');
            if (fromText && fromText.length) cards = fromText;
          }

          // 3) それでもダメなら最小3枚のダミー生成
          if (!cards) {
            const mk = (title, body) => ({
              type: "bubble",
              size: "mega",
              body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                  { type: "text", text: title, weight: "bold", size: "md" },
                  { type: "separator", margin: "md" },
                  { type: "text", text: body, wrap: true, size: "sm" }
                ]
              }
            });
            cards = [
              mk("📋 今回の定期チェック", "今回の記録を受け取りました。"),
              mk("😊 このまま続けるといいこと", "小さな積み重ねができています。"),
              mk("🧭 次にやってみてほしいこと", "今日は1分だけ呼吸を深めましょう。")
            ];
          }

          // ✅ カルーセル1通のみ送信（テキストは送らない）
          await client.pushMessage(lineId, [{
            type: 'flex',
            altText: '今回の定期チェックナビ',
            contents: buildFollowupCarousel(cards)
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

    // 次の設問を出す
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
      text: 'すでに操作済みです。'
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
