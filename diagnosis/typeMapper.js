console.log("🧠 typeMapper.js is ALIVE");

const typeMapper = {};

// 数値で安全にキー生成
[
  [-1, -1, -1, "虚寒・血虚タイプ"],
  [-1, -1,  0, "陽虚傾向タイプ"],
  [-1, -1,  1, "陽虚（本格型）タイプ"],
  [-1,  0, -1, "血虚（虚熱予備軍）タイプ"],
  [-1,  0,  0, "単純気虚タイプ"],
  [-1,  0,  1, "気虚タイプ"],
  [-1,  1, -1, "陰虚（虚熱）タイプ"],
  [-1,  1,  0, "虚熱（亢進型）タイプ"],
  [-1,  1,  1, "虚熱・気滞タイプ"],
  [ 0, -1, -1, "寒＋血虚タイプ"],
  [ 0, -1,  0, "単純寒証タイプ"],
  [ 0, -1,  1, "陽虚傾向タイプ"],
  [ 0,  0, -1, "血虚（省エネ）タイプ"],
  [ 0,  0,  0, "平性"],
  [ 0,  0,  1, "気虚（省エネ）タイプ"],
  [ 0,  1, -1, "陰虚タイプ（代謝高め）"],
  [ 0,  1,  0, "単純熱証タイプ"],
  [ 0,  1,  1, "虚熱（過活動型）タイプ"],
  [ 1, -1, -1, "実寒・血虚タイプ"],
  [ 1, -1,  0, "実寒（外因性）タイプ"],
  [ 1, -1,  1, "実寒・気虚タイプ"],
  [ 1,  0, -1, "血虚(過活動型)タイプ"],
  [ 1,  0,  0, "体力充実タイプ"],
  [ 1,  0,  1, "気虚（過活動型）タイプ"],
  [ 1,  1, -1, "陰虚火旺タイプ"],
  [ 1,  1,  0, "実熱タイプ"],
  [ 1,  1,  1, "鬱熱タイプ"],
].forEach(([a, b, c, label]) => {
  const key = `${a},${b},${c}`;
  typeMapper[key] = label;

  // 👇 各文字のコード確認ログを追加
  [...key].forEach((char, index) => {
    console.log(`🔍 文字: "${char}" / index ${index} / Unicode: U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  });
});

function getTypeName(score1, score2, score3) {
  const key = `${score1},${score2},${score3}`;
  const result = typeMapper[key];

  if (!result) {
    console.warn("🔍 getTypeName: 該当なし", key);
  } else {
    console.log("✅ getTypeName:", key, "→", result);
  }

  return result;
}

module.exports = getTypeName;
