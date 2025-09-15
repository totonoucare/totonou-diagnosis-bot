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
  const user = await getUser(lineId);

  if (!isAllowed(user)) {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "このAI相談は「スタンダード」またはトライアルの方限定です🙏\nご利用希望は『サービス案内』→ サブスク登録をご確認ください。",
    });
  }

  // contexts と 直近2件の followups を取得
  const [context, followups] = await Promise.all([
    getContext(lineId),
    getLastTwoFollowupsByUserId(user.id),
  ]);

  // プロンプト生成
  const messages = buildConsultMessages({
    context,
    followups,
    userText: event.message?.text || "",
  });

  // 生成（長引きすぎ対策で適宜値は調整可）
  const rsp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_completion_tokens: 700,
  });

  const text =
    rsp.choices?.[0]?.message?.content?.trim() ||
    "（すみません、回答を生成できませんでした）";

  // まずは reply、本当に失敗したら push フォールバック
  await safeReplyThenPushFallback({ client, event, text });
};
