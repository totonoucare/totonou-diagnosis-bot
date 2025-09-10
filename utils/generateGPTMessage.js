// utils/generateGPTMessage.js
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ─────────────────────────────────────────────────────
 * ランダムトーン：占い or 豆知識（ジョーク無し）
 * ────────────────────────────────────────────────────*/
function pickTone() {
  const r = Math.random();
  return r < 0.45 ? "uranai" : "mame";
}

/** あいさつは固定（11時前後配信を想定） */
const greeting = () => "こんにちは！";

/** 日付・曜日 */
function getTodayMeta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const date = `${y}-${m}-${d}`;
  const weekdayJp = ["日","月","火","水","木","金","土"][now.getDay()];
  return { date, weekdayJp };
}

/** 季節ヒント（天気は使わない） */
function seasonalHint({ date, weekdayJp }) {
  return [
    `- 今日の日付: ${date}（${weekdayJp}）`,
    "- 季節・二十四節気・五行は日本（北半球）基準で解釈",
    "- 天気の推測はしない（雨/晴れは書かない）",
  ].join("\n");
}

/** followups から “今触れるならこの1点だけ”（1=理想, 5=乱れ） */
function extractStatusFlag(fu = null) {
  if (!fu) return null;
  const n = v => (v == null ? null : Number(v));

  // 優先度：体調 → 睡眠 → ストレス → 食事
  if (n(fu.symptom_level) != null && n(fu.symptom_level) >= 4) return "体調がやや不調";
  if (n(fu.sleep)         != null && n(fu.sleep)        >= 4) return "睡眠が乱れ気味";
  if (n(fu.stress)        != null && n(fu.stress)       >= 4) return "ストレス高め";
  if (n(fu.meal)          != null && n(fu.meal)         >= 4) return "食事が乱れ気味";
  return null;
}

/** 体質×季節の “日替わりリマインド” 生成（GPT-5固定） */
async function buildConstitutionSeasonalReminder({
  constitution, trait, flowType, organType, chiefSymptom, advice,
  date, weekdayJp, tone, statusFlag
}) {
  const styleLine = tone === "uranai"
    ? "占い風（控えめに吉/巡りのニュアンス。誇張しすぎない）"
    : "豆知識風（へぇ〜となる一言＋具体アクションを1つ）";

  const sys = `
あなたは東洋医学に詳しい、親しみやすい伴走AI。
ユーザーの体質（例: 気虚/血虚/陽虚/実熱/瘀血/水滞…）と今日の季節文脈（二十四節気・五行・曜日）を掛け合わせ、
LINE通知向けの短い一言リマインドを作る。

【厳守】
- 出力は必ず「${greeting()}」で始める
- 本文は 70〜110文字（挨拶を含めて全体 100〜150目安）
- 絵文字は0〜2個まで
- 天気の推測はしない（雨/晴れは書かない）
- 医療断定は避け、やさしく提案
- 具体アクションを1つ入れる（例: 深呼吸/首を温める/白い食材を一口）
- followupの状況があれば “触れるのは1点だけ”。なければ触れない
- トーン：${styleLine}
  `.trim();

  const contextLines = [
    constitution ? `体質: ${constitution}` : null,
    trait        ? `体質説明: ${trait}` : null,
    flowType     ? `気の偏り: ${flowType}` : null,
    organType    ? `負担臓腑: ${organType}` : null,
    chiefSymptom ? `主なお悩み: ${chiefSymptom}` : null,
  ].filter(Boolean).join(" / ");

  const statusLine = statusFlag ? `【直近の状況（任意/最大1つ）】${statusFlag}` : "【直近の状況】なし";

  const user = `
【体質コンテキスト】
${contextLines || "不明"}

【季節ヒント】
${seasonalHint({ date, weekdayJp })}

【ケア提案（初回の要点。可能なら一部を活かす）】
${advice ? JSON.stringify(advice) : "（未登録）"}

${statusLine}

【出力条件】
- 先頭は「${greeting()}」で始める
- その後に体質×季節ベースの短文（70〜110文字）
- 丁寧すぎず親しみやすい口調
  `.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-5",               // GPT-5固定：temperature/top_pは指定しない
    messages: [
      { role: "system", content: sys },
      { role: "user",   content: user },
    ],
    max_completion_tokens: 220
  });

  return completion.choices?.[0]?.message?.content?.trim();
}

async function generateGPTMessage(lineId) {
  try {
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // 1) contexts（必ずある想定）—必要な列だけ取得
    const { data: ctxRows, error: ctxErr } = await supabase
      .from("contexts")
      .select("type, trait, flowType, organType, symptom, advice, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (ctxErr) console.error("contexts fetch error:", ctxErr);

    // 念のための互換（実運用では contexts が無いケースは想定しない）
    const mmContext = await supabaseMemoryManager.getContext(lineId) || {};
    const latestContext = ctxRows?.[0] || {};

    const constitution = latestContext?.type || mmContext?.type || latestContext?.trait || mmContext?.trait || null;
    const trait        = latestContext?.trait || mmContext?.trait || null;
    const flowType     = latestContext?.flowType || mmContext?.flowType || null;
    const organType    = latestContext?.organType || mmContext?.organType || null;
    const chiefSymptom = latestContext?.symptom || mmContext?.symptom || null;
    const advice       = latestContext?.advice || mmContext?.advice || null;

    // 2) followups（無いことあり）—必要な列だけ取得
    const { data: fuRows, error: fuErr } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fuErr) console.error("followups fetch error:", fuErr);
    const latestFollowup = fuRows?.[0] || null;
    const statusFlag = extractStatusFlag(latestFollowup); // 無ければ null

    // 3) 常に「体質×季節」を芯に生成（contextsベース）
    const { date, weekdayJp } = getTodayMeta();
    const tone = pickTone();
    const msg = await buildConstitutionSeasonalReminder({
      constitution, trait, flowType, organType, chiefSymptom, advice,
      date, weekdayJp, tone, statusFlag,
    });

    if (msg) return msg;

    // 4) APIが空返却 or 想定外エラー時の最終フォールバック（固定文）
    return `${greeting()} 無理せず、自分のペースで“ととのうケア”を続けていきましょうね🌱`;
  } catch (error) {
    console.error("⚠️ GPTメッセージ生成エラー:", error);
    return `${greeting()} リマインドの生成に失敗しました。次回の診断で状況をお聞かせください😊`;
  }
}

module.exports = { generateGPTMessage };
