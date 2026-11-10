import fs from 'fs';
import { wordCandidates, setDictionary, parseDictionary } from '../src/engine.js';
setDictionary(parseDictionary(fs.readFileSync('/home/claude/data/dict_full.tsv', 'utf8')));
for (const w of process.argv.slice(2)) {
  const c = wordCandidates(w);
  console.log(w, c.length, c.slice(0, 8).map(x => `${x.bits}${x.endType}${x.wasl?'w':''}${x.endOnly?'E':''}:${x.cost.toFixed(2)}:${x.display}:${x.src}`).join('  '));
}
