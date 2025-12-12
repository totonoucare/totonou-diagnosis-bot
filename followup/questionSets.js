// followupQuestionSet.js
// ===============================================
// ととのい度チェック（即時開始OK版）
// - すべて「いまの状態」の絶対評価：1=気にならない/かなりラク, 5=かなりツラい
// - 初回でも答えやすい表現に統一
// ===============================================

const followupQuestionSet = [
  {
    id: "Q1",
    header: "【Q1】🌡 主なお悩みのツラさ",
    body:
      "いま一番気になるお悩み\n「{{symptom}}」\n\nのツラさを、\n「1＝気にならない／かなりラク」\n「5＝かなりツラい」\nで選んでください。",
    isMulti: true,
    options: [
      {
        id: "symptom",
        label: "「{{symptom}}」のツラさ",
        items: ["1", "2", "3", "4", "5"],
      },
    ],
  },
  {
    id: "Q2",
    header: "【Q2】生活リズムの整い具合",
    body:
      "最近の状態をそれぞれ\n「1＝よく整っている」\n「5＝かなり乱れている」\nで選んでください。",
    isMulti: true,
    options: [
      {
        id: "sleep",
        label: "🌙 睡眠（質・リズム）",
        items: ["1", "2", "3", "4", "5"],
      },
      {
        id: "meal",
        label: "🍽 食事（タイミング・バランス）",
        items: ["1", "2", "3", "4", "5"],
      },
      {
        id: "stress",
        label: "😮‍💨 ストレス・気分の安定度",
        items: ["1", "2", "3", "4", "5"],
      },
    ],
  },
  {
    id: "Q3",
    header: "【Q3】🧍‍♀️ 動作の負荷チェック",
    body:
      "体質分析で確認した動き\n「{{motion}}」\n\nを、いまやってみたときのツラさを\n「1＝気にならない／かなりラク」\n「5＝かなりツラい」\nで選んでください。\n（※経絡ストレッチと同じ動きでもOK）",
    isMulti: true,
    options: [
      {
        id: "motion_level",
        label: "「{{motion}}」のツラさ",
        items: ["1", "2", "3", "4", "5"],
      },
    ],
  },
];

module.exports = followupQuestionSet;
