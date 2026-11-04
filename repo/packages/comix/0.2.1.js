// SPDX-License-Identifier: GPL-3.0-only
// NodeLane comix; corresponding source: sources/comix/0.2.1/
const DefaultExtension = (() => {
// SPDX-License-Identifier: GPL-3.0-only
// Small, local codecs for QuickJS (which does not provide browser Web APIs).
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function atob(value) {
    const input = value.replace(/=+$/, '');
    if (!/^[A-Za-z0-9+/]*$/.test(input) || input.length % 4 === 1) throw protocolChanged();
    let bits = 0, count = 0, output = '';
    for (const char of input) {
        bits = (bits << 6) | base64Alphabet.indexOf(char);
        count += 6;
        if (count >= 8) { count -= 8; output += String.fromCharCode((bits >>> count) & 255); }
    }
    return output;
}
function btoa(input) {
    let output = '';
    for (let i = 0; i < input.length; i += 3) {
        const value = (input.charCodeAt(i) << 16) | ((input.charCodeAt(i + 1) || 0) << 8) | (input.charCodeAt(i + 2) || 0);
        output += base64Alphabet[(value >>> 18) & 63] + base64Alphabet[(value >>> 12) & 63];
        output += i + 1 < input.length ? base64Alphabet[(value >>> 6) & 63] : '=';
        output += i + 2 < input.length ? base64Alphabet[value & 63] : '=';
    }
    return output;
}
class TextEncoder {
    encode(value) {
        const encoded = encodeURIComponent(value);
        const bytes = [];
        for (let i = 0; i < encoded.length; i++) {
            if (encoded[i] === '%') { bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16)); i += 2; }
            else bytes.push(encoded.charCodeAt(i));
        }
        return new Uint8Array(bytes);
    }
}
class TextDecoder {
    decode(bytes) {
        // Decode in bounded chunks without splitting a UTF-8 code point.
        let output = '', pending = '';
        for (let i = 0; i < bytes.length; i++) {
            pending += '%' + bytes[i].toString(16).padStart(2, '0');
            if (pending.length >= 12288 && (i + 1 === bytes.length || (bytes[i + 1] & 192) !== 128)) {
                output += decodeURIComponent(pending); pending = '';
            }
        }
        return output + decodeURIComponent(pending);
    }
}

// SPDX-License-Identifier: GPL-3.0-only
// Adapted from NodeLane Comics; provenance and source hashes: ../../THIRD_PARTY.md
// Independently implemented arithmetic; rotating public constants are read as data, never executed.
                                                                     

const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (x        , n        ) => (x >>> n) | (x << (32 - n));

/** Finish SHA-256 after the protocol's precomputed 64-byte prefix. */
function digest(input            , stateOffset        , protocol               )             {
  const protocolView = new DataView(protocol.data.buffer, protocol.data.byteOffset, protocol.data.byteLength);
  const state = Uint32Array.from({length: 8}, (_, index) => protocolView.getUint32(stateOffset + index * 4));
  const padded = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  const length = input.length + 64;
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index++) {
      const x = words[index - 15], y = words[index - 2];
      words[index] = words[index - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
        words[index - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) + K[index] + words[index]) >>> 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0;
      d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    state[0] += a; state[1] += b; state[2] += c; state[3] += d;
    state[4] += e; state[5] += f; state[6] += g; state[7] += h;
  }
  const output = new Uint8Array(32), outputView = new DataView(output.buffer);
  state.forEach((word, index) => outputView.setUint32(index * 4, word));
  return output;
}

function encodeRequest(text        , protocol               )         {
  const hash = digest(digest(new TextEncoder().encode(text), 0, protocol), 32, protocol);
  return protocol.version + '.' + btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').slice(0, 16);
}

function decodeResponse(text        , protocol               )         {
  const data = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
  if (data.length < 3) throw Error('Comix 返回的数据格式已变化。');
  const offset = ((data[0] << 8) | data[1]) % 1024;
  for (let index = 2; index < data.length; index++) data[index] ^= protocol.data[64 + (offset + index - 2) % 1024];
  return new TextDecoder('utf-8', {fatal: true}).decode(data.subarray(2));
}

// SPDX-License-Identifier: GPL-3.0-only
// Adapted from NodeLane Comics; provenance and source hashes: ../../THIRD_PARTY.md

const identifier = '[$\\w]+';
const boundary = '(?<![$\\w])';
const number = '(?:0x[\\da-f]+|\\d+(?:e\\d+)?)';
const quoted = '"(?:[^"\\\\]|\\\\.)*"';
const numbers = '\\[(?:' + number + '(?:,' + number + ')*,?)?\\]';
const escape = (value        ) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const protocolChanged = () => new Error('Comix 接口协议已变化，无法安全读取目录或章节；请稍后重试或在来源标签页阅读。');

/** Read literals from the observed public bundle layout. Never evaluate source or its rotation loop. */
function parseProtocolSource(source        )                {
  try { return parse(source); }
  catch { throw protocolChanged(); }
}

function parse(source        )                {
  if (source.length > 1024 * 1024 || !source.includes('new Uint8Array(1088)') ||
      !source.includes('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=')) throw Error();
  const alias = new RegExp('^const (' + identifier + ')=(' + identifier + ');').exec(source);
  if (!alias) throw Error();
  const call = escape(alias[1]);
  const decoder = new RegExp('function ' + escape(alias[2]) + '\\([^)]*\\)\\{(' + identifier + ')-=(' + number + ');const (' + identifier + ')=(' + identifier + ')\\(\\);').exec(source);
  if (!decoder) throw Error();
  const tableMatch = new RegExp('function ' + escape(decoder[4]) + '\\(\\)\\{const (' + identifier + ')=(\\[(?:"[A-Za-z0-9+/=]*",?)+\\]);').exec(source);
  if (!tableMatch) throw Error();
  const encoded          = JSON.parse(tableMatch[2]);
  if (!Array.isArray(encoded) || encoded.length < 16 || encoded.length > 8192) throw Error();
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
  const standard = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const utf8 = new TextDecoder('utf-8', {fatal: true});
  const table = encoded.map(value => {
    if (typeof value !== 'string' || value.length > 32768) throw Error();
    const text = value.replace(/[A-Za-z]/g, char => standard[alphabet.indexOf(char)]);
    return utf8.decode(Uint8Array.from(atob(text), char => char.charCodeAt(0)));
  });
  // kid/material identify the rotation without running the bundle's arithmetic or browser checks.
  const metadata = new RegExp('const (' + identifier + ')=\\{\\};\\1\\[' + call + '\\((' + number + ')\\)\\]=' + call + '\\((' + number + ')\\),\\1\\[' + call + '\\((' + number + ')\\)\\]=function\\(\\)\\{[^{}]{0,200}new Uint8Array\\(1088\\)').exec(source);
  if (!metadata) throw Error();
  const base = Number(decoder[2]);
  const index = (value        , rotation        ) => ((value - base + rotation) % table.length + table.length) % table.length;
  const rotations = table.flatMap((_, rotation) => table[index(Number(metadata[2]), rotation)] === 'kid' &&
    table[index(Number(metadata[4]), rotation)] === 'material' ? [rotation] : []);
  if (rotations.length !== 1) throw Error();
  const lookup = (value        ) => {
    const position = Number(value) - base;
    if (!Number.isSafeInteger(position) || position < 0 || position >= table.length) throw Error();
    return table[index(Number(value), rotations[0])];
  };
  const version = lookup(metadata[3]);
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(version)) throw Error();
  const literalSource = source.slice(0, metadata.index).replace(new RegExp(boundary + call + '\\((' + number + ')\\)', 'g'), (_, value        ) => JSON.stringify(lookup(value)));
  const lists = [...literalSource.matchAll(new RegExp('(?:var|const|let) (' + identifier + ')=\\[(' + identifier + '(?:,' + identifier + ')*)\\];', 'g'))];
  const list = lists.at(-1);
  if (!list) throw Error();
  const descriptors = list[2].split(',');
  if (descriptors.length < 1 || descriptors.length > 64 || new Set(descriptors).size !== descriptors.length) throw Error();
  const chunks = descriptors.map(name => {
    const fields = [...literalSource.matchAll(new RegExp(boundary + escape(name) + '(?:\\.id|\\[(' + quoted + ')\\])=(' + quoted + '|' + number + ')', 'g'))];
    const values = new Map                 ();
    for (const field of fields) {
      const key = field[1] ? JSON.parse(field[1]) : 'id';
      if (!['id', 'start', 'mask', 'enc'].includes(key) || values.has(key)) throw Error();
      values.set(key, field[2].startsWith('"') ? JSON.parse(field[2]) : Number(field[2]));
    }
    const id = values.get('id'), start = values.get('start'), mask = values.get('mask'), mode = values.get('enc');
    if (values.size !== 4 || typeof id !== 'string' || typeof start !== 'number' || !Number.isSafeInteger(start) || start < 0 || start >= 1088 ||
        typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0 || mask > 255 || typeof mode !== 'number' || ![0, 1, 2].includes(mode)) throw Error();
    return {id, start, mask, mode};
  });
  const pools = new Map                                        ();
  for (const match of literalSource.matchAll(new RegExp(boundary + '(' + identifier + ')\\[(' + quoted + ')\\]=(' + quoted + '|' + numbers + ')', 'g'))) {
    const key          = JSON.parse(match[2]);
    if (typeof key !== 'string' || !chunks.some(chunk => chunk.id === key)) continue;
    const pool = pools.get(match[1]) ?? new Map                           ();
    if (pool.has(key)) throw Error();
    const value = match[3].startsWith('"') ? JSON.parse(match[3]) : match[3].slice(1, -1).split(',').filter(Boolean).map(Number);
    pool.set(key, value); pools.set(match[1], pool);
  }
  const candidates = [...pools.values()].filter(pool => chunks.every(chunk => pool.has(chunk.id)));
  if (candidates.length !== 1) throw Error();
  const data = new Uint8Array(1088), coverage = new Uint8Array(1088);
  for (const chunk of chunks) {
    const value = candidates[0].get(chunk.id) ;
    if (chunk.mode === 1 ? typeof value !== 'string' : !Array.isArray(value)) throw Error();
    const bytes = typeof value === 'string' ? Array.from(value, char => char.charCodeAt(0) - 33) : chunk.mode === 2 ? value.slice(1) : value;
    if (!bytes.length || chunk.start + bytes.length > data.length) throw Error();
    for (const [offset, byte] of bytes.entries()) {
      const at = chunk.start + offset;
      if (!Number.isInteger(byte) || byte < 0 || byte > 255 || coverage[at]) throw Error();
      coverage[at] = 1; data[at] = byte ^ chunk.mask;
    }
  }
  if (coverage.some(value => value !== 1)) throw Error();
  return {version, data};
}

// SPDX-License-Identifier: GPL-3.0-only
// Mangayomi's MProvider contract; requests stay in the device's shared Client.
const origin = 'https://comix.to';
function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolChanged();
    return value;
}
function locationOf(value) {
    if (typeof value !== 'string') throw protocolChanged();
    const path = value.startsWith(origin + '/') ? value.slice(origin.length) : value;
    const match = /^\/title\/([a-z0-9]+)-([a-z0-9-]+)(?:\/(\d+)-chapter-(\d+(?:\.\d+)?))?$/.exec(path);
    if (!match) throw new Error('Comix 来源地址无效。');
    return {hid: match[1], chapterId: match[3], path, url: origin + path};
}
function imageUrl(value) {
    if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw protocolChanged();
    if (value.startsWith('/') && !value.startsWith('//')) return origin + value;
    // Do not pass credentials, local files or data URLs into the reader.
    if (!/^https:\/\/[a-z0-9.-]+(?::443)?\/[^#]*$/i.test(value)) throw protocolChanged();
    return value;
}
function assetUrl(value, base = origin + '/browse') {
    const resolved = value.startsWith('./') ? base.slice(0, base.lastIndexOf('/') + 1) + value.slice(2)
        : value.startsWith('/') ? origin + value
        : value.startsWith('https://') ? value : base.slice(0, base.lastIndexOf('/') + 1) + value;
    if (!/^https:\/\/comix\.to\/assets\/(?:build\/[a-z0-9]+\/dist|t3\/dist)\/[\w-]+\.js$/.test(resolved)) throw protocolChanged();
    return resolved;
}
function single(values) {
    const unique = [...new Set(values)];
    if (unique.length !== 1) throw protocolChanged();
    return unique[0];
}
function pageNumber(page) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 9999) throw new Error('Comix 页码无效。');
    return page;
}
function paginated(result, page, limit) {
    const meta = object(result.meta);
    if (!Array.isArray(result.items) || !Number.isSafeInteger(meta.total) || meta.total < 0 ||
        meta.page !== page || meta.perPage !== limit || meta.lastPage !== Math.max(1, Math.ceil(meta.total / limit)) ||
        meta.hasNext !== (page < meta.lastPage) ||
        result.items.length !== Math.min(limit, Math.max(0, meta.total - (page - 1) * limit))) throw protocolChanged();
    return meta;
}

class ComixExtension extends MProvider {
    constructor() {
        super();
        this.client = new Client({timeout: 25, connectTimeout: 10});
        this.protocol = null;
        this.pendingProtocol = null;
    }
    get supportsLatest() { return true; }
    // Let MClient attach the browser identity paired with its clearance cookie.
    getHeaders() { return {Referer: origin + '/'}; }
    getFilterList() { return []; }
    getSourcePreferences() { return []; }

    async response(url, limit) {
        const response = await this.client.get(url, this.getHeaders());
        const headers = response.headers || {};
        if (Object.keys(headers).some(key => key.toLowerCase() === 'cf-mitigated' && String(headers[key]).trim().toLowerCase() === 'challenge')) {
            throw new Error('Comix 需要 Cloudflare 验证，请在来源网页完成验证后重试。');
        }
        if (typeof response.body !== 'string' || response.body.length > limit) throw protocolChanged();
        return response;
    }
    async text(url, limit) {
        const response = await this.response(url, limit);
        if (response.statusCode !== 200) throw new Error('Comix 请求失败（HTTP ' + response.statusCode + '）。');
        return response.body;
    }
    async loadProtocol(refresh = false) {
        // A retired key can remain in CDN-cached HTML and modules. Only the
        // explicit retirement recovery bypasses those caches, once per call.
        const suffix = refresh ? '?nodelane_refresh=' + Date.now() : '';
        const read = (url, limit) => this.text(url + suffix, limit);
        const html = await read(origin + '/browse', 512 * 1024);
        const scripts = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
        const direct = scripts.filter(src => /(?:^|\/)apicore-[\w-]+\.js$/.test(src));
        let url;
        if (direct.length) url = single(direct.map(src => assetUrl(src)));
        else {
            const main = single(scripts.filter(src => /(?:^|\/)main-[\w-]+\.js$/.test(src)).map(src => assetUrl(src)));
            const bootstrap = await read(main, 1024 * 1024);
            url = single([...bootstrap.matchAll(/["']((?:\.\/)?apicore-[\w-]+\.js)["']/g)].map(match => assetUrl(match[1], main)));
        }
        return parseProtocolSource(await read(url, 1024 * 1024));
    }
    async getProtocol(refresh = false) {
        if (this.protocol) return this.protocol;
        if (!this.pendingProtocol) {
            this.pendingProtocol = this.loadProtocol(refresh).then(value => this.protocol = value).finally(() => this.pendingProtocol = null);
        }
        return this.pendingProtocol;
    }
    async api(path, params = {}) {
        const pairs = Object.keys(params).sort().map(key => key + '=' + params[key]).join('&');
        let protocol = await this.getProtocol();
        for (let attempt = 0; attempt < 2; attempt++) {
            const query = {...params, _: encodeRequest(path + (pairs ? '?' + pairs : ''), protocol)};
            const url = origin + '/api/v1' + path + '?' + Object.keys(query).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(query[key])).join('&');
            const response = await this.response(url, 4 * 1024 * 1024);
            let raw;
            try { raw = object(JSON.parse(response.body)); } catch { throw protocolChanged(); }
            if (raw.error === 'captcha_required') {
                throw new Error('Comix 要求站点验证（captcha_required），请在来源章节网页完成后重试。');
            }
            if (raw.code === 'key_retired') {
                if (attempt) throw protocolChanged();
                if (this.protocol === protocol) this.protocol = null;
                protocol = await this.getProtocol(true);
                continue;
            }
            if (response.statusCode !== 200) throw new Error('Comix 请求失败（HTTP ' + response.statusCode + '）。');
            let decoded;
            try { decoded = typeof raw.e === 'string' ? object(JSON.parse(decodeResponse(raw.e, protocol))) : raw; }
            catch { throw protocolChanged(); }
            if (decoded.status !== 'ok') throw protocolChanged();
            return object(decoded.result);
        }
        throw protocolChanged();
    }
    async listing(page, params) {
        pageNumber(page);
        const result = await this.api('/manga', {...params, limit: '28', page: String(page), 'content_rating[0]': 'safe', 'content_rating[1]': 'suggestive'});
        const meta = paginated(result, page, 28), seen = new Set();
        const list = result.items.map(value => {
            const row = object(value), loc = locationOf(row.url);
            if (loc.chapterId || loc.hid !== row.hid || seen.has(loc.hid) || typeof row.title !== 'string' || !row.title.trim()) throw protocolChanged();
            seen.add(loc.hid);
            return {name: row.title, link: loc.url, imageUrl: imageUrl(row.poster?.medium || row.poster?.large), rating: row.contentRating};
        }).filter(row => row.rating === 'safe' || row.rating === 'suggestive')
            .map(({rating, ...row}) => row);
        return {list, hasNextPage: meta.hasNext};
    }
    getPopular(page) { return this.listing(page, {'order[views_30d]': 'desc'}); }
    getLatestUpdates(page) { return this.listing(page, {'order[chapter_updated_at]': 'desc'}); }
    search(query, page) { return this.listing(page, {keyword: query.trim(), 'order[relevance]': 'desc'}); }

    async getDetail(url) {
        const loc = locationOf(url);
        if (loc.chapterId) throw new Error('请使用 Comix 作品链接。');
        const detail = await this.api('/manga/' + loc.hid);
        if (detail.hid !== loc.hid || locationOf(detail.url).hid !== loc.hid || !Number.isSafeInteger(detail.id)) throw protocolChanged();
        if (!['safe', 'suggestive'].includes(detail.contentRating)) throw new Error('此测试来源仅收录普通分级作品。');
        const chapters = [], seen = new Set();
        let total;
        for (let page = 1; page <= 100; page++) {
            const result = await this.api('/manga/' + loc.hid + '/chapters', {limit: '100', page: String(page), 'order[number]': 'desc'});
            const meta = paginated(result, page, 100);
            if (meta.total > 10000 || total !== undefined && total !== meta.total) throw new Error('Comix 目录正在变化，请重试。');
            total = meta.total;
            for (const row of result.items) {
                const chapter = locationOf(row.url);
                if (chapter.hid !== loc.hid || Number(chapter.chapterId) !== row.id || row.mangaId !== detail.id ||
                    !Number.isSafeInteger(row.id) || seen.has(row.id) || row.language !== 'en' || !Number.isFinite(Number(row.number))) throw protocolChanged();
                seen.add(row.id);
                const date = Date.parse(row.createdAt || '');
                chapters.push({name: 'Chapter ' + row.number + (row.name ? ' · ' + row.name : ''), url: chapter.url,
                    scanlator: row.group?.name || (row.isOfficial ? 'Official' : ''),
                    ...(Number.isFinite(date) ? {dateUpload: String(date)} : {})});
            }
            if (!meta.hasNext) break;
        }
        if (chapters.length !== total) throw new Error('Comix 目录不完整，请重试。');
        // Preserve each upload's URL/scanlator as its identity, including chapter 0 and decimals.
        return {name: detail.title, link: loc.url, imageUrl: imageUrl(detail.poster?.large || detail.poster?.medium),
            description: detail.synopsis || '', author: (detail.authors || []).map(row => row.title).join(', '),
            artist: (detail.artists || []).map(row => row.title).join(', '), genre: (detail.genres || []).map(row => row.title),
            status: {releasing: 0, finished: 1, completed: 1, hiatus: 2, cancelled: 3}[detail.status] ?? 5, chapters};
    }
    async getPageList(url) {
        const loc = locationOf(url);
        if (!loc.chapterId) throw new Error('请使用 Comix 章节链接。');
        const result = await this.api('/chapters/' + loc.chapterId);
        const returned = locationOf(result.url);
        if (String(result.id) !== loc.chapterId || returned.chapterId !== loc.chapterId || returned.hid !== loc.hid) throw protocolChanged();
        const pages = object(result.pages);
        if (!Array.isArray(pages.items) || !pages.items.length || pages.items.length > 1500) throw protocolChanged();
        return pages.items.map(row => {
            if (row.s !== undefined && row.s !== 0 && row.s !== 1) throw protocolChanged();
            if (row.s === 1 && (typeof NodeLane === 'undefined' || !NodeLane.capabilities.includes('image.tile-shuffle.v1')))
                throw new Error('此章节使用打乱图片，请更新 NodeLane App 后再试。');
            return {url: imageUrl((pages.baseUrl || '') + row.url), headers: {Referer: ''},
                ...(row.s === 1 ? {imageProcessing: {type: 'tile-shuffle-v1', algorithm: 3,
                    seedMasks: {'03632': 58414, '02900': 117532}}} : {})};
        });
    }
}

return ComixExtension;
})();
