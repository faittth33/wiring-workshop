'use strict';
const frame = document.getElementById('practice');
const status = document.getElementById('save-status');
let active, resizeObserver;
const storageKey = id => 'wiring-workshop-practice-v2:' + id;
function readSnapshot(id) { try { return JSON.parse(localStorage.getItem(storageKey(id)) || 'null'); } catch { return null; } }
function storeSnapshot(id, snapshot) {
  try { localStorage.setItem(storageKey(id), JSON.stringify(snapshot)); status.textContent = '已自动保存 · ' + id.toUpperCase(); }
  catch { status.textContent = '浏览器无法保存进度，请使用导出备份'; }
}
window.readSnapshot = readSnapshot;
window.storeSnapshot = storeSnapshot;
function currentApi() { return frame.contentDocument?.getElementById(active.prefix + '-practice')?.['__' + active.prefix]; }
function snapshotCurrent() {
  const api = currentApi(); if (!api) throw new Error('页面尚未加载，请稍后再试');
  const state = api.state(), doc = frame.contentDocument, get = name => doc.getElementById(active.prefix + '-' + name);
  const privateContent = {version: api.model.version, circuit: api.model.circuit, wires: state.wires, color: get('color').value, view: get('view').value, flow: get('flow').checked};
  if ('threaded' in state) privateContent.threaded = state.threaded;
  if ('switches' in state) privateContent.switches = state.switches;
  return {privateContent};
}
function persistCurrent() { if (active && currentApi()) storeSnapshot(active.id, snapshotCurrent()); }
function resizeFrame() {
  const doc = frame.contentDocument; if (!doc) return;
  const height = Math.ceil(doc.body.getBoundingClientRect().height) + 4;
  if (height > 0 && Math.abs(frame.offsetHeight - height) > 2) frame.style.height = height + 'px';
}
const themeSelect = document.getElementById('theme');
try { themeSelect.value = localStorage.getItem('wiring-theme') || 'light'; } catch {}
function actualTheme() { return themeSelect.value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themeSelect.value; }
function applyTheme() {
  const mode = actualTheme(); document.documentElement.dataset.theme = mode;
  if (frame.contentDocument) frame.contentDocument.documentElement.style.colorScheme = mode;
  try { localStorage.setItem('wiring-theme', themeSelect.value); } catch {}
}
themeSelect.addEventListener('change', applyTheme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function selectCourse(id) {
  const course = CIRCUITS.find(c => c.id === id) || CIRCUITS[0];
  if (active?.id === course.id) return;
  persistCurrent(); resizeObserver?.disconnect(); active = course;
  document.querySelectorAll('.course').forEach(button => { if (button.dataset.id === course.id) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
  document.getElementById('course-code').textContent = course.id.toUpperCase() + ' / 接线练习';
  document.getElementById('course-title').textContent = course.title;
  document.getElementById('course-desc').textContent = course.description;
  frame.title = course.id.toUpperCase() + ' ' + course.title + '接线练习';
  status.textContent = '进度自动保存在当前浏览器';
  const bridge = `<script>window.openai={widgetState:parent.readSnapshot('${course.id}'),setWidgetState:async function(s){this.widgetState=s;parent.storeSnapshot('${course.id}',s);}};<\/script>`;
  frame.style.height = '900px';
  frame.srcdoc = '<!doctype html><html lang="zh-CN" style="color-scheme:' + actualTheme() + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + CIRCUIT_CSS + '\nhtml,body{margin:0;padding:0;background:transparent!important}body{display:flow-root}</style></head><body>' + bridge + course.fragment + '</body></html>';
}
frame.addEventListener('load', () => {
  applyTheme(); resizeFrame();
  resizeObserver = new ResizeObserver(resizeFrame); resizeObserver.observe(frame.contentDocument.body);
});
const nav = document.getElementById('courses');
for (const course of CIRCUITS) {
  const button = document.createElement('button'); button.className = 'course'; button.dataset.id = course.id;
  button.innerHTML = `<strong>${course.id.toUpperCase()}</strong><span>${course.title}</span><small>${course.count} 根参考导线</small>`;
  button.addEventListener('click', () => { location.hash = course.id; }); nav.append(button);
}
window.addEventListener('hashchange', () => selectCourse(location.hash.slice(1)));
window.addEventListener('beforeunload', persistCurrent);
document.getElementById('export').addEventListener('click', () => {
  try {
    const snapshot = snapshotCurrent(); storeSnapshot(active.id, snapshot);
    const data = {app: 'wiring-workshop', version: 1, course: active.id, savedAt: new Date().toISOString(), snapshot};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = active.id + '-接线进度.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = '已导出当前课程进度';
  } catch(e) { status.textContent = e.message; }
});
const input = document.getElementById('import-file');
document.getElementById('import').addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('进度文件过大，请选择本应用导出的 JSON');
    const data = JSON.parse(await file.text()), api = currentApi(), s = data.snapshot?.privateContent;
    if (!api) throw new Error('页面尚未加载，请稍后再试');
    if (api.state().power) throw new Error('请先分闸断电，再导入进度');
    if (data.app !== 'wiring-workshop' || data.version !== 1 || data.course !== active.id || !s || s.version !== api.model.version || s.circuit !== api.model.circuit || !Array.isArray(s.wires) || s.wires.length > 120) throw new Error('文件格式或课程不匹配，未修改当前接线');
    const nodes = new Set(api.model.nodes.map(n => n.id)), colors = new Set(Array.from(frame.contentDocument.getElementById(active.prefix+'-color').options, o => o.value));
    const pairs = new Set();
    for (const wire of s.wires) {
      if (!nodes.has(wire.a) || !nodes.has(wire.b) || wire.a === wire.b || !colors.has(wire.color)) throw new Error('进度中存在无效端子或颜色，未修改当前接线');
      const pair = [wire.a,wire.b].sort().join('|'); if (pairs.has(pair)) throw new Error('进度中存在重复导线，未修改当前接线'); pairs.add(pair);
    }
    const clean = {version: api.model.version, circuit: api.model.circuit, wires: s.wires.map((w,i) => ({a:w.a,b:w.b,color:w.color,id:i+1})), color:colors.has(s.color)?s.color:'yellow', view:s.view==='scheme'?'scheme':'board',flow:s.flow!==false};
    if ('threaded' in api.state()) clean.threaded = s.threaded === true;
    if ('switches' in api.state()) clean.switches = {SA1:s.switches?.SA1===1?1:0,SA2:s.switches?.SA2===1?1:0,SA3:s.switches?.SA3===true};
    api.restore({privateContent:clean}); storeSnapshot(active.id, {privateContent:clean});
    status.textContent = '已导入进度 · 保持断电，请检查接线';
  } catch(e) { status.textContent = e instanceof SyntaxError ? '不是有效的 JSON，未修改当前接线' : e.message; }
  finally { input.value = ''; }
});
applyTheme(); selectCourse(location.hash.slice(1));
