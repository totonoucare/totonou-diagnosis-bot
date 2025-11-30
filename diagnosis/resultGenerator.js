// ================================
// 🔰 必要な辞書の読み込み
// ================================
const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const stretchPointDictionary = require("./stretchPointDictionary");
const flowAdviceDictionary = require("./flowAdviceDictionary");
const getTypeName = require("./typeMapper");

// ================================
// 🔰 症状カテゴリ → 日本語ラベル
// ================================
const symptomLabelMap = {
  stomach: "胃腸の調子",
  sleep: "睡眠・集中力",
  pain: "肩こり・腰痛・関節痛",
  mental: "不安感・イライラ",
  cold: "体温バランス・むくみ",
  skin: "頭髪や肌の健康",
  pollen: "花粉症・鼻炎",
  women: "女性特有のお悩み",
  unknown: "なんとなくの不調",
};

// ================================
// 🔰 overview（自然なつなぎ文章）生成
// ================================
function buildOverviewText({
  symptomLabel,
  typeName,
  traits,
  flowLabel,
  flowIssue,
  organType,
  organInfo,
}) {
  const lines = [];

  // --- 悩み → 体質 ---------------------
  lines.push(
    `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴がベースにあります。`
  );

  // --- 体質の特徴の説明 -----------------
  if (traits) {
    lines.push(traits);
  }

  // --- 体質の影響で巡りが乱れている ------
  if (flowLabel) {
    lines.push(
      `その影響で“${flowLabel}”の巡りの偏りがあらわれやすく、気の流れが滞りやすい状態です。`
    );
  }

  if (flowIssue) {
    lines.push(flowIssue);
  }

  // --- さらに局在としての経絡説明 -------
  if (organType && organInfo) {
    lines.push(
      `さらに、この巡りの偏りが『${organType}ライン』に局在し、特定の部位に負担がかかりやすい状態です。`
    );
    lines.push(organInfo);
  }

  // --- 最終まとめ ------------------------
  lines.push(
    "まとめると、①体質（根本） ②巡り（流れ） ③経絡（負担の局在）の３層が重なり、今の不調につながっている状態です。"
  );

  return lines.join("\n\n");
}

// ================================
// 🔰 メイン：結果生成関数
// ================================
function generateResult(
  score1,
  score2,
  score3,
  flowType,
  organType,
  symptom,
  motion
) {
  const typeName = getTypeName(score1, score2, score3);

  // --- 症状ラベル変換 ---------------------
  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

  // =======================================
  // ❌ 未定義タイプ安全処理
  // =======================================
  if (!typeName) {
    return {
      type: "不明な体質タイプ",
      traits: "",
      flowType,
      organType,
      symptomLabel,
      motion,
      flowIssue: flowDictionary[flowType] || "",
      organBurden: organDictionary[organType] || "",
      scores: [score1, score2, score3],
      overview: "内部エラーの可能性があります。",
      adviceCards: [
        {
          header: "分析エラー",
          body: "内部エラーが発生しました。",
        },
      ],
    };
  }

  // =======================================
  // 🔰 各種辞書読み込み
  // =======================================
  const baseTraits = (resultDictionary[typeName] || {}).traits || "";
  const flowIssue = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const baseAdvice = adviceDictionary[typeName] || "";
  const flowLabel = flowlabelDictionary[flowType] || "";

  const flowData = flowAdviceDictionary[flowType] || {
    text: "",
    link: "",
  };

  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" },
  };

  // --- 漢方リンクに flowlabel を埋め込む ----
  const rawLinkText = linkDictionary[typeName] || "";
  const resolvedLink = rawLinkText.replace("{{flowlabel}}", flowLabel);

  // =======================================
  // 🔰 overview の自然文生成
  // =======================================
  const overview = buildOverviewText({
    symptomLabel,
    typeName,
    traits: baseTraits,
    flowLabel,
    flowIssue,
    organType,
    organInfo,
  });

  // ==========================
  // ② カルーセル（元のまま）
  // ==========================
  const adviceCards = [
    {
      header: "① 体質改善習慣💡",
      body: baseAdvice,
    },
    {
      header: "② 巡りととのう呼吸法🧘",
      body: flowData.text,
      link: flowData.link,
    },
    {
      header: "③ 経絡(けいらく)ストレッチ🤸",
      body: stretchData.stretch.text,
      link: stretchData.stretch.link,
    },
    {
      header: "④ 指先・ツボほぐし 👍",
      body: stretchData.points.text,
      link: stretchData.points.link,
    },
    {
      header: "⑤ 体質で選ぶオススメ漢方薬 🌿",
      body: resolvedLink,
    },
  ];

  // =======================================
  // 🔰 最終返り値
  // =======================================
  return {
    type: typeName,
    symptomLabel,
    flowType,
    organType,
    traits: baseTraits,
    flowIssue,
    organBurden: organInfo,
    overview,
    adviceCards,
    scores: [score1, score2, score3],
  };
}

module.exports = generateResult;
