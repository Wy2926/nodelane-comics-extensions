// SPDX-License-Identifier: GPL-3.0-only
// Current /classify navigation; protocol adapted from Keiyoushi Baozi / Filters.
const BZ_FILTERS = [
  ['region','地区',[['全部','all'],['国漫','cn'],['日本','jp'],['韩国','kr'],['欧美','en']]],
  ['state','状态',[['全部','all'],['连载中','serial'],['已完结','pub']]],
  ['type','题材',[['全部','all'],['恋爱','lianai'],['纯爱','chunai'],['古风','gufeng'],['异能','yineng'],['悬疑','xuanyi'],['剧情','juqing'],['科幻','kehuan'],['奇幻','qihuan'],['玄幻','xuanhuan'],['穿越','chuanyue'],['冒险','mouxian'],['推理','tuili'],['武侠','wuxia'],['格斗','gedou'],['战争','zhanzheng'],['热血','rexie'],['搞笑','gaoxiao'],['大女主','danuzhu'],['都市','dushi'],['总裁','zongcai'],['后宫','hougong'],['日常','richang'],['韩漫','hanman'],['少年','shaonian'],['其它','qita']]],
  ['filter','首字母',[['全部','*'],...['ABCD','EFGH','IJKL','MNOP','QRST','UVW','XYZ','0-9'].map(v=>[v,v])]]
];
