// stomach
const stomach_Q1 = require('./stomach_Q1');
const stomach_Q2 = require('./stomach_Q2');
const stomach_Q3 = require('./stomach_Q3');
const stomach_Q4 = require('./stomach_Q4');

// pain
const pain_Q1 = require('./pain_Q1');
const pain_Q2 = require('./pain_Q2');
const pain_Q3 = require('./pain_Q3');
const pain_Q4 = require('./pain_Q4');

// skin
const skin_Q1 = require('./skin_Q1');
const skin_Q2 = require('./skin_Q2');
const skin_Q3 = require('./skin_Q3');
const skin_Q4 = require('./skin_Q4');

// pollen
const pollen_Q1 = require('./pollen_Q1');
const pollen_Q2 = require('./pollen_Q2');
const pollen_Q3 = require('./pollen_Q3');
const pollen_Q4 = require('./pollen_Q4');

// women
const women_Q1 = require('./women_Q1');
const women_Q2 = require('./women_Q2');
const women_Q3 = require('./women_Q3');
const women_Q4 = require('./women_Q4');

// common
const common_Q1 = require('./common_Q1');
const common_Q2 = require('./common_Q2');
const common_Q3 = require('./common_Q3');
const common_Q4 = require('./common_Q4');
const common_Q5 = require('./common_Q5');

module.exports = {
  stomach: {
    Q1: stomach_Q1,
    Q2: common_Q2,
    Q3: stomach_Q3,
    Q4: stomach_Q4,
    Q5: common_Q5,
  },
  sleep: {
    Q1: common_Q1,
    Q2: common_Q2,
    Q3: common_Q3,
    Q4: common_Q4,
    Q5: common_Q5,
  },
  pain: {
    Q1: pain_Q1,
    Q2: common_Q2,
    Q3: pain_Q3,
    Q4: pain_Q4,
    Q5: common_Q5,
  },
  mental: {
    Q1: common_Q1,
    Q2: common_Q2,
    Q3: common_Q3,
    Q4: common_Q4,
    Q5: common_Q5,
  },
  cold: {
    Q1: common_Q1,
    Q2: common_Q2,
    Q3: common_Q3,
    Q4: common_Q4,
    Q5: common_Q5,
  },
  skin: {
    Q1: skin_Q1,
    Q2: common_Q2,
    Q3: skin_Q3,
    Q4: skin_Q4,
    Q5: common_Q5,
  },
  pollen: {
    Q1: pollen_Q1,
    Q2: common_Q2,
    Q3: pollen_Q3,
    Q4: pollen_Q4,
    Q5: common_Q5,
  },
  women: {
    Q1: women_Q1,
    Q2: common_Q2,
    Q3: women_Q3,
    Q4: women_Q4,
    Q5: common_Q5,
  },
  unknown: {
    Q1: common_Q1,
    Q2: common_Q2,
    Q3: common_Q3,
    Q4: common_Q4,
    Q5: common_Q5,
  },
};
