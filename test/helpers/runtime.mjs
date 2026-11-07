import {loadPlugin} from '../../scripts/runtime.mjs';

// Each test gets an isolated plugin and request log; no real network client.
export async function mockPlugin(slug, respond, globals = {}) {
    const requests = [];
    const plugin = await loadPlugin(slug, class {
        async request(method, url, headers, body) {
            const request = {method, url, headers, body};
            requests.push(request);
            return respond(request, requests.length);
        }
        get(url, headers) { return this.request('GET', url, headers); }
        post(url, headers, body) { return this.request('POST', url, headers, body); }
    }, globals);
    return {plugin, requests};
}
