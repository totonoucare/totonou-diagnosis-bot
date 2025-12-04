// followup/responseSender.js（フィードバック特化版）
// =======================================
// 「トトノウくん」用レスポンス生成（2枚目フィードバックカード専用）
//
// - 役割：
//   ・前回と今回のととのい度チェックの差
//   ・前回〜今回のケア実施日数（care_logs）
//   ・体質コンテキスト（type, trait, flowType, organType, symptom, motion, advice）
//   を GPT に渡して、
//
//   👉 「ケアのがんばりが今回の結果にどう反映されていそうか」
//      だけを日本語でまとめてもらう。
//      （ケアの優先順位・頻度・スコアは一切出さない）
//
// - 返却フォーマット：
//   {
//     sections: null,          // Flex 変換は index 側で行う想定
//     gptComment: "<[CARD2]...[/CARD2]> 形式のテキスト",
//     statusMessage: "ok" | "no-context" | "error"
//   }
// =======================================

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ---------------------------
   小ユーティリティ
--------------------------- */

// null / undefined / "" を許容しつつ 1〜5 の数値に揃える
function normalizeScore(v, def = null) {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(v);
  if (Number.isNaN(n)) return def;
  return n;
}

// followup row から 5項目を正規化
function normalizeFollowupRow(row = {}) {
  return {
    symptom_level: normalizeScore(row.symptom, null),
    sleep: normalizeScore(row.sleep, null),
    meal: normalizeScore(row.meal, null),
    stress: normalizeScore(row.stress, null),
    motion_level: normalizeScore(row.motion_level, null),
  };
}

// GPT 呼び出し（テキスト一本返し）
async function callTotonouGPT(systemPrompt, userPrompt) {
  const promptText = `${systemPrompt}\n\n${userPrompt}`;

  const rsp = await openai.responses.create({
    model: "gpt-5",
    input: promptText,
    reasoning: { effort: "medium" },
    text: { verbosity: "medium" },
  });

  const text =
    (rsp.output_text && rsp.output_text.trim()) ||
    (rsp.output?.[0]?.content || [])
      .map((c) => c.text || "")
      .join("\n")
      .trim() ||
    "";

  // たまに ``` で囲んでくる個体対策
  return text.replace(/^```[\s\S]*?\n?|\n?```$/g, "").trim();
}

/* ---------------------------
   メイン：フォローアップフィードバック生成
--------------------------- */

const symptomLabels = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節",
  mental: "イライラや不安感",
  cold: "体温バランス・むくみ",
  skin: "頭髪や肌の健康",
  pollen: "花粉症・鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなく不調・不定愁訴",
};

/**
 * @param {number|string} userId  supabase上の users.id
 * @param {Object} rawData       followup/resultGenerator.js の rawData
 *   {
 *     symptom_level, sleep, meal, stress, motion_level,
 *     carelog: { habits, breathing, stretch, tsubo, kampo },
 *     start_date
 *   }
 */
async function sendFollowupResponse(userId, rawData = {}) {
  try {
    // 1. userId → lineId 取得
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const userRow = users.find((u) => u.id === userId);
    if (!userRow?.line_id) {
      throw new Error("userId に対応する line_id が見つかりません");
    }
    const lineId = userRow.line_id;

    // 2. コンテキスト取得（体質分析・アドバイス）
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context) {
      return {
        sections: null,
        gptComment:
          "初回の体質ケア情報が見つかりませんでした。体質分析から始めてみましょう🌿",
        statusMessage: "no-context",
      };
    }

    const symptomName =
      symptomLabels[context.symptom] || "不明な主訴（全身の不調）";
    const motionName = context.motion || "指定の動作";

    // 3. 直近2回の followup 履歴（前回と今回の差を見る）
    const { latest, prev } =
      await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);

    const curScores = {
      symptom_level: normalizeScore(rawData.symptom_level, null),
      sleep: normalizeScore(rawData.sleep, null),
      meal: normalizeScore(rawData.meal, null),
      stress: normalizeScore(rawData.stress, null),
      motion_level: normalizeScore(rawData.motion_level, null),
    };

    const prevScores = prev ? normalizeFollowupRow(prev) : null;

    // 差分（前回 → 今回）。正なら「改善傾向」、負なら「悪化傾向」くらいのニュアンスで。
    const diffs = prevScores
      ? {
          symptom_level:
            prevScores.symptom_level != null && curScores.symptom_level != null
              ? prevScores.symptom_level - curScores.symptom_level
              : null,
          sleep:
            prevScores.sleep != null && curScores.sleep != null
              ? prevScores.sleep - curScores.sleep
              : null,
          meal:
            prevScores.meal != null && curScores.meal != null
              ? prevScores.meal - curScores.meal
              : null,
          stress:
            prevScores.stress != null && curScores.stress != null
              ? prevScores.stress - curScores.stress
              : null,
          motion_level:
            prevScores.motion_level != null && curScores.motion_level != null
              ? prevScores.motion_level - curScores.motion_level
              : null,
        }
      : null;

    // 4. ケア実施日数（前回チェック〜今回）を取得
    let shortTermCareCounts = {};
    try {
      shortTermCareCounts =
        await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
          lineId
        );
    } catch (e) {
      console.warn("⚠️ care_logs 集計失敗（継続します）:", e.message);
      shortTermCareCounts = {};
    }

    const careCounts = {
      habits: shortTermCareCounts.habits ?? 0,
      breathing: shortTermCareCounts.breathing ?? 0,
      stretch: shortTermCareCounts.stretch ?? 0,
      tsubo: shortTermCareCounts.tsubo ?? 0,
      kampo: shortTermCareCounts.kampo ?? 0,
    };

    // 5. GPT 用プロンプト構成
    const systemPrompt = `
あなたは『トトノウくん』🧘‍♂️です。
東洋医学と身体構造の観点から、ユーザーの「整い具合」とセルフケアの関係を
やさしく言葉にしてあげる役割です。

今回あなたにしてほしいことは１つだけです：

👉 「この期間にがんばってきたケアが、今回のととのい度チェック結果に
　　どう反映されていそうか」を、日本語でフィードバックすること。

※重要な制約：
- ケアの「優先順位」「頻度」「回数のノルマ」は提案しないこと。
- 「もっとやりましょう」と責めるのではなく、
  ・できていることをまず認める
  ・その上で「ここを足していくと、より整いやすそう」というやわらかい提案までにとどめる。
- 「点数」「％」「スコア」という言い方はできるだけ避ける。
  → 数字が出る場合も、「〜が少し良い方向に動いています」のようなニュアンスにする。
- 体調項目やケア項目の内部キー（symptom_level, motion_level など）はそのまま書かず、
  日本語の説明（主訴のつらさ、睡眠の状態、動作テストのつらさ など）で表現する。
`.trim();

    // prev がない＝初回 followup の場合の説明文
    const isFirstFollowup = !prevScores;

    const userPrompt = `
【体質・主訴の情報】
- 体質タイプ: ${context.type || "未登録"}
- 体質の特徴: ${context.trait || "未登録"}
- 流れのタイプ(flowType): ${context.flowType || "未登録"}
- 経絡ライン(organType): ${context.organType || "未登録"}
- 主訴カテゴリ（ユーザーが一番気にしているところ）: ${symptomName}
- 動作テストの対象動作: ${motionName}

【ケア内容の概要（advice）】
ユーザーには次の5つのケア柱が提案されています：
- 体質改善習慣(habits): ${JSON.stringify(
      (context.advice || [])[0] || {},
      null,
      2
    )}
- 呼吸法(breathing): ${JSON.stringify(
      (context.advice || [])[1] || {},
      null,
      2
    )}
- 経絡ストレッチ(stretch): ${JSON.stringify(
      (context.advice || [])[2] || {},
      null,
      2
    )}
- 指先・ツボほぐし(tsubo): ${JSON.stringify(
      (context.advice || [])[3] || {},
      null,
      2
    )}
- 漢方・サプリ(kampo): ${JSON.stringify(
      (context.advice || [])[4] || {},
      null,
      2
    )}

【今回のととのい度チェック（1=楽・整っている〜5=つらい・乱れ）】
- 主訴を含む体調レベル(symptom_level): ${curScores.symptom_level}
- 睡眠の状態(sleep): ${curScores.sleep}
- 食事の状態(meal): ${curScores.meal}
- ストレス・気分の安定度(stress): ${curScores.stress}
- 動作テストのつらさ(motion_level): ${curScores.motion_level}

${
  isFirstFollowup
    ? `【前回との比較】
- 今回は「初回のととのい度チェック」です。
- 過去との比較データはありません。`
    : `【前回との比較（前回 → 今回）】
- 主訴を含む体調レベル: ${prevScores.symptom_level} → ${curScores.symptom_level}（差分: ${
        diffs.symptom_level
      }）
- 睡眠: ${prevScores.sleep} → ${curScores.sleep}（差分: ${diffs.sleep}）
- 食事: ${prevScores.meal} → ${curScores.meal}（差分: ${diffs.meal}）
- ストレス: ${prevScores.stress} → ${curScores.stress}（差分: ${diffs.stress}）
- 動作テストのつらさ: ${
        prevScores.motion_level
      } → ${curScores.motion_level}（差分: ${diffs.motion_level}）`
}

【この期間に行われたケア実施日数（前回チェック〜今回）】
- 体質改善習慣(habits): ${careCounts.habits} 日
- 呼吸法(breathing): ${careCounts.breathing} 日
- 経絡ストレッチ(stretch): ${careCounts.stretch} 日
- 指先・ツボほぐし(tsubo): ${careCounts.tsubo} 日
- 漢方・サプリ(kampo): ${careCounts.kampo} 日

---

## あなたがやること（CARD2 だけを返してください）

上記の情報を踏まえて、

1. ユーザーの「がんばり」と「それが体調の変化にどう結びついていそうか」を、
   冒頭の一文（LEAD）でやさしくまとめてください。
   - 良くなっているところがあれば、そこを具体的にほめる。
   - 変化が少ないところは「まだこれから変わっていく途中」くらいのニュアンスで。

2. そのあと 2〜3 行のフィードバック（PLAN1〜3）として、
   各ケア柱ごとに「どんな意味があって」「今回の結果から何が読み取れそうか」を書いてください。
   - ここでは優先順位や頻度は出さず、
     「呼吸法はこういう変化を支えていそう」「ストレッチが動作テストとこう結びついていそう」
     といった“意味づけ・振り返り”に徹してください。
   - pillar には 「呼吸法」「体質改善習慣」「ストレッチ」「ツボ」「漢方」などのラベルを入れてください。
   - reason に日本語の文章を入れてください。
   - freq / link は出さなくてかまいません（入っていても構いませんが、UIでは使いません）。

3. 最後に FOOTER として、
   「うまくいっている点を土台にしながら、今日できた1回を積み重ねていこう」
   といった励ましのメッセージを1〜2文で書いてください。

【出力フォーマット（CARD2 のみ）】
必ず次の形で返してください。前後に余計な文章やコードフェンスは付けないこと。

[CARD2]
LEAD: <今回のフィードバックの総括メッセージ>
PLAN1: pillar=<ケア柱名> | reason=<フィードバック本文> 
PLAN2: pillar=<ケア柱名> | reason=<フィードバック本文> 
PLAN3: pillar=<ケア柱名> | reason=<フィードバック本文>  // 3つめは省略可
FOOTER: <最後の一言メッセージ>
[/CARD2]

`.trim();

    const gptComment = await callTotonouGPT(systemPrompt, userPrompt);

    if (!gptComment) {
      return {
        sections: null,
        gptComment:
          "トトノウくんが今回のフィードバックをうまくまとめられませんでした🙏 また少し時間をおいて試してみてください。",
        statusMessage: "error",
      };
    }

    return {
      sections: null, // Flex変換は followup/index.js 側で実施
      gptComment,
      statusMessage: "ok",
    };
  } catch (err) {
    console.error("❌ sendFollowupResponse error:", err);
    return {
      sections: null,
      gptComment:
        "今週のケアフィードバック生成中にエラーが発生しました。時間をおいて再試行してください🙏",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
