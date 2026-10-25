// Gebouwen rond de standplaatsen en DC's (Overture Buildings, release 2026-10-21.0), alleen voor de 3D-wereld.
// Dit module wordt nooit statisch geïmporteerd: de 3D-laag laadt het met import('./buildings.js'), zodat de 2,4 MB pas
// meekomt bij de eerste klik op de kubus (in de site-build een eigen bundel buildings.js, zie vite.site.config.js).
//
// Vorm: { "<standplaats>" | "<dc-id>": [{ p: [[lon, lat], ...], h: meters, d?: 1 }, ...] }
//   sleutel: de naam van de standplaats (SP[i].n, bijvoorbeeld "Wognum") of het id van een DC of fabriek uit klanten.json
//            (bijvoorbeeld "ah-hoorn"); een DC op hetzelfde terrein als een standplaats staat onder de standplaats (dc.sp);
//   p: de contour (open ring, tegen de klok in of met de klok mee zoals de bron), vereenvoudigd op 1 m;
//   h: hoogte in meters (height uit de bron, anders verdiepingen x 3,2 m, anders 6 m), op halve meters;
//   d: 1 als het gebouw op het terrein van de standplaats of het DC staat (de loods, het kantoor, de werkplaats).
// Alle gebouwen binnen 900 m die groter zijn dan 400 m², kleinere tot 300 m; ten hoogste 450 per plek.
import B from './data/buildings.json';
export default B;
export const gebouwenBij = key => B[key] || [];
