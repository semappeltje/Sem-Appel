import './style.css';
import logo from './assets/logo.png';
import { createWorld } from './world.js';
import { createFleet } from './fleet.js';
import { createUI } from './ui.js';

document.getElementById('logo').src = logo;
const state = { simTime: Date.now(), speed: 12, follow: null, selected: null, tour: false };
const world = createWorld(document.getElementById('stage'), document.getElementById('labels'));
const fleet = createFleet(world.scene);
const ui = createUI(world, fleet, state);
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = performance.now();
function loop(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  const dtMin = dtReal * state.speed / 60 * (reduce ? 0.5 : 1); state.simTime += dtMin * 60000;
  fleet.step(dtMin, state.simTime);
  const d = new Date(state.simTime); const { night } = world.setDaylight(d.getHours() + d.getMinutes() / 60); fleet.setNight(night);
  ui.frame(dtReal); world.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
