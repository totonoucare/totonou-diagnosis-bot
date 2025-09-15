// consult/index.js
const { OpenAI } = require("openai");
const buildConsultMessages = require("../utils/buildConsultMessages");
const { getUser, getContext, getLastTwoFollowupsByUserId } = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isAllowed(user) {
  return user?.trial_intro_done === true ||
         (user?.subscribed === true && user?.plan_type === "standard");
}

async function safeReplyThenPushFallback({ client, event, text }) {
  try {
    // まずは reply で本回答
    await client.replyMessage(event.replyToken, { type: "text", text });
  } catch (e) {
    // replyToken期限切れ等 → push でフォールバック
    try {
      await client.pushMessage(event.source.userId, { type: "text", text });
    } catch (e2) {
      console.error("reply失敗→pushも失敗:", e2);
    }
  }
}

module.exports = async function consult(event, client) {
  const lineId = event.source.userId;

  // 二重の保険（通常は server 側で事前チェック済み）
  let user;
  try {
    user = await getUser(lineId);
  } catch (err) {
    console.error("getUser失敗:", err);
    await safeReplyThenPushFallback({
      client, event,
      text: "ユーザー情報の取得に失敗しました🙏\n一度メニューから診断を受け直してください。"
    });
    return;
  }

  if (!isAllowed(user)) {
    const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
    return safeReplyThenPushFallback({
      client, event,
      text:
        "このAI相談は「スタンダード」またはトライアルの方限定です🙏\n" +
        "ご利用希望は『サービス案内』→ サブスク登録をご確認ください。\n\n" +
        `🔗 ${subscribeUrl}`
    });
  }

  // contexts と 直近2件の followups を取得
  let context, followups;
  try {
    [context, followups] = await Promise.all([
      getContext(lineId),
      getLastTwoFollowupsByUserId(user.id),
    ]);
  } catch (err) {
    console.error("データ取得失敗:", err);
    await safeReplyThenPushFallback({
      client, event,
      text: "データの取得に失敗しました🙏\n少し時間をおいてから、もう一度お試しください。"
    });
    return;
  }

  // プロンプト生成
  const messages = buildConsultMessages({
    context,
    followups,
    userText: event.message?.text || "",
  });

  // 生成
  try {
    const rsp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_completion_tokens: 700,
      temperature: 0.8,
    });

    const text =
      rsp.choices?.[0]?.message?.content?.trim() ||
      "（すみません、回答を生成できませんでした）";

    // まずは reply、本当に失敗したら push フォールバック
    await safeReplyThenPushFallback({ client, event, text });
  } catch (err) {
    console.error("OpenAI呼び出し失敗:", err);
    await safeReplyThenPushFallback({
      client, event,
      text: "ただいまAIの応答が混み合っています🙏\n少し時間をおいて、もう一度お試しください。"
    });
  }
};
