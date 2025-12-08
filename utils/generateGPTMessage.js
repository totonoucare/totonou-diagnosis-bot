// utils/generateGPTMessage.js
// 🌿 トトノウくん伴走リマインダー（Responses API版）
// - legend_v1 / structure_v1 を共有辞書として利用
// - モチベーション・リスク予兆・季節アドバイスを統合

const { OpenAI } = require("openai");
const { createClient } = require("@supabase/supabase-js");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const supabaseMemoryManager = require("../supabaseMemoryManager");

// サービス3機能のコンセプト説明
const legend_v1 = require("./cache/legend_v1");
// データ構造・因果構造の説明
const structure_v1 = require("./cache/structure_v1");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function greeting() {
  return "こんにちは☺️";
}

function getTodayMeta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const weekdayJp = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  const month = now.getMonth() + 1;

  let seasonLabel = "季節の変わり目";
  if (month === 12 || month === 1 || month === 2) seasonLabel = "冬";
  else if (month >= 3 && month <= 5) seasonLabel = "春";
  else if (month >= 6 && month <= 8) seasonLabel = "夏";
  else if (month >= 9 && month <= 11) seasonLabel = "秋";

  return { date: `${y}-${m}-${d}`, weekdayJp, seasonLabel };
}

function toJSON(obj) {
  try {
    return JSON.stringify(obj ?? null, null, 2);
  } catch {
    return JSON.stringify({ _error: "unserializable" }, null, 2);
  }
}

/** 4日サイクル用のリマインド文を生成 */
async function buildCycleReminder({ context, advice, latestFollowup, careCounts }) {
  const { date, weekdayJp, seasonLabel } = getTodayMeta();

  const system = `
あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー「トトノウくん」です。

以下はサービスの全体像と、体質・ととのい度チェック・ケアログのデータ構造の説明です。  
内容を理解したうえで、ユーザー1人に向けた短いレターを1通だけ生成してください。

${legend_v1}

${structure_v1}

---

## ▼ このリマインドメッセージでやること

- 体質情報（contexts）、ととのい度チェック（followups）、ケアログ（care_logs_daily）を総合して、
  「この数日間の整い方の傾向」と「次の数日で意識したいポイント」を 1 通の手紙としてまとめる。
- 主な役割は、次の3つをひとまとめにしたレターにすること：
  1) モチベーション・継続のコーチング  
  2) 体質・最近の状態にもとづく“リスク予兆”の穏やかな可視化  
  3) 今日の季節感（${seasonLabel}）を踏まえた微調整アドバイス  

- 体質 × 最近のスコアの推移 × ケア実施状況 × 季節 をきちんと読み取り、  
  ユーザーにとって現実的で使いやすいヒントになるように言語化する。

---

## ▼ 出力ルール（レター用）

- 日本語で 200〜260 文字程度。短い手紙のように書く。
- 3〜5 行になるように適度に改行を入れる（1〜2文ごとに改行してよい）。
- スコアや点数、星の数など「数値の話」は出さない。
  - 例：「前より少しラク」「負担が溜まりやすいゾーン」などの表現に言い換える。
- 「次のととのい度チェックを受けてください」など、チェック受検を催促する文は書かない。
- 過度に不安をあおる言い方や、診断・病名を思わせる断定はしない。
  - 「この先、少し〇〇まわりに負担が出やすいタイプかもしれません」
    「気になるときは専門家にも相談してね」くらいの穏やかな表現にとどめる。
- ユーザーがすでによく続けているケア（careCounts が多い項目）は、
  「その調子で」「無理のない範囲で続けてみよう」と維持をねぎらう。
- 新しく勧めるケアは、ハードルをできるだけ下げる。
  - 例：「寝る前に1〜2回だけ深めの呼吸をしてみる」
        「朝イチに肩をゆっくり1回だけ回してみる」など。
- 絵文字は 1〜4 個程度。🌿🫶🍵💤 など落ち着いたものを中心に使う。
- 抽象的な一般論だけにならないように、
  体質（type / flowType / organType）や最近の状態に **結びつけた具体的コメント** を必ず1つ以上入れる。

---

## ▼ レターの骨組み（目安）

1. 冒頭：あいさつと、季節・最近の傾向への一言
2. 中盤：体質／最近の整い方／リスク予兆（手前ゾーン）をまとめたコメント
3. 後半：次の数日で意識したい 1〜2 個の具体的なケア＋一言エール
`.trim();

  const user = `
【今日】${date}（${weekdayJp}）
【推定季節】${seasonLabel}
【体質contexts】${toJSON(context || null)}
【直近のととのい度チェック】${toJSON(latestFollowup || null)}
【直近のケア実施日数（shortTerm）】${toJSON(careCounts || {})}
【アドバイス内容（advice）】${toJSON(advice || {})}
`.trim();

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  const promptText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const rsp = await openai.responses.create({
    model: "gpt-5.1",
    input: promptText,
    reasoning: { effort: "low" },
    text: { verbosity: "low" },
  });

  const text = rsp.output_text?.trim();
  return (
    text ||
    `${greeting()} 無理せず、自分のペースで“ととのう数日間”を過ごしていきましょうね🌿`
  );
}

async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);
    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // 体質コンテキスト
    const context = await supabaseMemoryManager.getContext(lineId);

    // 最新 followup（1件）
    const { data: fuRows, error: fuErr } = await supabase
      .from("followups")
      .select("symptom_level, sleep, meal, stress, motion_level, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fuErr) {
      console.warn("followups取得エラー:", fuErr.message);
    }

    const latestFollowup = fuRows?.[0] || null;

    // 直近期間のケア実施日数（shortTerm）
    const careCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
        lineId
      );

    // 前回チェック or context 作成日からの経過日数
    const lastDate = latestFollowup?.created_at
      ? new Date(latestFollowup.created_at)
      : context?.created_at
      ? new Date(context.created_at)
      : null;

    const diffDays = lastDate
      ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let msg;
    if (diffDays && diffDays >= 14) {
      // かなり間が空いたときは、まずはシンプルな声かけだけ
      msg = `${greeting()} 少し間が空きましたね🌱 最近の整い、どんな感じですか？\nゆっくりでも大丈夫☺️\nまた一緒に今の状態を見つめ直していきましょう🌿`;
    } else {
      // 通常サイクルのリマインドレター
      msg = await buildCycleReminder({
        context,
        advice: context?.advice,
        latestFollowup,
        careCounts,
      });
    }

    return msg;
  } catch (err) {
    console.error("⚠️ generateGPTMessage error:", err);
    return `${greeting()} [fallback] 無理せず、自分のペースで“ととのう数日間”を過ごしていきましょうね🌿`;
  }
}

module.exports = { generateGPTMessage };
