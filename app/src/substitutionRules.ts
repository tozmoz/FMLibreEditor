// FM27's substitution rules, as `db::COMP + 0xFD` holds them: `0xFF` leaves the competition's own
// rules alone, every other code is one of FM's substitution-rule values (see the recon notes:
// docs/recon/fm27-competition-rules.md). The order is FMRTE's dropdown's, with "do not override" first;
// the names come from FMRTE's language files, English unless the UI is Chinese.

import { locale } from "./i18n";

/** One substitution rule the game can be set to. */
export interface SubstitutionRule {
  code: number;
  en: string;
  zh: string;
}

/** Every code the editor offers, in the order the dropdown shows them. */
export const SUBSTITUTION_RULES: readonly SubstitutionRule[] = [
  { code: 255, en: "Do Not Override Sub Rules", zh: "不覆盖换人规则" },
  { code: 19, en: "No Subs Allowed", zh: "不允许替补" },
  { code: 2, en: "3 from 3", zh: "3 选 3" },
  { code: 5, en: "3+Gk from 4", zh: "4 选 3+门将" },
  { code: 6, en: "3 from 4", zh: "4 选 3" },
  { code: 1, en: "3 from 5", zh: "5 选 3" },
  { code: 3, en: "3+Gk from 5", zh: "5 选 3+门将" },
  { code: 13, en: "3 from 5 + 2 Extra Time Subs", zh: "5 选 3 + 加时赛 2 次换人" },
  { code: 14, en: "3+Gk from 5 + 2 Extra Time Subs", zh: "5 选 3+门将 + 加时赛 2 次换人" },
  { code: 11, en: "3 from 5 + 1 Extra Time Sub", zh: "5 选 3 + 加时赛 1 次换人" },
  { code: 12, en: "3+Gk from 5 + 1 Extra Time Sub", zh: "5 选 3+门将 + 加时赛 1 次换人" },
  { code: 7, en: "3 from 6", zh: "6 选 3" },
  { code: 15, en: "3+Gk from 6", zh: "6 选 3+门将" },
  { code: 27, en: "3 from 5+Gk", zh: "5+门将 选 3" },
  { code: 4, en: "3+Gk from 7", zh: "7 选 3+门将" },
  { code: 0, en: "3 from 7", zh: "7 选 3" },
  { code: 52, en: "3 from 7 + 2 Extra Time Sub", zh: "7 选 3 + 加时赛 2 次换人" },
  { code: 76, en: "3 from 7 (max of 3 stoppages) + 1 Extra Time Sub", zh: "7 选 3（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 22, en: "3+Gk from 7(home), 5(away)", zh: "3+门将（主场 7 人中选，客场 5 人中选）" },
  { code: 44, en: "3 from 7 + 1 Extra Time Sub", zh: "7 选 3 + 加时赛 1 次换人" },
  { code: 77, en: "3 from 7 (max of 3 stoppages)", zh: "7 选 3（最多 3 次换人时机）" },
  { code: 10, en: "3 from 9", zh: "9 选 3" },
  { code: 34, en: "3+Gk from 9", zh: "9 选 3+门将" },
  { code: 43, en: "3 from 9 + 1 Extra Time Sub", zh: "9 选 3 + 加时赛 1 次换人" },
  { code: 41, en: "3 from 10", zh: "10 选 3" },
  { code: 25, en: "3 from 11", zh: "11 选 3" },
  { code: 8, en: "3 from 12", zh: "12 选 3" },
  { code: 45, en: "3 from 12 + 1 Extra Time Sub", zh: "12 选 3 + 加时赛 1 次换人" },
  { code: 29, en: "4+Gk from 4", zh: "4 选 4+门将" },
  { code: 21, en: "4 from 7", zh: "7 选 4" },
  { code: 26, en: "4 from 9", zh: "9 选 4" },
  { code: 54, en: "4 from 12 (max of 3 stoppages)", zh: "12 选 4（最多 3 次换人时机）" },
  { code: 50, en: "4 from 12", zh: "12 选 4" },
  { code: 23, en: "5 from 5", zh: "5 选 5" },
  { code: 71, en: "5 from 6 (max of 3 stoppages)", zh: "6 选 5（最多 3 次换人时机）" },
  { code: 72, en: "5 from 6", zh: "6 选 5" },
  { code: 32, en: "5+Gk from 7", zh: "7 选 5+门将" },
  { code: 20, en: "5 from 7", zh: "7 选 5" },
  { code: 51, en: "5 from 7 + 1 Extra Time Sub", zh: "7 选 5 + 加时赛 1 次换人" },
  { code: 56, en: "5 from 7 (max of 3 stoppages)", zh: "7 选 5（最多 3 次换人时机）" },
  { code: 62, en: "5 from 7 (max of 3 stoppages) + 1 Extra Time Sub", zh: "7 选 5（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 16, en: "5 from 8", zh: "8 选 5" },
  { code: 17, en: "5 from 9", zh: "9 选 5" },
  { code: 49, en: "5 from 9 + 1 Extra Time Sub", zh: "9 选 5 + 加时赛 1 次换人" },
  { code: 58, en: "5 from 9 (max of 3 stoppages)", zh: "9 选 5（最多 3 次换人时机）" },
  { code: 63, en: "5 from 9 (max of 3 stoppages) + 1 Extra Time Sub", zh: "9 选 5（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 66, en: "5 from 10", zh: "10 选 5" },
  { code: 60, en: "5 from 10 (max of 3 stoppages) + 1 Extra Time Sub", zh: "10 选 5（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 68, en: "5 from 10 + 1 Extra Time Sub", zh: "10 选 5 + 加时赛 1 次换人" },
  { code: 59, en: "5 from 10 (max of 3 stoppages)", zh: "10 选 5（最多 3 次换人时机）" },
  { code: 64, en: "5 from 11", zh: "11 选 5" },
  { code: 70, en: "5 from 11 + 1 Extra Time Sub", zh: "11 选 5 + 加时赛 1 次换人" },
  { code: 69, en: "5 from 11 (max of 3 stoppages)", zh: "11 选 5（最多 3 次换人时机）" },
  { code: 61, en: "5 from 12 (max of 3 stoppages)", zh: "12 选 5（最多 3 次换人时机）" },
  { code: 48, en: "5 from 12", zh: "12 选 5" },
  { code: 57, en: "5 from 12 plus 1 Extra Time Sub", zh: "12 选 5 + 加时赛 1 次换人" },
  { code: 67, en: "5 from 12 (max of 3 stoppages) + 1 Extra Time Sub", zh: "12 选 5（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 73, en: "5 from 15 (max of 3 stoppages)", zh: "15 选 5（最多 3 次换人时机）" },
  { code: 74, en: "5 from 15", zh: "15 选 5" },
  { code: 75, en: "5 from 15 (max of 3 stoppages) + 1 Extra Time Sub", zh: "15 选 5（最多 3 次换人时机）+ 加时赛 1 次换人" },
  { code: 30, en: "6 from 7", zh: "7 选 6" },
  { code: 55, en: "3 from 9 plus 3 Half-Time Subs", zh: "9 选 3 + 中场休息 3 次换人" },
  { code: 24, en: "6 from 9", zh: "9 选 6" },
  { code: 46, en: "6 from 11", zh: "11 选 6" },
  { code: 33, en: "6 from 12", zh: "12 选 6" },
  { code: 9, en: "7 from 7", zh: "7 选 7" },
  { code: 47, en: "7 from 9", zh: "9 选 7" },
  { code: 35, en: "7 from 12", zh: "12 选 7" },
  { code: 36, en: "8 from 12", zh: "12 选 8" },
  { code: 37, en: "9 from 12", zh: "12 选 9" },
  { code: 28, en: "All from 10 (home), 12(away)", zh: "全部可换（主场 10 人，客场 12 人）" },
  { code: 65, en: "10 from 11", zh: "11 选 10" },
  { code: 38, en: "10 from 12", zh: "12 选 10" },
  { code: 39, en: "11 from 12", zh: "12 选 11" },
  { code: 40, en: "12 from 12", zh: "12 选 12" },
  { code: 18, en: "15 from 15", zh: "15 选 15" },
];

const BY_CODE = new Map(SUBSTITUTION_RULES.map((rule) => [rule.code, rule]));

/** The name of a code, in the language of the UI; a code the table does not know shows as its number. */
export function substitutionRuleName(code: number): string {
  const rule = BY_CODE.get(code);
  if (rule === undefined) return String(code);
  return locale === "zh-CN" ? rule.zh : rule.en;
}
