// followup/responseSender.js
// =======================================
// ととのい度チェック結果をまとめて
// 「トトノウくん」からの2枚カード(JSON)を生成する。
// - 行動スコア（直近8日間のcarelog）
// - 体調反映度（前回→今回の変化）
// - 総合整い度（星）
// - 停滞してたら派生ケア or 相談提案ルール
//
// 返却フォーマット：
// {
//    sections: { card1:{...}, card2:{...} },
//    gptComment: <フォールバック用テキスト>,
//    statusMessage: "ok"|"error"|"no-context"
// }
// =======================================

const OpenAI = require("openai");
const supabaseMemoryManager = require("../supabaseMemoryManager");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------------------
   1) データ整形・スコア計算ユーティリティ
--------------------------- */

// 回答の正規化（null→デフォ3）
function normalizeFollowup(ans = {}) {
  const n = (v, def) =>
    v === null || v === undefined || v === "" ? def : Number(v);

  return {
    symptom_level: n(ans.symptom_level, 3),
    sleep: n(ans.sleep, 3),
    meal: n(ans.meal, 3),
    stress: n(ans.stress, 3),
    motion_level: n(ans.motion_level, 3),
  };
}

/**
 * 体調反映度スコア（0〜100）
 * - 前回より改善したら上がる
 * - 前回ないなら50点ベース
 */
function calcReflectionScore(prevN, curN) {
  if (!prevN || !curN) {
    // 初回は中間値くらいにする
    const reflectionScore = 50;
    const starsNum = Math.max(
      1,
      Math.min(5, Math.ceil(reflectionScore / 20))
    );
    return {
      reflectionScore,
      reflectionStarsNum: starsNum,
      reflectionStarsText:
        "★".repeat(starsNum) + "☆".repeat(5 - starsNum),
      reflectionDelta: null, // 前回比なし
    };
  }

  // 各指標の改善幅（前回 - 今回）。プラスほど改善。
  const diffs = [
    prevN.symptom_level - curN.symptom_level,
    prevN.sleep - curN.sleep,
    prevN.meal - curN.meal,
    prevN.stress - curN.stress,
    prevN.motion_level - curN.motion_level,
  ];

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  // avgDiff=0なら60点くらい→そこから±10*改善度
  const raw = 60 + avgDiff * 10; // 改善(1段階)で+10点くらい
  const bounded = Math.max(0, Math.min(100, Math.round(raw)));

  // 星は 0〜100 → 1〜5
  const starsNum = Math.max(1, Math.min(5, Math.ceil(bounded / 20)));

  // 前回比（体調反映度そのものの変化）を知りたいので
  // prevReflectionScore を「前回vsその一つ前」から再計算したい
  // → ここでは prevN が「今回の前回」なので、
  //    さらに一個前はこの関数外で扱うほうが自然。
  //    なのでここは delta=null。後で上位ロジックで埋める。

  return {
    reflectionScore: bounded,
    reflectionStarsNum: starsNum,
    reflectionStarsText:
      "★".repeat(starsNum) + "☆".repeat(5 - starsNum),
    reflectionDelta: null,
  };
}

/**
 * 行動スコア（0〜100, 点数として使う）
 * - 直近8日間のケア実績（5本柱）合計 / 理論上の最大実施数
 * - days=8, 1日 最大5pillars=5回 として 8*5=40回を100点
 */
function calcActionScore(careCounts, effectiveDays) {
  const total = Object.values(careCounts).reduce(
    (a, b) => a + b,
    0
  );
  const maxPossible = effectiveDays * 5;
  const ratio = maxPossible > 0 ? total / maxPossible : 0;
  const rawScore = Math.round(Math.min(1, ratio) * 100);
  return { actionScoreRaw: rawScore, totalActions: total };
}

/**
 * 利用開始直後の人への補正
 * - サービス開始から14日未満は、行動スコアを日数/14でスケール
 *   (4日目なら ~0.28倍しかやれないのが普通 → 逆に持ち上げたいので 1/0.28 ≒ 3.5倍
 *   になってしまうと過補正。なので補正は逆に "まだ低くても気にしない"
 *   =下駄を履かせる rather than 圧縮する)
 *
 * ここでは下駄方式: minBoost = 0.6
 * - 日数<14 の場合、行動スコア = max(行動スコア, floor(60 * (日数/14)))
 *   → 最初の数日は 0 点じゃなくて少なくとも20〜40点帯からスタート
 */
function applyEarlyUserBoost(actionScoreRaw, daysSinceStart) {
  if (daysSinceStart == null || isNaN(daysSinceStart)) {
    return actionScoreRaw;
  }
  if (daysSinceStart >= 14) {
    return actionScoreRaw;
  }

  // ベースライン 60点を日数でスケール
  const baseline = Math.floor((60 * daysSinceStart) / 14); // 0〜60
  return Math.max(actionScoreRaw, baseline);
}

/**
 * 総合整い度 = 行動(40%) + 体調反映度(60%)
 * 表示は星（1〜5）＋カラーバー用の数値
 */
function calcTotalScore(actionScoreFinal, reflectionScore) {
  const combined = Math.round(
    actionScoreFinal * 0.4 + reflectionScore * 0.6
  );
  const starsNum = Math.max(
    1,
    Math.min(5, Math.ceil(combined / 20))
  );
  return {
    totalScore: combined,
    totalStarsNum: starsNum,
    totalStarsText:
      "★".repeat(starsNum) + "☆".repeat(5 - starsNum),
  };
}


/**
 * careCounts を「AIスコア評価用」に丸める補正（密度算出向け）
 * - Supabase上では実際の押下回数（count）を保持。
 * - AIには「そのpillarを実施した日数」として扱わせる。
 * - 上限8日などのクリップは行わない。
 *   （分母となる effectiveDays が別で決まるため、密度計算で自動的に正規化される）
 */
function normalizeCareCountsPerDay(careCounts) {
  if (!careCounts || typeof careCounts !== "object") return {};

  const normalized = {};
  for (const [pillar, count] of Object.entries(careCounts)) {
    // 1日でも実施していれば1日分としてカウント（重複押しはまとめる）
    const n = Number(count) || 0;
    normalized[pillar] = n > 0 ? 1 : 0;
  }

  return normalized;
}

/**
 * 体調反映度の停滞判定に使うヘルパ
 * returns { isStuck2Times: boolean, severity: "mild"|"heavy"|null }
 */
function judgeStagnation(reflectionHistory) {
  // reflectionHistory: [prevPrevScore, prevScore, curScore] みたいな配列（古→新）
  // 最低2件必要。3件あれば「2回連続停滞」も評価できる。
  if (!Array.isArray(reflectionHistory) || reflectionHistory.length < 2) {
    return { isStuck2Times: false, severity: null };
  }

  // 最新2件（直近2チェック）で評価
  const len = reflectionHistory.length;
  const last = reflectionHistory[len - 1]; // 今回
  const prev = reflectionHistory[len - 2]; // 前回

  // 「変化しない」= 絶対差が 5点未満ぐらい、とかでもいいけど
  // ここでは「ほぼ変化なし」を abs(diff)<5 とする
  const diffAbs = Math.abs(last - prev);
  const noChange = diffAbs < 5;

  if (!noChange) {
    return { isStuck2Times: false, severity: null };
  }

  // 60点未満か？
  if (last < 40) {
    return { isStuck2Times: true, severity: "heavy" };
  }
  if (last < 60) {
    return { isStuck2Times: true, severity: "mild" };
  }
  return { isStuck2Times: false, severity: null };
}

/* ---------------------------
   2) GPT呼び出しラッパ
--------------------------- */

// GPT-5 (Responses API) から card1/card2 のJSONをもらう
async function callTotonouGPT(systemPrompt, userPrompt) {
  try {
    const rsp = await openai.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],

    });

    // 安全にJSON抽出
    let raw = rsp.output_text || "";
    raw = raw.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }

    // JSONパース（壊れたら{}扱い）
    try {
      return JSON.parse(raw);
    } catch {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s >= 0 && e > s) {
        try {
          return JSON.parse(raw.slice(s, e + 1));
        } catch {
          /* ignore */
        }
      }
      return null;
    }
  } catch (err) {
    console.error("❌ callTotonouGPT error:", err);
    return null;
  }
}

/* ---------------------------
   3) メイン：フォローアップのAIレスポンス
--------------------------- */

// --- symptomラベル辞書（英語→日本語変換用） ---
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
 * @param {string} userId - users.id (UUID)
 * @param {object} followupAnswers - 今回の回答（setFollowupAnswers直前に組んだやつ）
 */
async function sendFollowupResponse(userId, followupAnswers) {
  try {
    // 1. userId→lineId
    const users = await supabaseMemoryManager.getSubscribedUsers();
    const userRow = users.find((u) => u.id === userId);
    if (!userRow || !userRow.line_id) {
      throw new Error("userIdに対応するline_idが見つかりません");
    }
    const lineId = userRow.line_id;

    // 2. context取得（体質・advice等）
    const context = await supabaseMemoryManager.getContext(lineId);
    if (!context) {
      return {
        sections: null,
        gptComment:
          "初回の体質ケア情報が見つかりませんでした。まずは体質分析からお試しください。",
        statusMessage: "no-context",
      };
    }
    const { advice } = context;

    // 🔽 ここに追記 🔽
    const symptomName = symptomLabels[context.symptom] || "不明な主訴";
    const motionName = context.motion || "指定の動作";

    // 3. followup履歴（最新と前回）とこれまでの反映度ヒストリ
    const { latest, prev } =
      await supabaseMemoryManager.getLastTwoFollowupsByUserId(userId);

    // cur / prev の正規化
    const curN = normalizeFollowup(followupAnswers || latest || {});
    const prevN = prev ? normalizeFollowup(prev) : null;

    // 体調反映度(今回)
    const {
      reflectionScore,
      reflectionStarsNum,
      reflectionStarsText,
    } = calcReflectionScore(prevN, curN);

    // 体調反映度の履歴を作る
    // - prevN vs その一個前… までは DBからここでは取れないので
    //   ひとまず latest と prev の2点から擬似的に並べる
    //   latest=今回 / prev=前回
    const reflectionHistory = [];
    if (prevN) {
      // 前回時点のスコア（＝前回とその前が必要…ないので、暫定50扱い）
      const prevScoreBlock = calcReflectionScore(null, prevN)
        .reflectionScore;
      reflectionHistory.push(prevScoreBlock);
    }
    reflectionHistory.push(reflectionScore);

    // 停滞判定
    const stagnationInfo = judgeStagnation(reflectionHistory);
    // { isStuck2Times, severity: "mild"|"heavy"|null }

    // 4. care_logs（行動ログ集計）
    //    直近「前回チェック以降〜今」の8日間換算で
     const rawCareCounts =
       await supabaseMemoryManager.getAllCareCountsSinceLastFollowupByLineId(
         lineId
       );

     // 🪴 日内の重複押しを1日1回扱いに丸める
     const careCounts = normalizeCareCountsPerDay(rawCareCounts);

// ---------------------------------------------
// ととのい度チェック間隔を基準にした実日数算出
// ・通常: 前回followup→今回までの日数
// ・初回: context.created_at→今回までの日数
// ・評価上限は8日にクリップ
// ---------------------------------------------
const now = Date.now();

let daysSincePrevFollowup = null;
if (prev?.created_at) {
  const prevDate = new Date(prev.created_at).getTime();
  daysSincePrevFollowup = Math.max(
    1,
    Math.floor((now - prevDate) / (1000 * 60 * 60 * 24))
  );
}

let daysSinceContextStart = null;
if (context?.created_at) {
  const ctxDate = new Date(context.created_at).getTime();
  daysSinceContextStart = Math.max(
    1,
    Math.floor((now - ctxDate) / (1000 * 60 * 60 * 24))
  );
}

// 実際のスコア計算に使う日数
const baseDays =
  daysSincePrevFollowup ??
  daysSinceContextStart ??
  8; // どちらも無ければ仮で8日扱い

const effectiveDays = Math.min(8, Math.max(1, baseDays));

    const { actionScoreRaw, totalActions } = calcActionScore(
      careCounts,
      effectiveDays
    );

    // 初期ユーザー向けの下駄
    const boostedActionScore = applyEarlyUserBoost(
      actionScoreRaw,
      daysSinceStart
    );

    // 5. 総合整い度
    const { totalScore, totalStarsNum, totalStarsText } = calcTotalScore(
      boostedActionScore,
      reflectionScore
    );

    // ※ 前回比（行動スコア・体調反映度・総合）をUIに入れたい場合、
    //   ここでは取れない「前々回」が必要だから、いったんnullで渡し、
    //   GPT側には「今回単体の値」として渡す方針にする。
    //   （あなたが将来3件分取れるように拡張してくれればそこも足せる）

    // 6. トトノウくんへのプロンプトを組み立てる
    //    - ここで「停滞してるかどうか」「重い停滞かどうか」も渡す
    //    - adviceとcareCountsも丸ごと渡す
    const systemPrompt = `
あなたは「トトノウくん」🧘‍♂️。
東洋医学と身体構造学（テンセグリティ理論）をもとに、
ユーザーの体の「整い方」を可視化・支援するAIパートナーです。
優しく、前向きに、データと因果に基づいて導いてください。

【目的】
ユーザーの最新チェック結果から、
1) 「今の整い具合」がどの段階にあるかを安心して理解できること
2) 「今週どんなペース・方向性で整えていけばいいか」がわかること
この2点を支援するために、2枚のカード（card1/card2）を生成します。

【背景：スコア構造と因果関係】
- 「ととのい度チェック」では、体の状態を数値で自己申告します：
  symptom_level（主訴の強さ）・sleep（睡眠の乱れ）・meal（食習慣）・stress（精神的負担）・motion_level（動作時のつらさ）。
  1が良好、5が不調。
- 「ケアログ（care_logs）」では、セルフケアの実施記録を保存しています。
  体質改善習慣（habits）、呼吸法（breathing）、ストレッチ（stretch）、ツボ刺激（tsubo）、漢方（kampo）をそれぞれ1日1回までカウント。
  8日間で最大40回（5項目×8日）が理論上の満点。

- 「行動スコア」＝ care_logs の8日間実施割合。
- 「体調反映度」＝ 前回→今回の体調スコア改善度。
- 「総合整い度」＝ 行動(40%) + 反映度(60%)で統合。星1〜5に変換。

【因果構造（トトノウくんが推定に使う基本ロジック）】
- habits ↔ sleep / meal / stress → symptom_level：
　一次KPI＝sleep, meal, stress。
　生活リズムを整える体質改善習慣（habits）の積み重ねは、自律・代謝・体内リズムを整える。
　これらが整うほど主訴（symptom_level）の軽減につながる。
- stretch / tsubo ↔ motion_level → symptom_level：
　一次KPI＝motion_level（動作時のつらさ）。
　ストレッチやツボ刺激は筋膜・経絡の張力構造（テンセグリティ）を調整し、動作痛や体幹の偏りを和らげる。
　構造バランスが整うことで、経絡・臓腑の循環負担が減り、主訴の改善を後押しする。
- breathing → 構造バランス → symptom_level：
　一次KPI＝構造安定（core pressure）。
　腹式呼吸（中脘あたりへの深い呼吸）によって腹圧・膜連動を整えると、体幹テンセグリティ（構造安定性）が回復。
　その結果、循環が促進され、全身調整機能が高まり、主訴軽減につながる。
- kampo（補助線）：
　他のセルフケア（habits, breathing, stretch, tsubo）を一定期間続けても改善が停滞するとき、
　補助的に併用を検討。継続依存は避ける。

【カード構成】
{
  "card1": {
    "lead": "冒頭のひとこと。安心・承認・ねぎらい。星の様子(総合整い度)にも軽く触れる。",
    "score_block": {
      "total": {
        "label": "総合整い度",
        "stars": "★★★★★ の形 (例: ★★★☆☆)",
        "explain": "行動スコアと体調反映度を合わせた総合評価"
      },
      "action": {
        "label": "セルフケア実施度",
        "score_text": "NN点",
        "explain": "直近8日間どれくらいケア行動を積み重ねられたか"
      },
      "reflection": {
        "label": "体調反映度",
        "stars": "★★★☆☆ など",
        "explain": "体の変化（主訴・睡眠・構造バランスの改善度合い）"
      }
    },
    "guidance": "今週の方向性を提案（例：『呼吸とストレッチのテンポを少し整える週🌿』など）"
  },
  "card2": {
    "lead": "『今週はこの流れで整えよう🌿』など、週のフォーカス宣言。",
    "care_plan": [
      {
        "pillar": "呼吸法" | "体質改善習慣" | "ストレッチ" | "ツボ" | "漢方",
        "priority": 1,
        "recommended_frequency": "毎日" | "週2〜3回" | "週1回" など,
        "reason": "なぜ今これが優先か（sleep・motion_level・symptom_levelとの関係を踏まえて）",
        "reference_link": "contexts.advice 内の対応リンクまたは識別テキスト"
      }
    ],
    "footer": "最後の励ましメッセージ（例：『焦らず、今日の1回が積み重なるよ🫶』）"
  }
}

【生成ルール（重要）】
- card1.score_block.total.stars は、渡された「総合整い度の星（totalStarsText）」をそのまま使う。
- card1.score_block.action.score_text には、渡された行動スコア(0〜100点台)をそのまま 'NN点' 形式で入れる。
- card1.score_block.reflection.stars には、渡された体調反映度の星（reflectionStarsText）をそのまま入れる。
- 色や星は加工しない。『★★★☆☆』の形を壊さない。

- care_plan は最大3つまで。priorityは1から昇順。
- 同じ柱を重複させない。（例：呼吸法を1位と3位に2回出さない）
- recommended_frequency は「毎日」「週2〜3回」「週1回」など具体的に書く。
  - 行動スコアが高めなのに体調反映度がまだ低めなら：
    →『今のペース維持でOK。無理に増やさず質を安定させよう』みたいな書き方をする
  - 行動スコアがまだ低いなら：
    →『まずはこの1つだけ“毎日1分”』みたいに、しぼって提案する
- reference_link は、もらった advice 情報の中から、その pillar に対応するリンクまたは識別できるテキストを入れてください。
  - 無ければ ""（空文字）で良いです。

【派生・相談ルール（停滞時の特別対応）】
ここで 'isStuck2Times' と 'stagnationSeverity' を渡します。

- isStuck2Times=false の場合：
  → 基本は context.advice 内のケア（既に案内済みのケア）を素直に提示する。
- isStuck2Times=true かつ stagnationSeverity="mild"（=40〜59点帯でほぼ変化なし）：
  → 同じ柱の中での「派生ケア」を提案してOK。
     例：「ツボ」なら同じ経絡や関連経絡の別のツボ候補、
         「ストレッチ」なら同じ経絡ラインをほぐす別アプローチなど。
     ただしカテゴリ名（pillar名）は変えないで。
- isStuck2Times=true かつ stagnationSeverity="heavy"（〜39点帯でほぼ変化なし）：
  → 派生ケアをガンガン差し替えるのではなく、
     まず『今のやり方が合ってるか一緒に見直そう』というメッセージを入れる。
     例：「気になる場所の写真や感覚を教えてくれたら、トトノウくんが具体的に調整ポイントを一緒に探すよ📩」
  → care_planの中に"相談"を含めてもよい（pillar名を「相談サポート」などにして良い）。
  → その場合 recommended_frequency は "必要な時" などでOK、reference_link は "" で良い。

【口調】
- フレンドリーだけど馴れ馴れしすぎない。
- 医療行為ではない注意書きは書かない（ユーザーは同意済み）。
- ユーザーを否定しない。「まだここから良くできるよ」ベース。

【禁止】
- JSON以外のテキストを出力しない
- 'null' や 未定義のキーを省略しない。すべてのフィールドを必ず含める
- card2.care_plan は最低1件は必ず入れる
`.trim();

    const userPrompt = `
【スコア情報】
- 総合整い度(星のみ): ${totalStarsText} (${totalScore}点ベース)
- セルフケア実施度スコア(行動): ${boostedActionScore}点
- 体調反映度スコア: ${reflectionScore}点
- 体調反映度の星: ${reflectionStarsText}
- 直近のセルフケア合計回数（8日あたり実績）: ${totalActions} 回
- daysSinceStart(サービス開始からの日数): ${daysSinceStart}日
- effectiveDays(今回の評価対象日数): ${effectiveDays}日

【体調指標（今回）】
- 主訴レベル(symptom_level): ${curN.symptom_level} (1=改善/軽い〜5=つらい)
- 睡眠の乱れ(sleep): ${curN.sleep} (1理想〜5乱れ)
- 食事バランス(meal): ${curN.meal}
- ストレス/気分(stress): ${curN.stress}
- 動作テストのつらさ(motion_level): ${curN.motion_level}

【停滞フラグ】
- isStuck2Times: ${stagnationInfo.isStuck2Times}
- stagnationSeverity: ${stagnationInfo.severity || "null"}

【アドバイスデータ(advice - 体質に合わせて保持している公式ケア案内)】
${JSON.stringify(advice, null, 2)}

【careCounts（柱ごとの直近実施回数）】
${JSON.stringify(careCounts, null, 2)}

【体質・症状情報】
- 主訴: ${symptomName} (${context.symptom})
- 動作テスト対象: ${motionName}

【メモ】
- 上記adviceの中に、呼吸法/体質改善習慣/ストレッチ/ツボ/漢方 の説明や参考リンクが含まれる。
- reference_link にはそのリンクや識別テキストを入れてOK。
- '相談サポート' pillarを作る場合はリンクは空でOK。
`.trim();

    // 7. GPT呼び出し
    const sections = await callTotonouGPT(systemPrompt, userPrompt);

    if (!sections) {
      return {
        sections: null,
        gptComment:
          "トトノウくんがうまくまとめられませんでした🙏少し時間をおいてもう一度お試しください。",
        statusMessage: "error",
      };
    }

    // 8. フォールバック用のgptComment（テキストだけUIで出すとき用）
    const fallbackLines = [];
    fallbackLines.push(sections.card1.lead || "");
    fallbackLines.push("");
    fallbackLines.push(sections.card1.guidance || "");
    fallbackLines.push("");
    fallbackLines.push(sections.card2.lead || "");
    const planPreview = (sections.card2.care_plan || [])
      .map(
        (p, idx) =>
          `${idx + 1}位: ${p.pillar}（${p.recommended_frequency}）\n${p.reason}`
      )
      .join("\n\n");
    fallbackLines.push(planPreview);
    fallbackLines.push("");
    fallbackLines.push(sections.card2.footer || "");

    const gptComment = fallbackLines.join("\n");

    return {
      sections, // {card1:{...}, card2:{...}}
      gptComment,
      statusMessage: "ok",
    };
  } catch (err) {
    console.error("❌ sendFollowupResponse error:", err);
    return {
      sections: null,
      gptComment:
        "今週のケアプラン生成でエラーが発生しました。少し時間をおいてもう一度お試しください🙏",
      statusMessage: "error",
    };
  }
}

module.exports = { sendFollowupResponse };
