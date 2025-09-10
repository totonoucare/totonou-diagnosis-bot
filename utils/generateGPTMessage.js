// utils/generateGPTMessage.js
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function pickTone() {
  const r = Math.random();
  return r < 0.45 ? "uranai" : "mame";
}
const greeting = () => "こんにちは！";

function getTodayMeta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const date = `${y}-${m}-${d}`;
  const weekdayJp = ["日","月","火","水","木","金","土"][now.getDay()];
  return { date, weekdayJp };
}

function seasonalHint({ date, weekdayJp }) {
  return [
    `- 今日の日付: ${date}（${weekdayJp}）`,
    "- 季節・二十四節気・五行は日本（北半球）基準で解釈",
    "- 天気の推測はしない（雨/晴れは書かない）",
  ].join("\n");
}

function extractStatusFlag(fu = null) {
  if (!fu) return null;
  const n = v => (v == null ? null : Number(v));
  if (n(fu.symptom_level) >= 4) return "体調がやや不調";
  if (n(fu.sleep)        >= 4) return "睡眠が乱れ気味";
  if (n(fu.stress)       >= 4) return "ストレス高め";
  if (n(fu.meal)         >= 4) return "食事が乱れ気味";
  return null;
}

async function buildConstitutionSeasonalReminder({
  constitution, trait, flowType, organType, chiefSymptom, advice,
  date, weekdayJp, tone, statusFlag
}) {
  const styleLine = tone === "uranai"
    ? "占い風（控えめに吉/巡りのニュアンス）"
    : "豆知識風（読む人が“へぇ”と感じるような小ネタ。ただし『へぇ〜』という表現は書かない。具体アクションを1つ添える）";

  const sys = `
あなたは東洋医学に詳しい親しみやすい伴走AI。
体質と季節の文脈を組み合わせ、LINE通知向けの短い一言リマインドを作る。

【厳守】
- 出力は必ず「${greeting()}」で始める
- 本文は 70〜110文字（挨拶込みで全体 100〜150目安）
- 絵文字は0〜2個まで
- 天気の推測は禁止
- 医療断定は禁止
- followup状況があれば “1点だけ” 触れる
- トーン：${styleLine}
  `.trim();

  const contextLines = [
    constitution ? `体質: ${constitution}` : null,
    trait        ? `体質説明: ${trait}` : null,
    flowType     ? `気の偏り: ${flowType}` : null,
    organType    ? `負担臓腑: ${organType}` : null,
    chiefSymptom ? `主なお悩み: ${chiefSymptom}` : null,
  ].filter(Boolean).join(" / ");

  const statusLine = statusFlag ? `【直近の状況】${statusFlag}` : "【直近の状況】なし";

  const user = `
【体質コンテキスト】
${contextLines || "不明"}

【季節ヒント】
${seasonalHint({ date, weekdayJp })}

【ケア提案（初回）】
${advice ? JSON.stringify(advice) : "（未登録）"}

${statusLine}
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // ← ここを gpt-4o に
    messages: [
      { role: "system", content: sys },
      { role: "user",   content: user },
    ]
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  console.log("[gm] OAI text:", text?.slice(0, 80));
  return text;
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[gm] start lineId:", lineId);

    const userId = await getUserIdFromLineId(lineId);
    console.log("[gm] userId:", userId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // contexts
    const { data: ctxRows } = await supabase
      .from("contexts")
      .select("type, trait, flowType, organType, symptom, advice, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const mmContext = await supabaseMemoryManager.getContext(lineId) || {};
    const latestContext = ctxRows?.[0] || {};
    console.log("[gm] context:", latestContext);

    const constitution = latestContext?.type || mmContext?.type || null;
    const trait        = latestContext?.trait || mmContext?.trait || null;
    const flowType     = latestContext?.flowType || mmContext?.flowType || null;
    const organType    = latestContext?.organType || mmContext?.organType || null;
    const chiefSymptom = latestContext?.symptom || mmContext?.symptom || null;
    const advice       = latestContext?.advice || mmContext?.advice || null;

    // followups
    const { data: fuRows } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, created_at, id")
      .eq("user_id", userId)
      .or("symptom_level.not.is.null,sleep.not.is.null,meal.not.is.null,stress.not.is.null")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);
    const latestFollowup = fuRows?.[0] || null;
    console.log("[gm] followup:", latestFollowup);

    const statusFlag = extractStatusFlag(latestFollowup);

    // GPT生成
    const { date, weekdayJp } = getTodayMeta();
    const tone = pickTone();
    console.log("[gm] tone/date:", tone, date, weekdayJp);

    const msg = await buildConstitutionSeasonalReminder({
      constitution, trait, flowType, organType, chiefSymptom, advice,
      date, weekdayJp, tone, statusFlag,
    });

    if (msg) return msg;

    console.warn("[gm] OpenAI返却が空 → fallback");
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのうケア”を続けていきましょうね🌱`;
  } catch (error) {
    console.error("⚠️ GPTメッセージ生成エラー:", error?.response?.data || error);
    return `${greeting()} [fallback] リマインドの生成に失敗しました。次回の診断で状況をお聞かせください😊`;
  }
}

module.exports = { generateGPTMessage };
