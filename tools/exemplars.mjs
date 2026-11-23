// يبني data/exemplars.json: أبيات عالية لكل غرض يستأنس بها الشاعر الآلي
// المصدر: المختارات المحققة وحدها (نصوص الدواوين لم تُحقق بعد، ففيها تصحيف)
// التشكيل يُحذف عمداً: الأبيات للاستئناس بالمستوى، لا للنقل
import { readFileSync, writeFileSync } from 'node:fs';

const strip = (s) => String(s).replace(/[ً-ْٰـ]/g, '').replace(/\s+/g, ' ').trim();
const muk = JSON.parse(readFileSync('data/mukhtarat.json', 'utf8')).items;
const fromGroup = (g) => muk.filter(i => i.g.includes(g)).map(i => ({ t: `${strip(i.sadr)} ... ${strip(i.ajz)}`, poet: i.poet, meter: i.meter }));

const madh = fromGroup('المدح');
const mutanabbi = fromGroup('عيون المتنبي');
const ex = {
  'مدح': [...madh, ...mutanabbi.filter((_, i) => i % 9 === 0)],
  'رثاء': fromGroup('الرثاء'),
  'حكمة': fromGroup('الحكمة'),
  'هجاء': fromGroup('الهجاء'),
  'غزل': mutanabbi.filter((_, i) => i % 7 === 3),
  'عام': [...fromGroup('الحكمة'), ...mutanabbi.filter((_, i) => i % 11 === 0)],
};
writeFileSync('data/exemplars.json', JSON.stringify(ex));
for (const [k, v] of Object.entries(ex)) console.log(k, v.length);
