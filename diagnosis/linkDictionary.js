const linkDictionary = {
  "虚寒・血虚タイプ": `■おすすめの市販漢方薬
・当帰芍薬散
・桂枝湯
※冷えや貧血傾向、胃腸の弱さが気になる方におすすめです。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陽虚傾向タイプ": `■おすすめの市販漢方薬
・真武湯
・八味丸
※冷えと疲れが強い方に。代謝低下の改善に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陽虚（本格型）タイプ": `■おすすめの市販漢方薬
・八味地黄丸
・真武湯
※下半身の冷え、頻尿、疲れやすい方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "血虚（虚熱予備軍）タイプ": `■おすすめの市販漢方薬
・四物湯
・帰脾湯
※血の不足によるめまい・立ちくらみに。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "単純気虚タイプ": `■おすすめの市販漢方薬
・補中益気湯
・六君子湯
※元気が出ず、食後に眠気が出る方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "気虚タイプ": `■おすすめの市販漢方薬
・六君子湯
・補中益気湯
※食欲不振・胃もたれ・疲れやすい方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陰虚（虚熱）タイプ": `■おすすめの市販漢方薬
・麦門冬湯
・滋陰降火湯
※乾燥・空咳・のぼせや寝汗が気になる方。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "虚熱（亢進型）タイプ": `■おすすめの市販漢方薬
・柴胡桂枝乾姜湯
・加味逍遥散
※熱と冷えが混在するタイプに。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "虚熱・気滞タイプ": `■おすすめの市販漢方薬
・加味逍遥散
・逍遥散
※自律神経の乱れやPMSに悩む方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "寒＋血虚タイプ": `■おすすめの市販漢方薬
・当帰芍薬散
・桂枝茯苓丸
※冷えと貧血気味の女性に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "単純寒証タイプ": `■おすすめの市販漢方薬
・桂枝湯
・当帰湯
※虚弱で風邪をひきやすい方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陽虚傾向タイプ": `■おすすめの市販漢方薬
・苓桂朮甘湯
・真武湯
※冷え＋水滞タイプに。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "血虚（省エネ）タイプ": `■おすすめの市販漢方薬
・四物湯
・帰脾湯
※血の巡りを良くし体調を整えたい方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "平性": `■おすすめの市販漢方薬
※特に偏りはないが体調に波がある方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "気虚（省エネ）タイプ": `■おすすめの市販漢方薬
・補中益気湯
・人参養栄湯
※体力が落ちてきた中高年におすすめ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陰虚タイプ（代謝高め）": `■おすすめの市販漢方薬
・麦門冬湯
・滋陰降火湯
※乾燥・のぼせ・微熱などが出やすい方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "単純熱証タイプ": `■おすすめの市販漢方薬
・黄連解毒湯
・三黄瀉心湯
※皮膚トラブルやのぼせがある方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "虚熱（過活動型）タイプ": `■おすすめの市販漢方薬
・加味逍遥散
・柴胡加竜骨牡蛎湯
※熱と疲れが同居する方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "実寒・血虚タイプ": `■おすすめの市販漢方薬
・当帰芍薬散
・真武湯
※冷え＋栄養不足で巡りが悪い方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "実寒（外因性）タイプ": `■おすすめの市販漢方薬
・麻黄附子細辛湯
・五積散
※風邪をひきやすく悪寒が強い方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "実寒・気虚タイプ": `■おすすめの市販漢方薬
・苓姜朮甘湯
・人参湯
※体が冷えて下痢しやすい方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "血虚(過活動型)タイプ": `■おすすめの市販漢方薬
・四物湯
・温経湯
※肌トラブルや不眠が気になる方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "体力充実タイプ": `■おすすめの市販漢方薬
・十全大補湯
・人参養栄湯
※体力はあるが冷えがあるタイプに。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "気虚（過活動型）タイプ": `■おすすめの市販漢方薬
・補中益気湯
・十全大補湯
※一見元気だがすぐ疲れる方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "陰虚火旺タイプ": `■おすすめの市販漢方薬
・知柏地黄丸
・温清飲
※イライラ・寝汗・ほてりが強い方へ。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "実熱タイプ": `■おすすめの市販漢方薬
・黄連解毒湯
・三黄瀉心湯
※ニキビや吹き出物が出やすい方に。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`,

  "鬱熱タイプ": `■おすすめの市販漢方薬
・竜胆瀉肝湯
・柴胡加竜骨牡蛎湯
※怒りっぽく、熱がこもるタイプに。

【ご案内】
ご自分の体質や症状の根本原因をもっと知りたい、しっかり整えていきたいという方は、
オンライン相談や訪問鍼灸でも全力サポートさせていただきます！`
};

module.exports = linkDictionary;
