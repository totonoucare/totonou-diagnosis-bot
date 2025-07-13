// followup/followupRouter.js

const generateFollowupResult = require("./resultGenerator");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const { sendFollowupResponse } = require("./responseSender");

/**
 * フォローアップ回答を処理し、GPTコメント付き結果を返す
 * @param {string} lineId - LINEユーザーの一意なID（supabaseMemoryManagerが要求するID）
 * @param {Array|string|object} answers - ユーザーの回答（形式に応じて処理分岐）
 * @returns {Promise<Object>} - GPTコメント付きの再診結果
 */
async function handleFollowupAnswers(lineId, answers) {
  try {
    const cleanLineId = lineId.trim();

    // 📡 context取得（lineId使用）
    const context = await supabaseMemoryManager.getContext(cleanLineId);
    if (!context) throw new Error(`❌ context取得失敗: lineId = ${cleanLineId}`);

    // 🧩 answers の形式チェック＆解析
    let parsedAnswers = {};
    if (Array.isArray(answers)) {
      for (const ans of answers) {
        const [key, value] = ans.split("=");
        if (key && value !== undefined) {
          switch (key) {
            case "Q4":
              parsedAnswers.motion_level = parseInt(value);
              break;
            case "Q5":
              parsedAnswers.q5_answer = value.startsWith("q5_answer=")
                ? value.split("=")[1]
                : value;
              break;
            case "symptom":
            case "general":
            case "sleep":
            case "meal":
            case "stress":
              parsedAnswers[key] = parseInt(value);
              break;
            case "habits":
            case "breathing":
            case "stretch":
            case "tsubo":
            case "kampo":
              parsedAnswers[key] = value;
              break;
            default:
              parsedAnswers[key] = value;
              break;
          }
        }
      }
    } else if (typeof answers === "object" && answers !== null) {
      parsedAnswers = { ...answers };
    } else {
      throw new Error("answers形式が不正です");
    }

    // 🎯 再診結果の生成
    const result = generateFollowupResult(parsedAnswers, context);

    // 💾 Supabaseへ保存（lineId使用）
    await supabaseMemoryManager.setFollowupAnswers(cleanLineId, parsedAnswers);

    // 🤖 GPTコメント生成（userIdの取得は内部で行う）
    const subscribedUsers = await supabaseMemoryManager.getSubscribedUsers();
    const matchedUser = subscribedUsers.find((u) => u.line_id === cleanLineId);
    const userId = matchedUser?.id;

    if (!userId) throw new Error(`❌ userIdが取得できません: lineId=${cleanLineId}`);

    const { gptComment, statusMessage } = await sendFollowupResponse(userId, result.rawData);

    return {
      ...result,
      gptComment: gptComment || "診断コメントの生成に失敗しました。時間をおいて再試行してください。",
      statusMessage: statusMessage || "",
    };
  } catch (err) {
    console.error("❌ 再診処理中にエラー:", err);
    return {
      error: "再診処理中にエラーが発生しました。",
      gptComment: "通信エラーにより解析に失敗しました。時間を置いてもう一度お試しください。",
      statusMessage: "",
    };
  }
}

module.exports = handleFollowupAnswers;
