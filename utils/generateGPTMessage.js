// utils/generateGPTMessage.js
// ===============================================
// 🌿 トトノウくん：レター型リマインダー生成（理由がわかる系）
// - 体質(contexts) / ととのい度チェック(followups) / ケアログ(care_logs_daily)
//   をもとに、
//   「最近の体調・気分のゆらぎ」と「崩れやすいポイント」を
//   やさしく言語化した短いメッセージを生成する。
// - 行動指示（〜してみてね等）は一切書かず、
//   「あ、だから最近こうなってるのかも」と腑に落ちる説明だけを返す。
// ===============================================

const { OpenAI } = require("openai");
const { getUserIdFromLineId } = require("./getUserIdFromLineId");
const supabaseMemoryManager = require("../supabaseMemoryManager");
const legend_v1 = require("./cache/legend_v1");
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
  return { date: `${y}-${m}-${d}`, weekdayJp };
}

/**
 * 最近のゆらぎ理由レターを GPT-5.1 で生成
 * - 「なぜ今その傾向が出ていそうか」を、体質×スコア×ケア実績から説明する。
 * - 具体的な行動・チェック・ボタン操作などの指示は一切書かない。
 */
async function buildReasonLetter({ context, followups, careCounts }) {
  const { date, weekdayJp } = getTodayMeta();

  const ctx = context || null;
  const latest = followups?.latest || null;
  const prev = followups?.prev || null;

  const ctxJson = JSON.stringify(ctx ?? null, null, 2);
  const latestJson = JSON.stringify(latest ?? null, null, 2);
  const prevJson = prev ? JSON.stringify(prev, null, 2) : null;
  const careJson = JSON.stringify(careCounts || {}, null, 2);

  // 🧠 レター専用の system プロンプト
  const system = `
あなたは『ととのうケアナビ』（東洋医学×AIセルフケア支援サービス）のAIパートナー「トトノウくん」です。

### あなたの役割
- 体質タイプ情報（contexts）・ととのい度チェックの推移（followups）・ケア実施日数（care_logs_daily）を読み取り、
  **「最近の体調や気分のゆらぎ」と「いま崩れやすいポイント」** を短い日本語メッセージとして説明してください。
- 目的は、
  「あ、だから最近こうなってるのかも」とユーザー自身が軽く納得できるように
  “今のからだのストーリー”を言語化してあげることです。
- 具体的な行動指示や、「〜してみてね」といった次のアクションは一切書きません。

### 入力として与えられるデータ
- contexts：体質・巡り・経絡ライン・主訴などの情報。
- followups.latest：直近のととのい度チェック。
- followups.prev：1つ前のととのい度チェック（あれば）。
- shortTermCareCounts：前回チェック〜今回までの各ケアの実施日数。

これらをもとに、
- 「どのあたりが少し揺らぎやすい時期か」
- 「その背景に、体質や巡り・ラインのどんなクセが関係していそうか」
を、やさしい日本語で 1 通にまとめてください。

### 出力仕様（このレター専用ルール）
- 全体で 150〜230文字程度。
- 必ず **3つの段落** に分け、段落と段落のあいだに **空行を1行** 入れてください。
- 文体・トーン：
  - 温かく落ち着いた口調。親しみやすいが、子どもっぽくなりすぎない。
  - 絵文字は 2〜4個程度まで（🌿🍃🕊️😌 など柔らかいもの）。
  - 「整う」「めぐる」「ゆるめる」「波」「サイン」といった自然な言葉を使う。

### 禁止事項
- 具体的な行動提案・指示を書かない：
  - 例：  
    - 「○○のケアをやってみてね」  
    - 「△△を始めましょう」  
    - 「次のととのい度チェックを受けてください」  
    - 「実施記録ボタンを押して記録してね」  
  こうした表現は一切禁止とする。
- 「スコア」「数値」「1〜5」など、点数や尺度を直接ユーザーに説明しない。
- 内部カラム名（symptom_level, sleep, motion_level など）や JSON 構造をそのまま出力しない。
- サービス名やテーブル名（contexts / followups / care_logs_daily など）を出さない。

### 表現上のヒント
- もしケア実施日数（shortTermCareCounts）が多いケアがあれば、
  「最近は○○を土台に整えようとしている時期」といったニュアンスで評価してよい
- followups.prev がない場合（初回チェックのみ）のときは、
  「これからこの波を一緒に見ていく入り口の時期」といった説明に寄せてよい。
- 体調がツラめの方向に寄っている場合も、体質的な理由もあるため
  無理して変えようと焦らなくていいという受け止めの一文を最後に添えるとよい。

---

【参考情報（内部仕様。ユーザーにはそのまま見せないこと）】

以下にサービス全体像・データ構造・因果関係の詳細を記載します。
推論のための前提として利用し、メッセージ内には内部用語は出さないでください。

--- サービス概要（legend_v1） ---
${legend_v1}

--- データ構造と因果の詳細（structure_v1） ---
${structure_v1}
`.trim();

  // ユーザー側ペイロード：そのまま JSON を渡してよい（ただし出力には使わせない）
  const user = `
【今日】${date}（${weekdayJp}）

【contexts（体質データ）】
${ctxJson}

【followups.latest（直近のととのい度チェック）】
${latestJson}
${
  prevJson
    ? `\n【followups.prev（1つ前のととのい度チェック）}\n${prevJson}\n`
    : ""
}

【shortTermCareCounts（前回チェック〜今回の各ケア実施日数）】
${careJson}
  `.trim();

  const rsp = await openai.responses.create({
    model: "gpt-5.1",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
  });

  const text = rsp.output_text?.trim();
  return (
    text ||
    `${greeting()} 無理せず、自分のペースで、いまのからだの波をそっと見守っていきましょうね🌿`
  );
}

/**
 * 外部呼び出し用：LINEユーザーIDからプッシュ用メッセージを生成
 */
async function generateGPTMessage(lineId) {
  try {
    console.log("[reminder] start lineId:", lineId);

    const userId = await getUserIdFromLineId(lineId);
    if (!userId) throw new Error("該当ユーザーが見つかりません");

    // 1. 体質コンテキスト
    const context = await supabaseMemoryManager.getContext(lineId);

    // 2. ととのい度チェック（直近・1つ前）
    const followups = await supabaseMemoryManager.getLastTwoFollowupsByUserId(
      userId
    );
    const latest = followups?.latest || null;

    // 3. ケア実施日数（前回チェック〜今回）
    const careCounts =
      await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
        lineId
      );

    // データが何もない場合は素朴なフォールバック
    if (!context && !latest) {
      return (
        `${greeting()} まだ体質タイプ分析やととのい度チェックのデータが見当たりませんでした😌\n` +
        "まずはメニューから体質分析を受けておくと、からだの波が追いかけやすくなりますよ🌿"
      );
    }

    // GPT による「理由がわかるレター」を生成
    const msg = await buildReasonLetter({
      context,
      followups,
      careCounts,
    });

    return msg;
  } catch (err) {
    console.error("⚠️ generateGPTMessage error:", err);
    return (
      `${greeting()} [fallback] 無理せず、自分のペースで“ととのう”時間をまた思い出してもらえたらうれしいです🌿`
    );
  }
}

module.exports = { generateGPTMessage };
