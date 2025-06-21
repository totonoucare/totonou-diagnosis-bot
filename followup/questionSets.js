const followupQuestionSet = [
  {
    id: "Q1",
    header: "【Q1】主訴と全体調子の変化",
    body: "初回診断での「{{symptom}}」のお悩みレベルが5段階中の5として、今はどのくらいですか？\nまた、全体的なお身体の調子は、絶不調が5として、今はどのくらいですか？",
    isMulti: true,
    options: [
      {
        id: "symptom",
        label: "「{{symptom}}」のお悩みレベル",
        items: ["1", "2", "3", "4", "5"]
      },
      {
        id: "general",
        label: "全体的な調子",
        items: ["1", "2", "3", "4", "5"]
      }
    ]
  },
  {
    id: "Q2",
    header: "【Q2】生活状況の変化",
    body: "ここ最近、睡眠・食事・ストレスの状態はどうですか？1＝理想の状態、5＝最も乱れた状態としてお答えください",
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
        items: ["未実施", "時々", "ほぼ毎日"]
      },
      {
        id: "breathing",
        label: "呼吸法",
        items: ["未実施", "時々", "ほぼ毎日"]
      },
      {
        id: "stretch",
        label: "ストレッチ",
        items: ["未実施", "時々", "ほぼ毎日"]
      },
      {
        id: "tsubo",
        label: "ツボケア",
        items: ["未実施", "時々", "ほぼ毎日"]
      },
      {
        id: "kampo",
        label: "漢方薬",
        items: ["未使用", "時々", "ほぼ毎日"]
      }
    ]
  },{
  id: "Q4",
  header: "【Q4】動作テストの変化",
  body: "初回診断での「{{motion}}」の辛さが5段階で5として、今の状態はどのくらいですか？",
  isMulti: false,
  options: [
    { label: "1", data: "Q4=1", displayText: "1" },
    { label: "2", data: "Q4=2", displayText: "2" },
    { label: "3", data: "Q4=3", displayText: "3" },
    { label: "4", data: "Q4=4", displayText: "4" },
    { label: "5", data: "Q4=5", displayText: "5" }
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
    { label: "その他の理由", data: "Q5=F", displayText: "その他の理由" }
  ]
}
];

module.exports = followupQuestionSet;
