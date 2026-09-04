/* Headless verification harness for story-engine.js.
   Run:  node _verify.js
   Safe to delete — not loaded by the app. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname;

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(s => s.includes('function hashSeed'));
if (!main) { console.error('FAIL: inline app script not found'); process.exit(1); }

const ctx = { console, performance:{ now:()=>Date.now() }, Math, Date, JSON, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
ctx.document = {
  getElementById: () => null, addEventListener: () => {},
  createElement: () => ({ style:{}, getContext:()=>null, appendChild(){}, insertAdjacentHTML(){} }),
  head:{ appendChild(){} }, body:{ appendChild(){} }, readyState:'complete',
};
ctx.localStorage = { getItem:()=>null, setItem(){}, removeItem(){}, key:()=>null, length:0 };
vm.createContext(ctx);
vm.runInContext(main, ctx);
vm.runInContext(fs.readFileSync(path.join(dir, 'story-engine.js'), 'utf8'), ctx);

const test = fs.readFileSync(path.join(dir, '_verify_body.js'), 'utf8');
vm.runInContext(test, ctx);
