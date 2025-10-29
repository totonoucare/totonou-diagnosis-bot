const followupQuestionSet = [
{
  id: "Q1",
  header: "【Q1】お体の変化", // ← 見出しはそのままでもOK
  body: "体質分析時のお悩み「{{symptom}}」を含む体調レベルについて\n「1＝改善した」「5＝変わらずツライ」\nでお答えください。",
  isMulti: true,
  options: [
    {
      id: "symptom",
      label: "「{{symptom}}」含む体調レベル",
      items: ["1", "2", "3", "4", "5"]
    }
  ]
},
  {
    id: "Q2",
    header: "【Q2】生活リズムの整い具合",
    body: "最近の睡眠・食事・ストレスの状態について、それぞれ\n「1＝理想的」「5＝かなり乱れている」\nでお答えください。",
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
    id: "Q4",
    header: "【Q4】動作テストの変化",
    body: "初回分析時の「{{motion}}」のツラさ度合いについて、\n「1＝改善した」「5＝変わらずツライ」\nでお答えください。",
    isMulti: false,
    options: [
      { label: "1", data: "Q4=1", displayText: "1" },
      { label: "2", data: "Q4=2", displayText: "2" },
      { label: "3", data: "Q4=3", displayText: "3" },
      { label: "4", data: "Q4=4", displayText: "4" },
      { label: "5", data: "Q4=5", displayText: "5" }
    ]
  }
];

module.exports = followupQuestionSet;
