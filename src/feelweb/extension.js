// SPDX-License-Identifier: GPL-3.0-only
// Serial groups from Keiyoushi FeelWeb.kt (Apache-2.0).
const groups = [
  ['FEEL YOUNG', ['3269754496312166681','3269754496312166688']],
  ['マンガJam', ['3269754496312166692','3269754496312166700']],
  ['onBLUE', ['3269754496312166718','3269754496312166727']],
  ['SHODENSHA COMICS', ['3269754496312166710']],
];
const collections = [['作品一覧',groups.flatMap(([,ids])=>ids)], ...groups];
