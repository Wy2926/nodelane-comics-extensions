import vm from 'node:vm';
import assert from 'node:assert/strict';
import {parseHTML, DOMParser} from 'linkedom';

// Execute the same serialized program produced by Node or the App's QuickJS bridge.
export async function runPage(script, {html, reader = html, url, status = 200, challenge = false, wait = false, delayedBridge = false}) {
    const {document} = parseHTML(html);
    document.readyState = 'complete';
    const timers = new Set();
    let finish, clock = 0, replies = 0, platformReady;
    const done = new Promise(resolve => finish = resolve);
    const context = vm.createContext({document, location: new URL(url), URL, DOMParser, AbortController,
        navigator: {userAgent: 'Fixture device WebView'},
        Date: class extends Date { static now() { return clock; } },
        setTimeout(fn, ms) {
            const timer = setTimeout(() => { timers.delete(timer); if (ms === 250) clock += wait ? 30000 : 250; fn(); }, ms === 250 ? 1 : ms);
            timers.add(timer); return timer;
        },
        clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
        fetch: async (url, init) => {
            assert.equal(init.credentials, 'include');
            return {url, ok: status === 200, status, headers: new Headers(challenge ? {'cf-mitigated':'challenge'} : {}), text: async () => reader};
        },
        addEventListener(name, listener, options) {
            assert.equal(name, 'flutterInAppWebViewPlatformReady'); assert.equal(options.once, true); platformReady = listener;
        },
    });
    context.window = context;
    const bridge = {callHandler: async (name, result) => { assert.equal(name, 'setResponse'); replies++; finish(result); }};
    if (!delayedBridge) context.flutter_inappwebview = bridge;
    try {
        vm.runInContext(script, context);
        vm.runInContext(script, context);
        if (delayedBridge) { context.flutter_inappwebview = bridge; platformReady(); }
        const result = await done;
        assert.equal(replies, 1);
        assert.equal(timers.size, 0);
        return result;
    } finally { for (const timer of timers) clearTimeout(timer); }
}

if (process.argv[2] === '--stdin') {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const {script, ...options} = JSON.parse(input);
    process.stdout.write(await runPage(script, options));
}
