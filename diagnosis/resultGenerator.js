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
// ✨ 共通：overviewParts（通常ルート）
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

  // ① 悩み → 体質
  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴がベースにあります。`,
  });

  // 体質説明
  parts.push({ type: "text", bold: false, text: traits });
  parts.push({ type: "separator" });

  // ② 巡り接続文
  parts.push({
    type: "text",
    bold: true,
    text: `その影響で“${flowLabel}”という巡りの偏りがあらわれやすく、流れが滞りやすい状態です。`,
  });

  // 巡り辞書
  parts.push({ type: "text", bold: false, text: flowIssue });
  parts.push({ type: "separator" });

  // ③ 経絡接続文
  parts.push({
    type: "text",
    bold: true,
    text: `さらに、この巡りの滞りが体表面の『${organType}の経絡ライン』に固さとして表れ、全体のバランスを崩しています。`,
  });

  // 経絡辞書
  parts.push({ type: "text", bold: false, text: organInfo });
  parts.push({ type: "separator" });

  // まとめ
  parts.push({
    type: "text",
    bold: true,
    text:
      "まとめると、①体質（根本） ②巡り（流れ） ③経絡（局在）の３層が重なり、今の不調につながっている状態です。",
  });

  return parts;
}

// ================================
// ✨ 特別ルート：巡り良好専用
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

  // ① 悩み → 体質
  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」は、体質として『${typeName}』の特徴が関係しています。`,
  });


  // 体質説明
  parts.push({ type: "text", bold: false, text: traits });
  parts.push({ type: "separator" });

  // ② 巡り良好の接続文
  parts.push({
    type: "text",
    bold: true,
    text: `体質の影響はあるものの、“巡り自体は大きく乱れていない状態”です。`,
  });

  // 巡り辞書（巡り良好の説明）
  parts.push({ type: "text", bold: false, text: flowIssue });
  parts.push({ type: "separator" });

  // ③ 経絡（巡りは良好でも局所は固まり得る）
  parts.push({
    type: "text",
    bold: true,
    text: `ただし、疲労やストレスが重なると、体表面の『${organType}の経絡ライン』に緊張として現れ、局所的なこわばりがバランスを崩す原因になります。`,
  });

  // 経絡辞書
  parts.push({ type: "text", bold: false, text: organInfo });
  parts.push({ type: "separator" });

  // まとめ
  parts.push({
    type: "text",
    bold: true,
    text:
      "まとめると、巡りは良好ですが、体質（根本）と局所の崩れが不調の入口となりやすい状態です。",
  });

  return parts;
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

  // ケアガイド（カルーセル用）
  const baseAdvice = adviceDictionary[typeName] || "";
  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" },
  };

  const resolvedLink =
    (linkDictionary[typeName] || "").replace("{{flowlabel}}", flowLabel);

  // ================================
  // 🟦 巡り良好なら特別ルートへ分岐
  // ================================
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

  // ================================
  // 🌱 ケアガイド（カルーセル）
  // ================================
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
      header: "⑤ 相性のよい漢方・サプリ🌿",
      body: resolvedLink,
    },
  ];

  return {
    type: typeName,
    symptomLabel,
    traits,
    flowIssue,
    organBurden: organInfo,
    overviewParts,
    adviceCards,
  };
}

module.exports = generateResult;
