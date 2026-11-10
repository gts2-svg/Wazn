// وزن — العامل الخلفي: يحمّل القاموس ويزن الأبيات دون أن تتجمد الواجهة
import { analyzeVerse, setDictionary, parseDictionary, dictionarySize } from './src/engine.js';

let ready = null;

function load() {
  if (!ready) {
    ready = fetch('data/dict.tsv')
      .then(r => { if (!r.ok) throw new Error('dict ' + r.status); return r.text(); })
      .then(t => { setDictionary(parseDictionary(t)); return dictionarySize(); })
      .catch(e => { ready = null; throw e; });
  }
  return ready;
}

self.onmessage = async (ev) => {
  const msg = ev.data;
  try {
    if (msg.type === 'init') {
      const n = await load();
      self.postMessage({ type: 'ready', size: n });
    } else if (msg.type === 'analyze') {
      await load();
      const results = msg.items.map(it => {
        try {
          const r = analyzeVerse(it.parts || it.text, { autoSplit: true });
          return r ? { ...r, input: it } : { input: it, empty: true };
        } catch (e) {
          return { input: it, error: String(e && e.message || e) };
        }
      });
      self.postMessage({ type: 'result', id: msg.id, results });
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: msg.id, message: String(e && e.message || e) });
  }
};
