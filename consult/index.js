/**
 * consult/index.js
 * LINE相談用：GPT-5（Responses API対応・安定版）
 */

const { OpenAI } = require("openai");
const buildConsultMessages = require("../utils/buildConsultMessages");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const {
  getUser,
  getContext,
  getLastTwoFollowupsByUserId,
  getLastNConsultMessages,
  saveConsultMessage,
} = supabaseMemoryManager;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isAllowed(user) {
  return (
    user?.trial_intro_done === true ||
    (user?.subscribed === true && user?.plan_type === "standard")
  );
}

/** LINE返信：reply失敗時はpushで再送 */
async function safeReplyThenPushFallback({ client, event, text }) {
  try {
    await client.replyMessage(event.replyToken, { type: "text", text });
  } catch (e) {
    try {
      await client.pushMessage(event.source.userId, { type: "text", text });
    } catch (e2) {
      console.error("reply失敗→pushも失敗:", e2);
    }
  }
}

/** careCounts を1日1回扱いに正規化（followupと共通仕様） */
function normalizeCareCountsPerDay(careCounts) {
  if (!careCounts || typeof careCounts !== "object") return {};
  const normalized = {};
  for (const [pillar, count] of Object.entries(careCounts)) {
    normalized[pillar] = Math.min(Number(count) || 0, 8);
  }
  return normalized;
}

module.exports = async function consult(event, client) {
  const lineId = event.source.userId;
  const userText = event.message?.text || "";

  // 🔹ユーザー確認
  let user;
  try {
    user = await getUser(lineId);
  } catch (err) {
    console.error("getUser失敗:", err);
    return safeReplyThenPushFallback({
      client,
      event,
      text: "ユーザー情報の取得に失敗しました🙏\n一度メニューから診断を受け直してください。",
    });
  }

  if (!isAllowed(user)) {
    const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
    return safeReplyThenPushFallback({
      client,
      event,
      text:
        "恐れ入りますが、この機能はサブスク利用ユーザー様またはトライアル中のユーザー様限定となります🙏\n" +
        "ご利用希望は『サービス案内』→ サブスク登録をご確認ください。\n\n" +
        `🔗 ${subscribeUrl}`,
    });
  }

  // 🔹必要データ取得
  let context, followups, recentChats, careCounts = {};
  try {
    [context, followups, recentChats] = await Promise.all([
      getContext(lineId),
      getLastTwoFollowupsByUserId(user.id),
      getLastNConsultMessages(user.id, 3),
    ]);

// 🔹carelogを短期（followup以降）＋長期（context以降）の両方取得
const shortTermCareCounts =
  await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId);
const longTermCareCounts =
  await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId, { includeContext: true });

// 🔹短期のみ1日1回扱いに丸めて利用（週次変化の基準）
careCounts = normalizeCareCountsPerDay(shortTermCareCounts);

// 🔹長期もプロンプトに渡せるよう追加
const extraCareCounts = { shortTermCareCounts, longTermCareCounts };

  } catch (err) {
    console.error("データ取得失敗:", err);
    return safeReplyThenPushFallback({
      client,
      event,
      text: "データの取得に失敗しました🙏\n少し時間をおいてから、もう一度お試しください。",
    });
  }

  // 🔹ユーザー発話を保存（非同期）
  saveConsultMessage(user.id, "user", userText).catch((e) =>
    console.warn("save user msg fail", e)
  );

  // 🔹プロンプト生成（careCounts追加済み）
const messages = buildConsultMessages({
  context,
  followups,
  userText,
  recentChats,
  careCounts,
  extraCareCounts, // ← 長期データ追加！
});

  try {
    // ✅ GPT-5 Responses API
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: [
        {
          role: "system",
          content: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
        },
      ],
      reasoning: { effort: "minimal" },
      text: { verbosity: "medium" },
    });

    // ✅ 出力抽出
    const text =
      rsp.output_text ||
      rsp.output?.[0]?.content?.map((c) => c.text).join("\n") ||
      rsp.output?.[0]?.content?.[0]?.text ||
      "（すみません、回答を生成できませんでした）";

    console.log("GPT出力:", text);

    // ✅ LINEへ返信
    await safeReplyThenPushFallback({ client, event, text });

    // 🔹AI応答ログ保存
    saveConsultMessage(user.id, "assistant", text).catch((e) =>
      console.warn("save ai msg fail", e)
    );

  } catch (err) {
    console.error("OpenAI呼び出し失敗:", err);
    safeReplyThenPushFallback({
      client,
      event,
      text: "ただいまAIの応答が混み合っています🙏\n少し時間をおいて、もう一度お試しください。",
    });
  }
};
