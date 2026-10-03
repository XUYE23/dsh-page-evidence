import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inspectPdf } from '../src/core.mjs';
import { findEvidence } from '../src/chunker.mjs';

const bytes = await readFile(new URL('../test/fixtures/mixed-pages.pdf', import.meta.url));
const plain = await inspectPdf(bytes);
const ocr = await inspectPdf(bytes, { ocr: true });
for (const report of [plain, ocr]) {
  report.matches = [...findEvidence(report.pages, 'Hangzhou', report.sourceSha256), ...findEvidence(report.pages, 'NEBULA', report.sourceSha256)];
}
const payload = JSON.stringify({ plain, ocr }).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page Evidence · 混合 PDF 读取验证</title>
<style>
:root{color-scheme:light;font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;background:#f4f7f6;color:#183631}*{box-sizing:border-box}body{margin:0}main{max-width:1080px;margin:0 auto;padding:48px 24px}header{border-bottom:1px solid #c8d8d3;padding-bottom:30px}.brand{font-size:13px;letter-spacing:2px;color:#427465}h1{font-size:clamp(27px,4vw,42px);letter-spacing:-1px;margin:15px 0}p{line-height:1.75;color:#526b64}nav{display:flex;gap:10px;margin:28px 0;flex-wrap:wrap}button{border:1px solid #b7cec5;background:white;border-radius:8px;padding:12px 18px;color:#244c3e;cursor:pointer;font:inherit}button[aria-pressed=true]{background:#205d4d;color:white;border-color:#205d4d}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:26px 0}.metric{background:#e6eeea;padding:22px;border-radius:10px}.metric strong{display:block;font-size:30px;margin-bottom:6px}.layout{display:grid;grid-template-columns:1fr 1.05fr;gap:24px}.panel{background:white;border:1px solid #d8e1dd;border-radius:12px;padding:26px}h2{font-size:19px;margin:0 0 20px}.page{padding:18px 0;border-top:1px solid #e5eae7}.page:first-of-type{border-top:0}.row{display:flex;justify-content:space-between;gap:10px}.badge{font-size:12px;border-radius:5px;background:#e7f1eb;color:#286348;padding:3px 7px}.warning{background:#fff2d5;color:#876119}.excerpt{white-space:pre-wrap;line-height:1.65;font-size:14px;color:#50635e;margin:14px 0 0}.quote{background:#f5f8f6;border-left:3px solid #4c987c;padding:18px;margin-bottom:15px}.quote p{margin:10px 0;font-size:14px}.muted{font-size:12px;color:#687b74;overflow-wrap:anywhere}footer{margin-top:25px;font-size:13px;color:#5c7169;line-height:1.8}a{color:#286b54}code{font-size:12px;overflow-wrap:anywhere}details{margin-top:20px}summary{cursor:pointer}@media(max-width:720px){.layout{grid-template-columns:1fr}.metrics{gap:8px}.metric{padding:15px}.metric strong{font-size:24px}main{padding:28px 16px}}
</style><main><header><div class="brand">DSH PAGE EVIDENCE / ALPHA</div><h1>这份 PDF，哪些页被读到了？</h1><p>三页公开合成样例：文字页、扫描页、文字页。切换本地 OCR，查看逐页结果与可核验引用。</p><div class="muted">CPU 本地处理 · 无模型 API 调用 · 实际运行结果</div></header>
<nav aria-label="选择处理方式"><button id="plain" aria-pressed="false">仅提取文字层</button><button id="ocr" aria-pressed="true">开启本地 OCR</button></nav>
<div class="metrics"><div class="metric"><strong id="coverage"></strong>提取到文字的页</div><div class="metric"><strong id="review"></strong>待复核页</div><div class="metric"><strong id="hits"></strong>检索命中的证据</div></div>
<div class="layout"><section class="panel"><h2>逐页读取记录</h2><div id="pages"></div></section><section class="panel"><h2>关键词证据</h2><p class="muted">查询词：Hangzhou / NEBULA。引用偏移对应提取后的原始文本。</p><div id="matches"></div><details><summary>文件核验信息</summary><p class="muted">SHA-256 识别输入文件的版本。OCR 字符准确性仍需结合原图复核。</p><code id="sha"></code></details></section></div>
<footer>验证范围：此演示使用人工构造的最小复现样例。它展示漏读提示、页码保持及本地 OCR 的工作路径；大规模文档准确率尚待评测。<br>已提供 Node 24 测试与 DSH 0.2.0-rc.2 工具运行时测试。完整 Web 安装流程尚待验收。</footer>
<script type="application/json" id="data">${payload}</script><script>
const reports=JSON.parse(document.querySelector('#data').textContent);const el=id=>document.getElementById(id);
function add(parent,tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.append(e);return e}
function show(mode){const r=reports[mode];for(const m of ['plain','ocr'])el(m).setAttribute('aria-pressed',String(m===mode));el('coverage').textContent=r.pages.filter(p=>p.text.trim()).length+' / '+r.totalPages;el('review').textContent=r.pages.filter(p=>p.needsReview).length;el('hits').textContent=r.matches.length;el('sha').textContent=r.sourceSha256;el('pages').replaceChildren();el('matches').replaceChildren();for(const p of r.pages){const box=add(el('pages'),'div','','page');const row=add(box,'div','','row');add(row,'strong','第 '+p.page+' 页');add(row,'span',p.needsReview?'文字不足 · 待复核':p.method==='ocr'?'本地 OCR':'文字层',p.needsReview?'badge warning':'badge');add(box,'div',p.text||'本页未提取到文字，可开启 OCR 或人工查看原页。','excerpt')}for(const m of r.matches){const box=add(el('matches'),'div','','quote');add(box,'strong','来源：第 '+m.page+' 页');add(box,'p',m.quote);add(box,'div',m.method==='ocr'?'OCR 提取 · 请按原页核验':'文字层提取','muted')}}
el('plain').onclick=()=>show('plain');el('ocr').onclick=()=>show('ocr');show('ocr');</script></main></html>`;
await mkdir('outputs', { recursive: true });
await writeFile('outputs/demo.html', html);
await writeFile('outputs/demo.json', JSON.stringify({plain, ocr}, null, 2) + '\n');
console.log('outputs/demo.html and outputs/demo.json generated from real extraction.');
