const adviceDictionary = {
  "虚寒・気血両虚タイプ": `🧊体力もエネルギーも不足し、冷えや乾燥、疲れが出やすいタイプです。  
だからこそ、温めて“底力”を引き出すケアがカギ！

✖️体を冷やす飲み物（緑茶・麦茶・アイスコーヒー）は控えめに  
✖️夜ふかし・睡眠不足は体の回復チャンスを奪います  

⭕️体を温め、気血を補う生活を  
・食材：山芋・かぼちゃ・鶏むね肉＋なつめ・黒ごま  
・飲み物：ほうじ茶・アールグレイ（＋黒豆茶・生姜紅茶）  
・アロマ：ジンジャー（温かみのあるスパイシー系）

“ちょい温活”でもOK！コツコツ続ければ、体がふわっと軽くなりますよ。`,

  "陽虚傾向タイプ": `🧣朝のだるさや冷えやすさを感じやすいタイプです。  
体の火力を少しずつ育てる温活が効果的！

✖️体を冷やす飲料・アイス習慣は控えめに  
✖️無理な早起きや睡眠不足も冷えを悪化させます  

⭕️温め習慣を少しプラス  
・食材：ねぎ・しょうが・ごぼう＋鶏むね肉  
・飲み物：ほうじ茶・黒豆茶（＋生姜紅茶）  
・アロマ：シナモン（甘く温かい香り）

“朝の白湯＋スープ”で火力を上げて1日をスタート！`,

  "陽虚（本格型）タイプ": `🥶芯まで冷え込む本格虚寒タイプです。  
じっくり温めながら栄養を補給しましょう。

✖️冷たい食べ物・ドリンクの常用はNG  
✖️長時間の冷えた環境での作業も負担に  

⭕️温め＋滋養を意識  
・食材：鶏肉・山芋・かぼちゃ＋黒ごま・なつめ  
・飲み物：黒豆茶・生姜紅茶・ほうじ茶  
・アロマ：クローブ（スパイシーで温かい香り）

温かいスープやお粥を“毎日一杯”習慣に！`,

  "血虚タイプ": `🩸血が不足気味で、乾燥や不眠、気持ちの不安定さが出やすいタイプです。  
養血のケアで内側から潤いをチャージ！

✖️夜ふかし・ブルーライト過多（スマホ）に注意  
✖️お菓子・カフェイン過剰摂取は血を消耗します  

⭕️血を養う食材を意識  
・食材：小松菜・レバー・まぐろ赤身＋クコの実・黒ごま  
・飲み物：ルイボスティー・ほうじ茶（＋なつめ茶）  
・アロマ：ローズ（華やかで心を和らげる香り）

“養血食材＋しっかり睡眠”で目と心を回復！`,

  "単純気虚タイプ": `🍃疲れやすく、胃腸が弱い体質です。  
エネルギーのベースを養う習慣を身につけましょう！

✖️早食い・過食・冷たい飲食は避ける  
✖️気合だけで動き続けるのは逆効果  

⭕️気を補う生活を  
・食材：山芋・かぼちゃ・鶏むね肉＋はとむぎ  
・飲み物：ルイボスティー・黒豆茶  
・アロマ：スイートオレンジ（優しく元気を与える香り）

“よく噛んで、深呼吸”がパワーの源！`,

  "気虚タイプ": `⚡気力不足で疲れやすく、顔色もパッとしにくいタイプです。  
生活リズムと栄養補給で自然と元気が戻ります！

✖️寝不足・不規則な食事は消耗の原因  
✖️コンビニ食やカフェイン頼りはNG  

⭕️内側からエネルギー補給  
・食材：雑穀米・根菜・豆製品＋鶏肉・黒ごま  
・飲み物：黒豆茶・ルイボスティー  
・アロマ：ベルガモット（爽やかで心を整える香り）

“しっかり休む日”をスケジュールに！`,

  "陰虚（虚熱）タイプ": `🔥乾燥やほてり、不眠が出やすいタイプです。  
クールダウンと潤いケアがポイント！

✖️辛いもの・アルコール・夜更かしは火照りを悪化  
✖️熱いお風呂は体力を奪います  

⭕️潤い＋クールダウン  
・食材：れんこん・豆腐・白きくらげ＋クコの実  
・飲み物：ルイボスティー・はとむぎ茶  
・アロマ：サンダルウッド（落ち着くウッディ系）

“潤いごはん＋ハーブティー”で焦りも鎮まります！`,

  "鬱熱（繊細型）タイプ": `😖ストレスで熱がこもり、気分の乱れが出やすいタイプです。  
まずは“緩める時間”を確保しましょう！

✖️我慢のしすぎ・気遣い過多は熱の元  
✖️スナック・脂っこい食事も悪化因子  

⭕️巡りを整える香りと食事  
・食材：しそ・セロリ・柑橘類＋ミント  
・飲み物：ジャスミンティー・ルイボスティー  
・アロマ：ラベンダー（気分を解きほぐす香り）

深呼吸と香りで“ふっと軽く”なりましょう！`,

  "寒・瘀血タイプ": `🧊冷えと血の滞りが重なりやすいタイプです。  
まずは温めて巡りを回復！

✖️冷たい床に直接座る・長時間同じ姿勢はNG  
✖️冷飲料・甘いドリンクは巡りを悪化させます  

⭕️巡り食材を活用  
・食材：玉ねぎ・生姜・青魚＋黒豆  
・飲み物：黒豆茶・生姜紅茶  
・アロマ：ローズマリー（巡りを活性化する香り）

“軽く動いて温める”が流れを変えるコツ！`,

  "単純寒証タイプ": `🌬️冷えやすいシンプル寒タイプ。  
温活習慣で冬も快適に！

✖️アイス・冷たいドリンクは常用しない  
✖️冷えた環境で薄着はNG  

⭕️温めるケアを  
・食材：かぼちゃ・しょうが・長ねぎ  
・飲み物：生姜紅茶・黒豆茶  
・アロマ：シナモン（甘く温かい香り）

“朝晩の温スープ”で体を守る！`,

  "血虚傾向タイプ": `💤少しの血不足で疲れや乾燥が出やすいタイプです。  
養血を意識するだけでグッと変わります！

✖️寝不足・ブルーライト過剰は血を消耗  
✖️菓子・カフェイン過剰は避けましょう  

⭕️血を育てる食事を  
・食材：小松菜・卵・レバー＋黒ごま  
・飲み物：ルイボスティー・なつめ茶  
・アロマ：ローズ（華やかで優しい香り）

“夜11時前の就寝”が血の補給時間！`,

 "平性（偏りなし）": `🙂バランスは良好なタイプです。  
今の状態をキープすることが一番の健康法！

✖️寝不足・暴飲暴食はリズムを乱します  
✖️ストレス溜めすぎも体調悪化の原因に  

⭕️毎日のメンテ習慣を  
・食材：旬の野菜・豆製品・雑穀米  
・飲み物：ほうじ茶・ルイボスティー  
・アロマ：ユーカリ（クリアで爽快な香り）

“普通を続ける”ことが実は一番難しく、最強です！`,

  "気虚傾向タイプ": `🌬️少しの疲れや風邪に弱いタイプです。  
生活リズムを整えるだけでもぐっと変わります！

✖️夜更かし・過労はエネルギー消耗の原因  
✖️カフェイン過剰摂取は気力を削ります  

⭕️気を養う食事を  
・食材：山芋・さつまいも・鶏むね肉  
・飲み物：黒豆茶・ルイボスティー  
・アロマ：スイートオレンジ（元気を与える香り）

“朝日を浴びる＋深呼吸”がエネルギー充電に！`,

  "陰虚タイプ（代謝高め）": `🔥活動的だけど乾燥やほてりが出やすいタイプです。  
潤いを意識してケアをしましょう。

✖️辛いもの・アルコール・熱い風呂は控えめに  
✖️睡眠不足は乾燥悪化の原因  

⭕️潤いケアを  
・食材：れんこん・豆腐・山芋＋白きくらげ  
・飲み物：ルイボスティー・はとむぎ茶  
・アロマ：ゼラニウム（やわらかで甘い香り）

“潤す・冷ます”で代謝も安定します！`,

  "気滞熱タイプ": `💢ストレスや感情の滞りで熱がこもりやすいタイプです。  
すっきり流す工夫が大事！

✖️イライラしながらの食事や過食は逆効果  
✖️甘い物・脂っこい食事のドカ食いに注意  

⭕️香りと巡りで気分リセット  
・食材：柑橘類・セロリ・レタス  
・飲み物：烏龍茶・ジャスミンティー  
・アロマ：ライム（爽やかで頭をクリアに）

“軽い運動＋深呼吸”で頭の熱がスーッと抜けます！`,

  "鬱熱タイプ": `🧠考えすぎ・緊張で熱がこもりやすいタイプです。  
まずはリセット習慣を。

✖️我慢・無理しすぎは熱化の元  
✖️刺激の強いカフェイン・エナジードリンクはNG  

⭕️気分を緩める工夫を  
・食材：しそ・セロリ・大葉＋柑橘類  
・飲み物：ジャスミンティー・ルイボスティー  
・アロマ：ラベンダー（穏やかに気分を解く香り）

“香り＋呼吸”で心をほぐしましょう！`,

  "実寒・瘀血タイプ": `❄️冷えと血の滞りが深く残りやすいタイプです。  
しっかり温めて流すケアが必要です！

✖️冷たい飲食・長時間の座りっぱなしはNG  
✖️アルコール過多も巡りを乱します  

⭕️温め＋血流ケアを  
・食材：玉ねぎ・生姜・黒酢＋青魚  
・飲み物：生姜紅茶・黒豆茶  
・アロマ：ローズマリー（血流をサポートする香り）

“温める＋ストレッチ”がダブルで効きます！`,

  "実寒（外因性）タイプ": `🥶外からの冷えで体調を崩しやすいタイプです。  
冷えを追い出すケアを習慣に！

✖️濡れた髪で寝る・冷えた床に直座りはNG  
✖️冷飲料やアイスの常用は避ける  

⭕️温めと保護を  
・食材：しょうが・長ねぎ・味噌  
・飲み物：生姜紅茶・黒豆茶  
・アロマ：クローブ（温かいスパイシーな香り）

“外因冷え”は早めにリセット！`,

  "実寒・水滞タイプ": `💧冷え＋余分な水分が溜まりやすいタイプです。  
むくみや重だるさは排水サイン！

✖️水の飲みすぎ・清涼飲料の常用は控えましょう  
✖️夜更かしで代謝ダウンに注意  

⭕️巡り＋排水をサポート  
・食材：はとむぎ・玉ねぎ・あさり  
・飲み物：黒豆茶・ルイボスティー  
・アロマ：グレープフルーツ（すっきりした柑橘の香り）

“温めて流す”で体が軽くなります！`,

  "血虚（過活動型）タイプ": `🏃‍♂️動きすぎで血が不足し、乾燥や疲れが出やすいタイプです。  
休む勇気も大事！

✖️無理なダイエットや夜型生活は血を減らします  
✖️コーヒー・エナジードリンク過多もNG  

⭕️血を補うごはんを  
・食材：レバー・黒豆・まぐろ赤身＋クコの実  
・飲み物：ルイボスティー・なつめ茶  
・アロマ：ローズ（女性バランスを整える香り）

“休む時間”も血を増やす大切な栄養！`,

  "体力充実タイプ": `💪体力はあるけど頑張りすぎると偏りが出やすいタイプです。  
休むのもスキルのひとつ！

✖️連日の深酒・夜更かしは体を消耗させます  
✖️オーバーワークに注意  

⭕️巡りと休養を意識  
・食材：旬の野菜・魚・雑穀米  
・飲み物：ほうじ茶・烏龍茶  
・アロマ：ユーカリ（リフレッシュする香り）

“軽めの運動＋しっかり睡眠”で最強バランス！`,

  "気虚（過活動型）タイプ": `💨動きすぎてエネルギー切れしやすいタイプです。  
無理しすぎサインを見逃さないで！

✖️夜更かし＋カフェインでの無理はNG  
✖️甘い物のドカ食いも気力ダウンに  

⭕️気をチャージ  
・食材：雑穀米・山芋・鶏むね肉  
・飲み物：黒豆茶・ルイボスティー  
・アロマ：スイートオレンジ（元気を引き出す香り）

“走る前にひと呼吸”でスタミナ長持ち！`,

  "陰虚火旺タイプ": `🔥潤い不足で熱がこもりやすく、イライラ・不眠が出やすいタイプです。  
冷ますケアと潤いが大切！

✖️辛い物・揚げ物・夜更かしは火に油  
✖️激しい運動しすぎは逆効果  

⭕️クールダウンと潤いを  
・食材：豆腐・トマト・れんこん＋白きくらげ  
・飲み物：ルイボスティー・はとむぎ茶  
・アロマ：ローズ（華やかで落ち着く香り）

“ひと息つくだけ”で熱の抜け方が変わります！`,

  "実熱タイプ": `♨️体力があり熱がこもりやすいタイプです。  
熱を逃がす習慣がカギ！

✖️激辛料理・アルコール・夜更かしは熱をためます  
✖️カフェインの摂りすぎも要注意  

⭕️清涼感を意識  
・食材：きゅうり・セロリ・トマト＋苦瓜  
・飲み物：緑茶・烏龍茶（＋ジャスミンティー）  
・アロマ：ペパーミント（清涼感で頭スッキリ）

“クールフード＋深呼吸”でスッと軽く！`,

  "鬱熱（過活動型）タイプ": `🚀忙しさや考えすぎでオーバーヒートしがちなタイプです。  
“ひと息つく習慣”が必要です。

✖️スマホ漬け・考えすぎは熱をこもらせます  
✖️冷たい甘い物や高カロリー食はNG  

⭕️クール＆リラックスを  
・食材：柑橘類・レタス・しそ＋セロリ  
・飲み物：緑茶・ジャスミンティー  
・アロマ：ライム（爽やかで頭をクリアに）

“軽く動いてリフレッシュ”が熱抜きの特効薬！`
};

module.exports = adviceDictionary;
