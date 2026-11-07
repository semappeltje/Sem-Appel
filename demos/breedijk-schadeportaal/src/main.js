import './fonts.css';
import './style.css';
import { maakWereld } from './data.js';
import { laadInstellingen } from './instellingen.js';
import { createActies } from './acties.js';
import { createImporten } from './importen.js';
import { createUI } from './ui.js';
import { kleurVoor } from './fotos.js';
import 'img-comparison-slider';
import 'img-comparison-slider/dist/styles.css';

// De app-root (#app.bsp) draagt het thema en de opties, zodat dezelfde code als losse pagina en ingebed in een site
// draait (data-embedded: sneltoetsen alleen met de focus in de app).
const root = document.getElementById('app');
const cfg = { embedded: 'embedded' in root.dataset };
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* geen opslag */ } } };
const inst = laadInstellingen(store);
root.dataset.theme = inst.thema === 'donker' ? 'dark' : 'light';
const D = maakWereld({ kleurVoor });
const importen = createImporten(store, D);
const acties = createActies(store, D, () => D.NU + (Date.now() % 3600000));
const ui = createUI(root, D, inst, store, acties, cfg, importen);
document.getElementById('loading').hidden = true;
window.BSP = { D, inst, acties, ui, cfg, importen };
