import './styles/base.css';
import './styles/company.css';

import { drawSketches } from './factory/sketches';
import { initController } from './factory/controller';
import { initFactory } from './factory/scene';

// The 3D world opens first: the controller plays the opening prologue, or goes straight to the place
// in the address (/career/assurance/, /workforce/campus/…). The prologue's narrative also appears as
// readable text on the standard page. The 3D scene starts last; the controller waits for
// window.FACTORY and falls back to the standard page if WebGL isn't available.
window.__storyShowing = false;
drawSketches();
initController(() => {});
try {
  initFactory();
} catch (err) {
  console.error('3D scene failed to start; the flat page will be shown.', err);
}
