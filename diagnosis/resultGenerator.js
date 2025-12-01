const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const stretchPointDictionary = require("./stretchPointDictionary");
const flowAdviceDictionary = require("./flowAdviceDictionary");
const getTypeName = require("./typeMapper");

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

// ===================================================
// 🔥 overviewParts（太字＋セパレーター対応）
// ===================================================
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

  // ① 悩み → 体質
  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴がベースにあります。`,
  });

  parts.push({ type: "separator" });

  // 体質 辞書
  if (traits) {
    parts.push({
      type: "text",
      bold: false,
      text: traits,
    });
  }

  parts.push({ type: "separator" });

  // ② 巡りの偏り
  parts.push({
    type: "text",
    bold: true,
    text: `その影響で“${flowLabel}”の巡りの偏りがあらわれやすく、気の流れが滞りやすい状態です。`,
  });

  // 巡り 辞書
  if (flowIssue) {
    parts.push({
      type: "text",
      bold: false,
      text: flowIssue,
    });
  }

  parts.push({ type: "separator" });

  // ③ 経絡の偏り
  if (organType) {
    parts.push({
      type: "text",
      bold: true,
      text: `さらに、この巡りの偏りが『${organType}ライン』に局在し、特定の部位に負担がかかりやすい状態です。`,
    });
  }

  if (organInfo) {
    parts.push({
      type: "text",
      bold: false,
      text: organInfo,
    });
  }

  parts.push({ type: "separator" });

  // 最終まとめ
  parts.push({
    type: "text",
    bold: true,
    text: "まとめると、①体質（根本） ②巡り（流れ） ③経絡（負担の局在）の３層が重なり、今の不調につながっている状態です。",
  });

  return parts;
}

// ===================================================
// 🔥 メイン resultGenerator
// ===================================================
function generateResult(
  score1,
  score2,
  score3,
  flowType,
  organType,
  symptom
) {
  const typeName = getTypeName(score1, score2, score3);

  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

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

  // ⭐ ここが今回の主役：overviewParts
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
