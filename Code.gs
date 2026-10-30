// Fuel's helper in your own Google account, for the iPhone page: food search the browser blocks, and the
// Fuel files in Drive. Deploy as a web app (execute as me, anyone with the link), then run connect() once:
// it makes the key and prints it. Nothing here is secret; the key lives in this script's properties.
const FILES = {pixel: 'Fuel log.json', iphone: 'Fuel log iPhone.json', plan: 'Fuel plan.json'};
const ALLOW = /^https:\/\/([a-z0-9-]+\.)*openfoodfacts\.org\//;

const props = () => PropertiesService.getScriptProperties();
const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const authed = k => !!k && k === props().getProperty('KEY');

function folder() {
  const id = props().getProperty('FOLDER');
  if (id) return DriveApp.getFolderById(id);
  const it = DriveApp.getFilesByName(FILES.plan);  // Fuel plan.json sits only in the Fuel folder
  if (!it.hasNext()) throw new Error('Fuel plan.json not found in Drive');
  const f = it.next().getParents().next();
  props().setProperty('FOLDER', f.getId());
  return f;
}
function read(name) {
  const it = folder().getFilesByName(name);
  return it.hasNext() ? it.next().getBlob().getDataAsString() : null;
}
function write(name, text) {
  const it = folder().getFilesByName(name);
  if (it.hasNext()) it.next().setContent(text);
  else folder().createFile(name, text, 'application/json');
}
// the iPhone log; steps from the shortcut and from the page are merged, keeping the higher count per day
function saveLog(log, steps) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const old = JSON.parse(read(FILES.iphone) || '{}');
    log = log || old;
    const s = Object.assign({}, old.steps);
    for (const [d, n] of Object.entries(Object.assign({}, log.steps, steps))) s[d] = Math.max(s[d] || 0, Math.round(+n) || 0);
    log.steps = s;
    write(FILES.iphone, JSON.stringify(log, null, 1));
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const p = e.parameter;
  if (!authed(p.k)) return out({error: 'key'});
  if (p.a === 'ping') return out({ok: true});
  if (p.a === 'get') {
    if (!ALLOW.test(p.u || '')) return out({error: 'host'});
    const r = UrlFetchApp.fetch(p.u, {muteHttpExceptions: true, headers: {'User-Agent': 'Fuel/1 (personal food diary)'}});
    return out({code: r.getResponseCode(), body: r.getContentText()});
  }
  if (p.a === 'file' && FILES[p.f]) return out({text: read(FILES[p.f])});
  return out({error: 'action'});
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out({error: 'json'}); }
  if (!authed(b.k)) return out({error: 'key'});
  if (b.a === 'save') { saveLog(b.log, null); return out({ok: true}); }
  if (b.a === 'steps') { saveLog(null, {[b.date]: b.steps}); return out({ok: true}); }
  return out({error: 'action'});
}

function connect() {
  let k = props().getProperty('KEY');
  if (!k) {
    k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props().setProperty('KEY', k);
  }
  Logger.log('Fuel folder: ' + folder().getName());
  Logger.log('Key for Fuel: ' + k);
}
