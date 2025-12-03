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
// ✨ 完全統合版：overviewParts Builder
// （通常ルート + 巡り良好ルートを一本化）
// ======================================
function buildOverviewParts({
  symptomLabel,
  typeName,
  traits,
  flowType,
  flowLabel,
  flowIssue,
  organType,
  organInfo,
}) {
  const parts = [];

  // ===========================
  // 🟢 ① 悩み → 体質（共通）
  // ===========================
  parts.push({
    type: "text",
    bold: true,
    text: `あなたが今気にされている「${symptomLabel}」には、
『${typeName}』としての体質的な特徴に加え、
"体内の巡りの状態"や"体表面の経絡ライン(けいらく：皮膚や筋膜などの繋がり)のこわばり"
といった複数の要因が関係しています。

🟢 『${typeName}』の特徴`,
  });

  // 体質説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: traits, box: true });
  parts.push({ type: "separator" });

  // ===========================
  // 🔵 ② 巡り（flowTypeに応じて分岐）
  // ===========================
  parts.push({
    type: "text",
    bold: true,
    text: `🔵 体内で表れている巡り（流れ）の状態`,
  });

  // flowIssue（巡り説明）
  parts.push({ type: "text", bold: false, text: flowIssue, box: true });
  parts.push({ type: "separator" });

  // ===========================
  // 🟠 ③ 経絡ライン（共通）
  // ===========================
  parts.push({
    type: "text",
    bold: true,
    text: `🟠 体表面で負担・こわばりが出ている『${organType}の経絡ライン』`,
  });

  // 経絡説明（辞書 → box付き）
  parts.push({ type: "text", bold: false, text: organInfo, box: true });
  parts.push({ type: "separator" });

  // ===========================
  // 🧩 まとめ（flowType に応じて自然に変化）
  // ===========================
  parts.push({
    type: "text",
    bold: true,
    text:
      flowType === "巡りは良好"
        ? "まとめると、体質（根本）と経絡（内臓と関連する体表面）のこわばりが重なり、今回の不調につながっている状態です。"
        : "まとめると、①体質（根本）をベースに、②巡り（体内の流れ）や③経絡（内臓と関連する体表面のこわばり）の３層が重なり、今の不調につながっている状態です。",
  });

  return parts;
}

// ======================================
// 🥇 ケア前置き（優先 / 補助）
// ======================================
const introPriority = {
  breathing: "🧭 優先して取り組みたいケアです。内側の圧や緊張を根本から整え、全身の張りや巡りをスムーズにする万能的な基礎ケアになります。",
  stretch: "🧭 優先して取り組みたいケアです。姿勢や動きの癖でこわばりやすい経絡ライン（内臓と関連が深い皮膚や筋膜のつながり）をゆるめ、全身のバランスと“巡りの通り道”を整えるケアです。",
  points: "🧭 優先して取り組みたいケアです。姿勢や動きの癖でこわばりやすい経絡ライン（内臓と関連が深い皮膚や筋膜のつながり）の要所にピンポイントでアプローチし、早めの変化につなげやすくするケアです。",
  lifestyle: "🧭 優先して取り組みたいケアです。からだの土台を整える長期ケアです。体質そのものを改善していきます。",
};

const introSupport = {
  breathing: "💡 優先ケアを補完するサポートケアです。内側から圧や緊張を整え、全身の張りや巡りをスムーズにする基礎ケアになります。",
  stretch: "💡 優先ケアを補完するサポートケアです。姿勢や動きの癖でこわばりやすい経絡ラインをゆるめ、全身のバランスと“巡りの通り道”を整えるケアです。",
  points: "💡 優先ケアを補完するサポートケアです。こわばりやすい経絡ラインの要所にピンポイントでアプローチし、早めの変化につなげやすくするケアです。",
  lifestyle: "💡 からだの土台を整え、優先ケアの効果を維持する長期ケアです。体質そのものを改善していきます。",
  kanpo: "💡 からだの傾向に合わせた“相性のよいサポート”としてご提案しています。",
};

// ======================================
// 🎯 優先ケアロジック
// ======================================
function decidePriorityCare(flowType) {
  if (flowType === "気滞") return ["breathing", "points"];
  if (flowType === "瘀血") return ["points", "breathing"];
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
// overviewParts（統合版）
// ================================
const overviewParts = buildOverviewParts({
  symptomLabel,
  typeName,
  traits,
  flowType,
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
  const intro = isPriority ? introPriority[type] : introSupport[type];

  return {
    header: `${isPriority ? "最優先ケア" : "サポートケア"}：${title}`,
    intro,          // ← ★前置き文を独立して渡す（必須）
    explain: null,  // ← 今後使うならここに入る
    body,           // ← 辞書本文は混ぜない
    link,
    priority: isPriority ? 1 : 2,
    key: type,
  };
}
  
  const cardsRaw = [
    buildCard("breathing", "巡りととのえ呼吸法", flowData.text, flowData.link),
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
  organBurden,
  overviewParts,
  adviceCards,

  // ★ Supabase 保存で必要なフィールド
  flowType,
  organType,
  scores: [score1, score2, score3],
};
}

module.exports = generateResult;
