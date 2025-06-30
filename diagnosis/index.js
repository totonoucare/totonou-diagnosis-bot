const questionSets = require('./questionSets');
const {
  buildQuestionFlex,
  buildCategorySelectionFlex,
  buildCarouselFlex
} = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');
const {
  saveContext,
  getContext,
  initializeUser,
  markGuideReceived  // ← これを追加！
} = require('../supabaseMemoryManager');

const userSessions = {};

async function handleDiagnosis(userId, userMessage, rawEvent = null) {
  const session = userSessions[userId];

  if (!session) {
    return {
      messages: [{ type: 'text', text: '「診断開始」と送ってから始めてくださいね。' }]
    };
  }

  if (!session.selectedCategory) {
    if (typeof userMessage === 'string' && questionSets[userMessage]) {
      session.selectedCategory = userMessage;
      session.currentStep = 1;
      session.answers = [];

      const questionKey = questionSets[userMessage]['Q1'];
      const flex = await buildQuestionFlex(questionKey);
      return { messages: [flex] };
    } else {
      return {
        messages: [
          { type: 'text', text: '主訴の選択が正しくありませんでした。もう一度お試しください。' },
          buildCategorySelectionFlex(),
        ]
      };
    }
  }

  const choice = userMessage.split('_').pop();
  session.answers.push(choice);
  session.currentStep++;

  const category = session.selectedCategory;
  const questionSet = questionSets[category];

  if (!questionSet) {
    return {
      messages: [{ type: 'text', text: '該当する質問が見つかりませんでした。' }]
    };
  }

  const nextQuestion = questionSet[`Q${session.currentStep}`];
  if (nextQuestion) {
    const flex = await buildQuestionFlex(nextQuestion);
    const displayText = rawEvent?.postback?.displayText || `あなたの選択：${choice}`;
    return {
      messages: [
        { type: 'text', text: displayText },
        flex,
      ]
    };
  } else {
    const result = await handleAnswers(session.answers, session.selectedCategory);
    const [score1, score2, score3] = result.scores || [];

    try {
      await saveContext(
        userId,
        score1,
        score2,
        score3,
        result.flowType,
        result.organType,
        result.type,
        result.traits,
        result.adviceCards,
        result.symptom || "未設定",
        result.motion || "未設定"
      );
    } catch (err) {
      console.error("❌ Supabase保存失敗:", err);
    }

    delete userSessions[userId];

    return {
      messages: [
        {
          type: 'text',
          text: `【📝あなたのベース体質】\n\n${result.type}\n\n【🧭体質解説と改善ナビ】\n\n${result.traits}`
        },
        {
          type: 'text',
          text: `【🌀巡りの傾向】\n\n${result.flowIssue}\n\n【🫁内臓への負担傾向】\n\n${result.organBurden}`
        },
        {
          type: 'text',
          text: `【🤖AIが提案！📗あなた専用Myととのうガイド】

あなたの体質にぴったりのセルフケア法や整え習慣を  
『Myととのうガイド』という“ミニガイド📖”にまとめてお届けします🎁

ただいま診断特典で無料プレゼント中✨  
メニューバーの【Myととのうガイド】をタップして、今すぐ受け取ってください♪`
        }
      ]
    };
  }
}

async function handleExtraCommands(userId, messageText) {
  if (messageText.includes("ととのうガイド")) {
    try {
      const context = await getContext(userId);

      if (!context || !context.advice) {
        return {
          messages: [{ type: 'text', text: '診断データが見つかりませんでした。もう一度診断をお願いします。' }]
        };
      }

      const carousel = buildCarouselFlex(context.advice);

      // 初回のみプロモーション文を送る
      const isFirstTime = !context.guide_received;

      if (isFirstTime) {
        await markGuideReceived(userId); // 次回からは送らないようにマーク

        return {
          messages: [
            carousel,
            {
              type: 'text',
              text: `🔄 「ととのう習慣」で、変わる毎日へ🌱

初回診断、おつかれさまでした！

ここからは、【Myととのうガイド】をもとに、「実践→振り返り」のサイクルを無理なく続けていくことがポイントです！🎯

📩 今ならサブスク登録いただくと、

　• 週2回のリマインド配信
　• 何度でも受けられる定期チェック診断
　• お体の状態変化に合わせてAIがセルフケアの見直し提案

が 月額980円（税込） でご利用いただけます（最大2週間の無料トライアル付き）🏃
☕ 1日あたり約32円で、「ととのう習慣」をサポートします！

さらに…
✅ お悩みや体調がしっかり改善した方には、月額が半額になる「卒業割」プランへの切り替えも可能です（いつでも移行可能）🎉

無理なく、でも着実に。
未来のカラダへの小さな投資を、そろそろ始めてみませんか？

👉 今すぐ始めたい方は「サブスク希望」と送信してください！
`
            }
          ]
        };
      } else {
        return { messages: [carousel] }; // 2回目以降はカルーセルだけ
      }
    } catch (err) {
      console.error("❌ context取得エラー:", err);
      return {
        messages: [
          { type: 'text', text: '診断データ取得時にエラーが発生しました。もう一度お試しください。' }
        ]
      };
    }
  }

  return null;
}

function startSession(userId) {
  userSessions[userId] = {
    currentStep: 0,
    selectedCategory: null,
    answers: [],
  };

  initializeUser(userId).catch(err => {
    console.error("❌ ユーザー初期化エラー:", err);
  });
}

function hasSession(userId) {
  return !!userSessions[userId];
}

module.exports = {
  handleDiagnosis,
  startSession,
  hasSession,
  handleExtraCommands
};
