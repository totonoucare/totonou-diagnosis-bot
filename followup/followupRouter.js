// followup/followupRouter.js
// ================================
// ユーザーのととのい度チェック回答を解析し、Supabaseに保存した上で
// GPT-5（responseSender）によるスコア算出・コメント生成を呼び出す
// ================================

// followup/followupRouter.js
const generateFollowupResult = require("./resultGenerator");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { sendFollowupResponse } = require("./responseSender");

async function handleFollowupAnswers(lineId, answers) {
  try {
    const cleanLineId = lineId.trim();

    // 📡 context取得（体質・アドバイス情報）
    const context = await supabaseMemoryManager.getContext(cleanLineId);
    if (!context) throw new Error(`❌ context取得失敗: lineId=${cleanLineId}`);

    // 💾 carelog（実施記録）取得：最新フォローアップ以降の5本柱を集計
    let carelogSummary = {};
    try {
      const carelogs = await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(cleanLineId);
      carelogSummary = carelogs || {};
    } catch (e) {
      console.warn("⚠️ care_logs_daily 取得失敗（継続処理）:", e.message);
      carelogSummary = {};
    }

    // 🧩 回答データを正規化
    let parsedAnswers = {};
    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const [key, value] = ans.split("=");
        if (key && value !== undefined) {
          parsedAnswers[key] = ["symptom", "sleep", "meal", "stress", "motion_level"].includes(key)
            ? parseInt(value)
            : value;
        }
      }
    } else if (typeof answers === "object" && answers !== null) {
      parsedAnswers = { ...answers };
    } else {
      throw new Error("answers形式が不正です");
    }

    // 🎯 GPT送信用のデータ生成
    const result = generateFollowupResult(parsedAnswers, context, carelogSummary);

    // 💾 Supabaseへ保存
    await supabaseMemoryManager.setFollowupAnswers(cleanLineId, parsedAnswers);

    // 🧠 userIdを取得
    const subscribedUsers = await supabaseMemoryManager.getSubscribedUsers();
    const matchedUser = subscribedUsers.find((u) => u.line_id === cleanLineId);
    const userId = matchedUser?.id;
    if (!userId) throw new Error(`❌ userId取得失敗: lineId=${cleanLineId}`);

    // ✅ GPT-5コメント生成
    const { gptComment, statusMessage, sections } =
      await sendFollowupResponse(userId, result.rawData);

    return {
      ...result,
      carelogSummary,
      sections: sections || null,
      gptComment:
        gptComment ||
        "診断コメントの生成に失敗しました。時間をおいて再試行してください。",
      statusMessage: statusMessage || "",
    };
  } catch (err) {
    console.error("❌ followupRouter 処理中エラー:", err);
    return {
      error: "再診処理中にエラーが発生しました。",
      gptComment:
        "通信エラーにより解析に失敗しました。時間をおいてもう一度お試しください。",
      statusMessage: "",
      sections: null,
    };
  }
}

module.exports = handleFollowupAnswers;
