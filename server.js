const express = require('express');
const line = require('@line/bot-sdk');
const questions = require('./questions');
const diagnose = require('./diagnosis');
const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);
app.use(express.json());

// ユーザーごとの状態保存
const userAnswers = {};

// 主訴の一覧（定義をquestions.jsと連動）
const categories = Object.keys(questions);

// Webhook受信
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result));
});

// メイン処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const text = event.message.text;

  // 診断開始コマンド
  if (text === '診断開始') {
    userAnswers[userId] = {
      stage: 'awaiting_category',
      category: null,
      currentQ: 0,
      answers: {}
    };
    return client.replyMessage(event.replyToken, categoryQuickReply());
  }

  // 未登録ユーザーへの案内
  if (!userAnswers[userId]) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '診断を始めるには「診断開始」と送信してください。'
    });
  }

  const session = userAnswers[userId];

  // ステージ：主訴選択中
  if (session.stage === 'awaiting_category') {
    if (!questions[text]) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '有効な主訴を選んでください。'
      });
    }
    session.category = text;
    session.stage = 'in_progress';
    session.currentQ = 1;
    const qObj = questions[text]["Q1"];
    return client.replyMessage(event.replyToken, questionToTemplate(qObj, "Q1"));
  }

  // ステージ：質問進行中
  const currentQKey = "Q" + session.currentQ;
  session.answers[currentQKey] = text;
  session.currentQ += 1;

  if (session.currentQ > 5) {
    const result = diagnose(session.answers, session.category);
    delete userAnswers[userId];
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `✅あなたの体質タイプは「${result.base}」です。\n\n📌傾向：${result.trend}\n📌よくある症状：${result.symptoms}\n📌セルフケア：${result.selfcare}\n\n詳しくはこちら👉 ${result.link}`
    });
  } else {
    const nextQKey = "Q" + session.currentQ;
    const nextQObj = questions[session.category][nextQKey];
    return client.replyMessage(event.replyToken, questionToTemplate(nextQObj, nextQKey));
  }
}

// クイックリプライ：主訴選択
function categoryQuickReply() {
  return {
    type: 'text',
    text: '気になる症状を選んでください👇',
    quickReply: {
      items: categories.map(cat => ({
        type: 'action',
        action: {
          type: 'message',
          label: cat,
          text: cat
        }
      }))
    }
  };
}

// クイックリプライ：質問
function questionToTemplate(qObj, qKey) {
  return {
    type: 'text',
    text: `【${qKey}】${qObj.q}`,
    quickReply: {
      items: qObj.options.map(opt => ({
        type: 'action',
        action: {
          type: 'message',
          label: opt,
          text: opt
        }
      }))
    }
  };
}

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
