const followupQuestionSet = [
  {
    id: "Q1",
    header: "【Q1】お体の変化",
    body: "体質分析時のお悩み\n「{{symptom}}」\n\nを含む体調レベルについて\n\n「1＝改善した」「5＝変わらずツライ」\nでお答えください。",
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
    body: "最近の睡眠・食事・ストレスの自覚状態について、それぞれ\n\n「1＝理想的」「5＝かなり乱れている」\nでお答えください。",
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
    header: "【Q3】動作の負荷チェックの変化",
    body: "初回分析時の「{{motion}}」\nのツラさの度合いについて、\n\n「1＝改善した」「5＝変わらずツライ」\nでお答えください。",
    isMulti: true, // ← 統一
    options: [
      {
        id: "motion_level",
        label: "「{{motion}}」のツラさ度合い",
        items: ["1", "2", "3", "4", "5"]
      }
    ]
  }
];

module.exports = followupQuestionSet;
