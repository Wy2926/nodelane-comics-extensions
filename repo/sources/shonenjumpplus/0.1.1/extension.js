// SPDX-License-Identifier: GPL-3.0-only
// Port of Keiyoushi ShonenJumpPlus.kt (Apache-2.0).
const collections = [['ジャンプ＋連載一覧',''],['ジャンプ＋読切シリーズ','/oneshot'],['連載終了作品','/finished']];
class SourceExtension extends GigaViewer {
  async collection(path, order) {
    const doc = new Document(await this.request('/series' + path));
    const day = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(Date.now()+9*3600000).getUTCDay()];
    const selector = (order === 'latest' ? 'h2.series-list-date-week.'+day+' + ' : '')+'ul.series-list';
    check(doc.select(selector).length, '连载列表缺失');
    const books = new Map();
    for (const a of doc.select(selector+' li a')) {
      const name = a.selectFirst('h2.series-list-title').text.trim();
      const loc = this.productLocation(a.attr('href'));
      const cover = a.selectFirst('div.series-list-thumb img').attr('data-src');
      let id;
      try { id = /\/series-[^/]+\/(\d+)-/.exec(decodeURIComponent(cover))?.[1]; } catch (_) {}
      const link = id ? this.bookUrl(id,loc.kind) : loc.url;
      check(name, '连载标题缺失');
      books.set(link,{name,link,imageUrl:cover ? this.image(cover,loc.url) : ''});
    }
    return [...books.values()];
  }
}
