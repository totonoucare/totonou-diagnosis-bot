const followupQuestionSet = [
  {
    id: "Q1",
    header: "【Q1】症状と体調の変化",
    body: "初回診断のお悩み「{{symptom}}」が一番ツラいときの度合いを「5」とした場合、今はどのくらいですか？\nあわせて、全体的な体調の度合いも「5＝最悪」として、今はどのくらいですか？",
    isMulti: true,
    options: [
      {
        id: "symptom",
        label: "「{{symptom}}」のツラさ",
        items: ["1", "2", "3", "4", "5"]
      },
      {
        id: "general",
        label: "全体的な調子の度合い",
        items: ["1", "2", "3", "4", "5"]
      }
    ]
  },
  {
    id: "Q2",
    header: "【Q2】生活リズムの整い具合",
    body: "最近の睡眠・食事・ストレスの状態について、それぞれ「1＝理想」「5＝かなり乱れている」で答えてください。",
    isMulti: true,
    options: [
      {
        id: "sleep",
        label: "睡眠の質・時間",
        items: ["1", "2", "3", "4", "5"]
      },
      {
        id: "meal",
        label: "食事のバランス・時間",
        items: ["1", "2", "3", "4", "5"]
      },
      {
        id: "stress",
        label: "ストレス・気分の安定度",
        items: ["1", "2", "3", "4", "5"]
      }
    ]
  },
  {
    id: "Q3",
    header: "【Q3】セルフケアの実施状況",
    body: "「ととのうガイド」のセルフケアは、どれくらい取り組めていますか？",
    isMulti: true,
    options: [
      {
        id: "habits",
        label: "体質改善の生活習慣",
        items: ["未着手", "時々", "継続中"]
      },
      {
        id: "breathing",
        label: "呼吸法",
        items: ["未着手", "時々", "継続中"]
      },
      {
        id: "stretch",
        label: "ストレッチ",
        items: ["未着手", "時々", "継続中"]
      },
      {
        id: "tsubo",
        label: "ツボケア",
        items: ["未着手", "時々", "継続中"]
      },
      {
        id: "kampo",
        label: "漢方薬",
        items: ["未使用", "時々", "服用中"]
      }
    ]
  },
  {
    id: "Q4",
    header: "【Q4】動作テストの変化",
    body: "...",
    isMulti: false,
    options: [
      { label: "1", data: "motion_level=1", displayText: "1" },
      { label: "2", data: "motion_level=2", displayText: "2" },
      { label: "3", data: "motion_level=3", displayText: "3" },
      { label: "4", data: "motion_level=4", displayText: "4" },
      { label: "5", data: "motion_level=5", displayText: "5" }
    ]
  },
{
  id: "Q5",
  header: "【Q5】セルフケアで困ったこと",
  body: "セルフケアに取り組む上で、難しかったこと・悩んだことがあれば教えてください（今回もっとも感じたことを教えてください）",
  isMulti: false,
  options: [
    { label: "やり方が分からなかった", data: "Q5=A", displayText: "やり方が分からなかった" },
    { label: "効果を感じなかった", data: "Q5=B", displayText: "効果を感じなかった" },
    { label: "時間が取れなかった", data: "Q5=C", displayText: "時間が取れなかった" },
    { label: "体に合わない気がした", data: "Q5=D", displayText: "体に合わない気がした" },
    { label: "モチベーションが続かなかった", data: "Q5=E", displayText: "モチベーションが続かなかった" },
    { label: "特になし", data: "Q5=F", displayText: "特になし" }
  ]
}
];

module.exports = followupQuestionSet;
