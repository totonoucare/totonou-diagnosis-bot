/**
 * consult/index.js
 * LINE相談用：GPT-5（Responses API対応・安定版／Flex対応／思考時間表示付き）
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

// 🌿 Flex生成関数（🧠思考時間対応）
function buildFlexFromText(aiText, thinkingTimeSec) {
  const contents = [];

  // 🧠思考時間（最初に追加）
  if (thinkingTimeSec) {
    contents.push({
      type: "text",
      text: `🧠 思考時間: ${thinkingTimeSec.toFixed(1)}秒`,
      size: "xs",
      color: "#888888",
      wrap: true,
      margin: "none",
    });
    contents.push({ type: "separator", color: "#dddddd", margin: "sm" });
  }

  const lines = aiText.split(/\r?\n/).filter((l) => l.trim() !== "");
  const numToCircle = {
    1: "❶", 2: "❷", 3: "❸", 4: "❹", 5: "❺",
    6: "❻", 7: "❼", 8: "❽", 9: "❾", 10: "❿",
  };

  for (let line of lines) {
    const trimmed = line.trim();
    const isHeading = /[:：]\s*$/.test(trimmed);

    if (/^[-・]/.test(trimmed)) {
      line = trimmed.replace(/^[-・]\s*/, "• ");
    } else if (/^\d+\./.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\./);
      const num = parseInt(numMatch?.[1] || "0", 10);
      const circle = numToCircle[num] || "•";
      line = trimmed.replace(/^\d+\.\s*/, `${circle} `);
    }

    // 特殊トリガー(図解)
    if (line.includes("(図解はケアガイドへ！)")) {
      const cleanText = line.replace("(図解はケアガイドへ！)", "").trim();
      contents.push({
        type: "text",
        text: cleanText,
        wrap: true,
        color: "#000000",
        weight: isHeading ? "bold" : "regular",
      });
      contents.push({
        type: "button",
        style: "primary",
        color: "#7B9E76",
        height: "sm",
        action: {
          type: "message",
          label: "📘 ケアガイドで図解チェック",
          text: "ととのうケアガイド",
        },
      });
      continue;
    }

    // 特殊トリガー(記録)
    if (line.includes("(記録ボタンへ！)")) {
      const cleanText = line.replace("(記録ボタンへ！)", "").trim();
      contents.push({
        type: "text",
        text: cleanText,
        wrap: true,
        color: "#000000",
        weight: isHeading ? "bold" : "regular",
      });
      contents.push({
        type: "button",
        style: "primary",
        color: "#7B9E76",
        height: "sm",
        action: {
          type: "message",
          label: "🧘‍♀️ ケア実施を記録する",
          text: "実施記録",
        },
      });
      continue;
    }

    contents.push({
      type: "text",
      text: line.trim(),
      wrap: true,
      color: "#000000",
      weight: isHeading ? "bold" : "regular",
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

  // ユーザー確認
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

  // データ取得
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

  saveConsultMessage(user.id, "user", userText).catch((e) =>
    console.warn("save user msg fail", e)
  );

  const messages = buildConsultMessages({
    context,
    followups,
    userText,
    recentChats,
    careCounts,
    extraCareCounts,
  });

  try {
    // ✅ GPT呼び出し＋思考時間計測
    const start = Date.now();
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: messages,
      reasoning: { effort: "minimal" },
      text: { verbosity: "low" },
    });
    const duration = (Date.now() - start) / 1000; // 秒換算

    const text =
      rsp.output_text ||
      rsp.output?.[0]?.content?.map((c) => c.text).join("\n") ||
      rsp.output?.[0]?.content?.[0]?.text ||
      "（すみません、回答を生成できませんでした）";

    console.log(`GPT出力 (${duration.toFixed(1)}秒):`, text);


    // ✅ テキストをFlexに変換
    const flexMessage = buildFlexFromText(text, duration);

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
