// SPDX-License-Identifier: GPL-3.0-only
// Adapted from Keiyoushi RawOtakuFilters; attribution and original terms in parser.js.
const RO_FILTERS = [
    ['type', '类型', [['全部','all'],['Raw Manga','Raw Manga'],['BLコミック','BLコミック'],['TLコミック','TLコミック'],
        ['オトナコミック','オトナコミック'],['女性マンガ','女性マンガ'],['少女マンガ','少女マンガ'],['少年マンガ','少年マンガ'],['青年マンガ','青年マンガ']]],
    ['status', '状态', [['全部','all'],['连载','Publishing'],['完结','Finished']]],
    ['language', '语言', [['全部','all'],['日语','ja'],['英语','en']]],
    ['sort', '排序', [['默认','default'],['最近更新','latest-updated'],['最多浏览','most-viewed'],['标题 A–Z','title-az'],['标题 Z–A','title-za']]],
];
