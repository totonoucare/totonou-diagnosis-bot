// ======================================
// 📚 必要辞書
// ======================================
const resultDictionary = require("./resultDictionary");
const flowDictionary = require("./flowDictionary");
const flowlabelDictionary = require("./flowlabelDictionary");
const organDictionary = require("./organDictionary");
const adviceDictionary = require("./adviceDictionary");
const linkDictionary = require("./linkDictionary");
const stretchPointDictionary = require("./stretchPointDictionary");
const flowAdviceDictionary = require("./flowAdviceDictionary");
const getTypeName = require("./typeMapper");

// ======================================
// 🏷 症状ラベル
// ======================================
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

// ======================================
// ✨ overviewParts（通常ルート）
// ======================================
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

  // 体質説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: traits, box: true });
  parts.push({ type: "separator" });

  // ② 巡り接続文
  parts.push({
    type: "text",
    bold: true,
    text: `その影響で“${flowLabel}”という巡りの偏りがあらわれやすく、流れが滞りやすい状態です。`,
  });

  // 巡り説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: flowIssue, box: true });
  parts.push({ type: "separator" });

  // ③ 経絡接続文
  parts.push({
    type: "text",
    bold: true,
    text: `さらに、この巡りの滞りが体表面の『${organType}の経絡ライン』に固さとして表れ、全体のバランスを崩しています。`,
  });

  // 経絡説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: organInfo, box: true });
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

// ======================================
// ✨ 巡り良好ルート
// ======================================
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

  // 体質説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: traits, box: true });
  parts.push({ type: "separator" });

  // 巡りが良好の接続文
  parts.push({
    type: "text",
    bold: true,
    text: `体質の影響はあるものの、“巡り自体は大きく乱れていない状態”です。`,
  });

  // 巡り説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: flowIssue, box: true });
  parts.push({ type: "separator" });

  // 経絡接続文（巡り良好でも局所は固まる）
  parts.push({
    type: "text",
    bold: true,
    text: `ただし、疲労やストレスが重なると、体表面の『${organType}の経絡ライン』に緊張として現れ、局所的なこわばりがバランスを崩す原因になります。`,
  });

  // 経絡説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: organInfo, box: true });
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
// ======================================
// 🥇 ケア前置き（優先 / 補助）
// ======================================
const introPriority = {
  breathing: "🧭 優先して取り組みたいケアです。内側の圧や緊張を根本から整え、全身の張りや巡りをスムーズにする基礎ケアになります。",
  stretch: "🧭 優先して取り組みたいケアです。負担を感じる経絡ラインのこわばりをゆるめ、巡りの通り道を広げるケアです。姿勢や動きの癖で固まりやすい部分に直接働きかけます。",
  points: "🧭 優先して取り組みたいケアです。滞りやすい要所に直接アプローチし、早めの変化につながりやすいケアです。",
  lifestyle: "🧭 優先して取り組みたいケアです。からだの土台を整える長期ケアです。体質そのものを改善していきます。",
};

const introSupport = {
  breathing: "💡 優先ケアを補完するサポートケアです。内側から圧や緊張を整え、全身の張りや巡りをスムーズにする基礎ケアになります。",
  stretch: "💡 優先ケアを補完するサポートケアです。負担の強い経絡ラインのこわばりをゆるめ、巡りの通り道を広げるケアです。姿勢や動きの癖で固まりやすい部分に直接働きかけます。",
  points: "💡 優先ケアを補完するサポートケアです。滞りやすい経絡ラインの要所に直接アプローチし、早めの変化につなげやすくするケアです。",
  lifestyle: "💡 からだの土台を整え、優先ケアの効果を維持する長期ケアです。体質そのものを改善していきます。",
  kanpo: "💡 からだの傾向に合わせた“相性のよいサポート”としてご提案しています。",
};

// ======================================
// 🎯 優先ケアロジック
// ======================================
function decidePriorityCare(flowType) {
  if (flowType === "気滞") return ["breathing", "points"];
  if (flowType === "瘀血") return ["stretch", "points"];
  if (flowType === "水滞") return ["breathing", "stretch"];
  if (flowType === "巡りは良好") return ["lifestyle", "stretch"];
  return ["breathing", "stretch"];
}

// ======================================
// 🌟 メイン：結果生成
// ======================================
function generateResult(score1, score2, score3, flowType, organType, symptom) {
  const typeName = getTypeName(score1, score2, score3);
  const symptomLabel =
    symptomLabelMap[symptom] || symptom || "からだの不調";

  const traits = (resultDictionary[typeName] || {}).traits || "";
  const flowIssue = flowDictionary[flowType] || "";
  const flowLabel = flowlabelDictionary[flowType] || "";
  const organInfo = organDictionary[organType] || "";

  // ケア素材
  const baseAdvice = adviceDictionary[typeName] || "";
  const flowData = flowAdviceDictionary[flowType] || { text: "", link: "" };
  const stretchData = stretchPointDictionary[organType] || {
    stretch: { text: "", link: "" },
    points: { text: "", link: "" },
  };
  const resolvedLink =
    (linkDictionary[typeName] || "").replace("{{flowlabel}}", flowLabel);

  // ================================
  // overviewParts（巡り良好は別ルート）
  // ================================
  const overviewParts =
    flowType === "巡りは良好"
      ? buildGoodFlowOverviewParts({
          symptomLabel,
          typeName,
          traits,
          flowIssue,
          organType,
          organInfo,
        })
      : buildDefaultOverviewParts({
          symptomLabel,
          typeName,
          traits,
          flowLabel,
          flowIssue,
          organType,
          organInfo,
        });

  // ================================
  // 🌱 優先ケア判定
  // ================================
  const priority = decidePriorityCare(flowType);

  // ======================================
  // 🎴 カルーセルカード生成
  // ======================================
  function buildCard(type, title, body, link) {
    const isPriority = priority.includes(type);
    const intro = isPriority
      ? introPriority[type]
      : introSupport[type];

    return {
      header: `${isPriority ? "最優先ケア" : "サポートケア"}：${title}`,
      body: `${intro}\n\n${body}`,
      link,
      priority: isPriority ? 1 : 2,
      key: type,
    };
  }

  const cardsRaw = [
    buildCard("breathing", "呼吸法", flowData.text, flowData.link),
    buildCard(
      "stretch",
      "経絡ストレッチ",
      stretchData.stretch.text,
      stretchData.stretch.link
    ),
    buildCard(
      "points",
      "指先・ツボほぐし",
      stretchData.points.text,
      stretchData.points.link
    ),
    buildCard("lifestyle", "体質改善習慣", baseAdvice, null),
    buildCard("kanpo", "漢方・サプリ", resolvedLink, null),
  ];

// ← 余計な map を削除して、card オブジェクトをそのまま渡す
const adviceCards = cardsRaw.sort((a, b) => a.priority - b.priority);

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
