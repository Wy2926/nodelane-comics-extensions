// SPDX-License-Identifier: GPL-3.0-only
// The site's reader selects the image line and decodes the manifest before populating data-src.
function readHipmhPages(url, hid, owner) {
  if (window.__nodeLaneHipmhReader) return;
  window.__nodeLaneHipmhReader = true;
  const run = async () => {
    let result;
    try {
      const deadline = Date.now() + 25000, expected = new URL(url);
      for (;;) {
        if (document.querySelector('#challenge-form, #challenge-running') || /just a moment/i.test(document.title))
          throw Error('请在来源网页完成验证后重试');
        if (location.origin !== expected.origin || location.pathname !== expected.pathname)
          throw Error('阅读页已跳转，章节归属不符');
        const reader = document.getElementById('chapcontent');
        const error = reader?.querySelector('.chapter-error-container');
        if (error) throw Error(error.dataset.state === 'unavailable' ? '源站已下架本章或章节不存在' : '源站阅读器加载失败，请重试');
        if (reader?.hasAttribute('data-total-images')) {
          if (reader.dataset.frontendHid !== hid || reader.dataset.mangaId !== owner ||
              (reader.dataset.chapterNumber && reader.dataset.chapterNum && Number(reader.dataset.chapterNumber) !== Number(reader.dataset.chapterNum)))
            throw Error('阅读页与请求的作品或章节不符');
          const images = Array.from(reader.querySelectorAll('img.chapter-image'));
          if (!images.length || images.length !== Number(reader.dataset.totalImages)) throw Error('正文页数不完整');
          const urls = images.map((img, i) => {
            if (img.dataset.index !== String(i) || !img.dataset.src?.trim()) throw Error('正文页位或图片地址缺失');
            return new URL(img.dataset.src, location.href).href;
          });
          result = {urls};
          break;
        }
        if (!reader && document.readyState === 'complete') throw Error('阅读器结构缺失');
        if (Date.now() >= deadline) throw Error('等待阅读器生成正文清单超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (e) {
      // Browser URL errors can include a full image URL.
      result = {error:e instanceof TypeError ? '正文图片地址或阅读器数据无效' : e.message};
    }
    await window.flutter_inappwebview.callHandler('setResponse', JSON.stringify(result));
  };
  if (window.flutter_inappwebview?.callHandler) void run();
  else window.addEventListener('flutterInAppWebViewPlatformReady', run, {once:true});
}
