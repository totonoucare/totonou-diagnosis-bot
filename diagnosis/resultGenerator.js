// ================================
// 🔰 必要な辞書読み込み
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
// 🔰 症状ラベル辞書
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
// 🔰 overviewParts 生成関数（太字行を含む）
// ================================
function buildOverviewParts({
  symptomLabel,
  typeName,
  traits,
  flowLabel,
  flowIssue,
  organType,
  organInfo,
}) {
  const parts = [];

  // --- 悩み → 体質（太字） ------------
  parts.push({
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴がベースにあります。`,
  });

  // --- 体質の説明（辞書） -------------
  if (traits) {
    parts.push({ bold: false, text: traits });
  }

  // --- 巡りの偏り（太字） -------------
  if (flowLabel) {
    parts.push({
      bold: true,
      text: `その影響で“${flowLabel}”の巡りの偏りがあらわれやすく、気の流れが滞りやすい状態です。`,
    });
  }

  // --- 巡りの説明（辞書） -------------
  if (flowIssue) {
    parts.push({ bold: false, text: flowIssue });
  }

  // --- 経絡の説明（太字） -------------
  if (organType && organInfo) {
    parts.push({
      bold: true,
      text: `さらに、この巡りの偏りが『${organType}ライン』に局在し、特定の部位に負担がかかりやすい状態です。`,
    });
    parts.push({ bold: false, text: organInfo });
  }

  // --- 最終まとめ（太字） -------------
  parts.push({
    bold: true,
    text: "まとめると、①体質（根本） ②巡り（流れ） ③経絡（負担の局在）の３層が重なり、今の不調につながっている状態です。",
  });

  return parts;
}

// ================================
// 🔥 メイン：結果生成
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

  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

  if (!typeName) {
    return {
      type: "不明な体質タイプ",
      symptomLabel,
      traits: "",
      flowType,
      organType,
      flowIssue: "",
      organBurden: "",
      overviewParts: [
        { bold: true, text: "内部エラーが発生しました。" },
      ],
      adviceCards: [],
    };
  }

  const baseTraits = (resultDictionary[typeName] || {}).traits || "";
  const flowIssue = flowDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";
  const flowLabel = flowlabelDictionary[flowType] || "";

  const baseAdvice = adviceDictionary[typeName] || "";
  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" },
  };

  const rawLinkText = linkDictionary[typeName] || "";
  const resolvedLink = rawLinkText.replace("{{flowlabel}}", flowLabel);

  // 🔥 overviewParts を構造化して生成
  const overviewParts = buildOverviewParts({
    symptomLabel,
    typeName,
    traits: baseTraits,
    flowLabel,
    flowIssue,
    organType,
    organInfo,
  });

  const adviceCards = [
    {
      header: "① 体質改善習慣💡",
      body: baseAdvice,
    },
    {
      header: "② 巡りととのう呼吸法🧘",
      body: flowData.text,
      link: flowData.link || "",
    },
    {
      header: "③ 経絡ストレッチ🤸",
      body: stretchData.stretch.text,
      link: stretchData.stretch.link || "",
    },
    {
      header: "④ 指先・ツボほぐし👍",
      body: stretchData.points.text,
      link: stretchData.points.link || "",
    },
    {
      header: "⑤ 相性のよい漢方🌿",
      body: resolvedLink,
    },
  ];

  return {
    type: typeName,
    symptomLabel,
    traits: baseTraits,
    flowIssue,
    organBurden: organInfo,
    overviewParts,
    adviceCards,
  };
}

module.exports = generateResult;
