// Single source of truth for courses and prices.
// Used by the website (to show prices and Pay buttons) AND by /api/checkout
// (so the price charged is always the one set here, never one sent from the browser).
//
// price_thb: set a number to show a "Pay" button; leave null for "price on request".
// weeks: length of a term block.

export const PRODUCTS = {
  ks3_maths_group: {
    course_code: "ks3-maths",
    level: "ks3",
    subject: "maths",
    format: "group",
    weeks: 10,
    price_thb: 5000, // 10 weeks x 500 THB
    name: { en: "KS3 Maths small group — 10-week term", th: "คณิตศาสตร์ KS3 กลุ่มเล็ก — 10 สัปดาห์", zh: "KS3 数学小班 — 10周课程" }
  },
  ks4_maths_group: {
    course_code: "ks4-maths",
    level: "ks4",
    subject: "maths",
    format: "group",
    weeks: 10,
    price_thb: 5000,
    name: { en: "KS4 Maths small group — 10-week term", th: "คณิตศาสตร์ KS4 กลุ่มเล็ก — 10 สัปดาห์", zh: "KS4 数学小班 — 10周课程" }
  },
  ks3_science_group: {
    course_code: "ks3-science",
    level: "ks3",
    subject: "science",
    format: "group",
    weeks: 10,
    price_thb: 5000,
    name: { en: "KS3 Science small group — 10-week term", th: "วิทยาศาสตร์ KS3 กลุ่มเล็ก — 10 สัปดาห์", zh: "KS3 科学小班 — 10周课程" }
  },
  igcse_one_to_one: {
    course_code: "igcse-1to1",
    level: "igcse",
    subject: "maths",
    format: "one_to_one",
    weeks: null,
    price_thb: null, // set your 1:1 price (e.g. a pack of 5 lessons) to enable online payment
    name: { en: "IGCSE Maths one-to-one", th: "คณิตศาสตร์ IGCSE ตัวต่อตัว", zh: "IGCSE 数学一对一" }
  },
  alevel_one_to_one: {
    course_code: "alevel-1to1",
    level: "alevel",
    subject: "maths",
    format: "one_to_one",
    weeks: null,
    price_thb: null,
    name: { en: "A-level Maths & Further Maths one-to-one", th: "คณิตศาสตร์ A-level และ Further Maths ตัวต่อตัว", zh: "A-level 数学及进阶数学一对一" }
  }
};

export const GROUP_SIZE_MAX = 6;
export const GROUP_LESSON_MINUTES = 75;
export const GROUP_WEEKLY_THB = 500;
