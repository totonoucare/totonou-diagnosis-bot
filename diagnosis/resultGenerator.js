// ================================
// 📚 必要辞書
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
// 🏷 症状ラベル
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
// ✨ Overview（通常ルート）
// ================================
function buildDefaultOverviewParts({
  symptomLabel,
  typeName,
  traits,
  flowLabel,
  flowIssue,
  organType,
  organInfo,
}) {
  const parts = [];

  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴がベースにあります。`,
  });

  parts.push({ type: "text", bold: false, text: traits });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: `その影響で“${flowLabel}”という巡りの偏りがあらわれやすく、流れが滞りやすい状態です。`,
  });

  parts.push({ type: "text", bold: false, text: flowIssue });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: `さらに、この巡りの滞りが体表面の『${organType}の経絡ライン』に固さとして表れ、全体のバランスを崩しています。`,
  });

  parts.push({ type: "text", bold: false, text: organInfo });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: "まとめると、①体質（根本） ②巡り（流れ） ③経絡（局在）が重なり、今の不調につながっている状態です。",
  });

  return parts;
}

// ================================
// ✨ Overview（巡り良好ルート）
// ================================
function buildGoodFlowOverviewParts({
  symptomLabel,
  typeName,
  traits,
  flowIssue,
  organType,
  organInfo,
}) {
  const parts = [];

  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴が関係しています。`,
  });

  parts.push({ type: "text", bold: false, text: traits });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: `体質の影響はあるものの、“巡り自体は大きく乱れていない状態”です。`,
  });

  parts.push({ type: "text", bold: false, text: flowIssue });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: `ただし、疲労やストレスが重なると、体表面の『${organType}の経絡ライン』に緊張として現れ、局所的なこわばりが不調の入口になります。`,
  });

  parts.push({ type: "text", bold: false, text: organInfo });
  parts.push({ type: "separator" });

  parts.push({
    type: "text",
    bold: true,
    text: "まとめると、巡りは良好ですが、体質（根本）と局所の崩れが不調の土台になりやすい状態です。",
  });

  return parts;
}

// ================================
// 🥇 優先ケアロジック
// ================================
function determinePriorityCare(flowType) {
  switch (flowType) {
    case "気滞":
      return ["breathing", "points"]; // 呼吸法 + ツボ

    case "瘀血":
      return ["stretch", "points"]; // ストレッチ + ツボ

    case "水滞":
      return ["breathing", "stretch"]; // 呼吸法 + ストレッチ

    case "巡りは良好":
    default:
      return ["stretch", "lifestyle"]; // ストレッチ + 体質改善
  }
}

// ================================
// 🌟 メイン：結果生成
// ================================
function generateResult(score1, score2, score3, flowType, organType, symptom) {
  const typeName = getTypeName(score1, score2, score3);

  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

  const traits = (resultDictionary[typeName] || {}).traits || "";
  const flowIssue = flowDictionary[flowType] || "";
  const flowLabel = flowlabelDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";

  // ======================================
  // 🟩 各ケア辞書を読み込み
  // ======================================
  const baseAdvice = adviceDictionary[typeName] || "";
  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" },
  };

  // 漢方リンク resolved
  const resolvedLink =
    (linkDictionary[typeName] || "").replace("{{flowlabel}}", flowLabel);

  // ======================================
  // 🟦 overview ルート分岐
  // ======================================
  let overviewParts;
  if (flowType === "巡りは良好") {
    overviewParts = buildGoodFlowOverviewParts({
      symptomLabel,
      typeName,
      traits,
      flowIssue,
      organType,
      organInfo,
    });
  } else {
    overviewParts = buildDefaultOverviewParts({
      symptomLabel,
      typeName,
      traits,
      flowLabel,
      flowIssue,
      organType,
      organInfo,
    });
  }

  // ======================================
  // ⭐ 優先ケアロジック
  // ======================================
  const [p1, p2] = determinePriorityCare(flowType);

  // 全ケアを内部コード化
  const careItems = {
    breathing: {
      header: "巡りととのう呼吸法🧘",
      body: flowData.text,
      link: flowData.link || "",
    },
    stretch: {
      header: "経絡ストレッチ🤸",
      body: stretchData.stretch.text,
      link: stretchData.stretch.link || "",
    },
    points: {
      header: "指先・ツボほぐし👍",
      body: stretchData.points.text,
      link: stretchData.points.link || "",
    },
    lifestyle: {
      header: "体質改善習慣💡",
      body: baseAdvice,
      link: "",
    },
    supplement: {
      header: "相性のよい漢方・サプリ🌿",
      body: resolvedLink,
      link: "",
    },
  };

  // 残りのケア（漢方は最後に固定）
  const remaining = Object.keys(careItems)
    .filter(k => k !== p1 && k !== p2 && k !== "supplement");

  // ======================================
  // 🎨 5枚カルーセルの構成
  // ======================================
  const adviceCards = [
    {
      header: `最優先ケア❶｜${careItems[p1].header}`,
      body: careItems[p1].body,
      link: careItems[p1].link,
    },
    {
      header: `最優先ケア❷｜${careItems[p2].header}`,
      body: careItems[p2].body,
      link: careItems[p2].link,
    },
    ...remaining.map((key) => ({
      header: careItems[key].header,
      body: careItems[key].body,
      link: careItems[key].link,
    })),
    // 漢方は例外なく最後
    {
      header: careItems.supplement.header,
      body: careItems.supplement.body,
    },
  ];

  return {
    type: typeName,
    symptomLabel,
    overviewParts,
    adviceCards,
  };
}

module.exports = generateResult;
