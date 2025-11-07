/**
 * consult/index.js
 * LINE相談用：GPT-5（Responses API対応・安定版／Flex対応）
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

/** careCounts を1日1回扱いに正規化（followupと共通仕様） */
function normalizeCareCountsPerDay(careCounts) {
  if (!careCounts || typeof careCounts !== "object") return {};
  const normalized = {};
  for (const [pillar, count] of Object.entries(careCounts)) {
    normalized[pillar] = Number(count) || 0;
  }
  return normalized;
}

function buildFlexFromText(aiText) {
  const contents = [];
  const lines = aiText.split(/\r?\n/).filter((l) => l.trim() !== "");

  for (const line of lines) {
    // 見出し判定：行頭が絵文字＋文末が「：」の場合
    const isHeading = /^[\p{Emoji}\p{So}].+[:：]\s*$/u.test(line.trim());

    // 特殊ボタントリガー
    if (line.includes("(図解はケアガイドへ！)")) {
      const cleanText = line.replace("(図解はケアガイドへ！)", "").trim();
      contents.push({
        type: "text",
        text: cleanText,
        wrap: true,
        color: isHeading ? "#3b5d40" : "#222222",
        weight: isHeading ? "bold" : "regular"
      });
      contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action: {
          type: "message",
          label: "📘 ととのうケアガイドを開く",
          text: "ととのうケアガイド",
        },
      });
      continue;
    }

    if (line.includes("(記録ボタンへ！)")) {
      const cleanText = line.replace("(記録ボタンへ！)", "").trim();
      contents.push({
        type: "text",
        text: cleanText,
        wrap: true,
        color: isHeading ? "#3b5d40" : "#222222",
        weight: isHeading ? "bold" : "regular"
      });
      contents.push({
        type: "button",
        style: "link",
        height: "sm",
        action: {
          type: "message",
          label: "🧘‍♀️ 実施記録する",
          text: "実施記録",
        },
      });
      continue;
    }

    // 通常テキスト行
    contents.push({
      type: "text",
      text: line.trim(),
      wrap: true,
      color: isHeading ? "#3b5d40" : "#222222",
      weight: isHeading ? "bold" : "regular"
    });
  }

  return {
    type: "flex",
    altText: "AIからのアドバイス",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        backgroundColor: "#f8f9f7",
        contents,
      },
    },
  };
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
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "ユーザー情報の取得に失敗しました🙏\n一度メニューから診断を受け直してください。",
    });
  }

  if (!isAllowed(user)) {
    const subscribeUrl = `https://totonoucare.com/subscribe/?line_id=${lineId}`;
    return client.replyMessage(event.replyToken, {
      type: "text",
      text:
        "恐れ入りますが、この機能はサブスク利用ユーザー様またはトライアル中のユーザー様限定となります🙏\n" +
        "ご利用希望は『サービス案内』→ サブスク登録をご確認ください。\n\n" +
        `🔗 ${subscribeUrl}`,
    });
  }

  // 🔹必要データ取得
  let context, followups, recentChats, careCounts = {}, extraCareCounts = {};
  try {
    [context, followups, recentChats] = await Promise.all([
      getContext(lineId),
      getLastTwoFollowupsByUserId(user.id),
      getLastNConsultMessages(user.id, 3),
    ]);

    const shortTermCareCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId);
    const longTermCareCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(lineId, { includeContext: true });

    careCounts = shortTermCareCounts;
    extraCareCounts = { shortTermCareCounts, longTermCareCounts };
  } catch (err) {
    console.error("データ取得失敗:", err);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "データの取得に失敗しました🙏\n少し時間をおいてから、もう一度お試しください。",
    });
  }

  // 🔹ユーザー発話を保存（非同期）
  saveConsultMessage(user.id, "user", userText).catch((e) =>
    console.warn("save user msg fail", e)
  );

  // 🔹プロンプト生成
  const messages = buildConsultMessages({
    context,
    followups,
    userText,
    recentChats,
    careCounts,
    extraCareCounts,
  });

  try {
    // ✅ GPT-5 Responses API呼び出し
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: messages,
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

    // ✅ テキストをFlexに変換
    const flexMessage = buildFlexFromText(text);

    // ✅ Flexを返信（pushなし）
    await client.replyMessage(event.replyToken, flexMessage);

    // 🔹AI応答ログ保存
    saveConsultMessage(user.id, "assistant", text).catch((e) =>
      console.warn("save ai msg fail", e)
    );

  } catch (err) {
    console.error("OpenAI呼び出し失敗:", err);
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "ただいまAIの応答が混み合っています🙏\n少し時間をおいて、もう一度お試しください。",
    });
  }
};
