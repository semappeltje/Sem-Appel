// De OTM5-validator uit de vastgezette officiële specificatie (otm-api-v5.9.yaml, OTM 5.9.0 van 2 oktober 2026), voor
// tests die een bestand of bericht van de app willen toetsen (tests/vrijgeven-check.mjs). Dezelfde omzetting als in
// tests/otm5-check.mjs: de OpenAPI-discriminator wordt if/then, zoals OpenAPI hem bedoelt.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(app, 'package.json'));

export function maakValidator() {
  const YAML = require('yaml');
  const Ajv2020 = require('ajv/dist/2020').default;
  const addFormats = require('ajv-formats').default || require('ajv-formats');
  const spec = YAML.parse(readFileSync(path.join(app, 'tests', 'otm5', 'otm-api-v5.9.yaml'), 'utf8'));
  const fixRef = r => r.replace('#/components/schemas/', '#/$defs/');
  const omzetten = node => {
    if (Array.isArray(node)) return node.map(omzetten);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'example' || k === 'examples' || k === 'discriminator' || k === 'xml' || k === 'externalDocs') continue;
      out[k] = k === '$ref' && typeof v === 'string' ? fixRef(v) : omzetten(v);
    }
    const d = node.discriminator, sleutel = out.oneOf ? 'oneOf' : out.anyOf ? 'anyOf' : null;
    if (d && sleutel) {
      const alts = out[sleutel], p = d.propertyName;
      const map = d.mapping ? Object.entries(d.mapping).map(([val, r]) => [val, fixRef(r)]) : alts.filter(a => a.$ref).map(a => [a.$ref.split('/').pop(), a.$ref]);
      const gemapt = new Set(map.map(m => m[1])); const rest = alts.filter(a => !(a.$ref && gemapt.has(a.$ref)));
      let keten = rest.length === 0 ? { [sleutel]: alts } : rest.length === 1 ? rest[0] : { [sleutel]: rest };
      for (const [val, r] of map.slice().reverse()) keten = { if: { properties: { [p]: { const: val } }, required: [p] }, then: { $ref: r }, else: keten };
      delete out[sleutel]; out.allOf = [...(out.allOf || []), keten];
    }
    return out;
  };
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  addFormats(ajv); ajv.addFormat('recurrence', true);
  ajv.addSchema({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'otm5', $defs: omzetten(spec.components.schemas) });
  const V = {}; for (const s of ['trip', 'vehicle', 'actor', 'location', 'goods', 'consignment']) V[s] = ajv.compile({ $ref: `otm5#/$defs/${s}` });
  const SOORT = { trips: 'trip', vehicles: 'vehicle', actors: 'actor', locations: 'location', transportEquipment: 'goods', consignments: 'consignment' };
  const tekst = v => (v.errors || []).slice(0, 3).map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
  // elke entiteit in een bundel tegen haar schema, en elke verwijzing naar een entiteit in hetzelfde bestand
  return function valideer(doc) {
    let n = 0; const fout = [];
    for (const [lijst, schema] of Object.entries(SOORT)) for (const e of doc[lijst] || []) { n++; if (!V[schema](e) && fout.length < 5) fout.push(`${lijst} ${e.name || e.id}: ${tekst(V[schema])}`); }
    const ids = new Set(), refs = [];
    const loop = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(loop); return; } if (typeof o.id === 'string') ids.add(o.id); if (o.associationType === 'reference') refs.push(o.uuid); for (const [k, v] of Object.entries(o)) if (k !== 'externalAttributes') loop(v); };
    loop(doc);
    const los = refs.filter(u => !ids.has(u));
    return { n, fout, refs: refs.length, los: los.length };
  };
}
