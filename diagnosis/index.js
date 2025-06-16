const questionSets = require('./questionSets');
const { buildQuestionFlex, buildCategorySelectionFlex, buildCarouselFlex } = require('../utils/flexBuilder');
const { handleAnswers } = require('./answerRouter');
const {
  saveContext,
  getContext,
  initializeUser
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
    const result = await handleAnswers(session.answers);
    const [score1, score2, score3] = result.scores || [];

    try {
      await saveContext(
        userId,
        score1,
        score2,
        score3,
        result.flowIssue,
        result.organBurden,
        result.type,
        result.traits,
        result.adviceCards
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
          text: `【🤖AIが提案！📗あなた専用ととのうガイド】

あなたの体質にぴったりのセルフケア法や整え習慣を  
“ミニガイド📖”にまとめてお届けします🎁

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
          messages: [
            { type: 'text', text: '診断データが見つかりませんでした。もう一度診断をお願いします。' }
          ]
        };
      }

      const carousel = buildCarouselFlex(context.advice);
      return {
        messages: [
          carousel,
          {
            type: 'text',
            text: `📅 東洋医学で本格ケア、まずは今週から始めてみませんか？

あなたの体質に合わせた“ととのうガイド”をもとに、できそうなことを1つだけでも大丈夫。
その小さな一歩が、「ととのうチカラ」を少しずつ育てて、不調の根っこから整えてくれます🌱💪

さらに…

🔒「サブスク登録」すると、
✔ あなた専用の“ととのうガイドAI”が
✔ 習慣化を応援するリマインド機能＆定期チェック診断📊をお届け！
（セルフケアの実践状況や体調の変化にあわせて、AIがやさしく的確にフォローします）

東洋医学のパーソナルケアを、AIがもっと身近に。  
あなたも「ととのうチカラ」をAIと一緒に育てていきませんか？

🧭 もし迷ったときは、
オンライン相談や治療院のご案内（メニューバー内）もご活用ください。
あなたの「ととのう」を、ずっと応援し続けます✊

「サブスク希望」と入力いただくと、ご案内をお送りします♪`
          }
        ]
      };
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

  // ✅ ユーザー初期化（DBに行がない場合でも）
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
