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
