import './styles/base.css';
import './styles/guide.css';
import './styles/station.css';

import { initStation } from './station/station';
import { drawSketches } from './factory/sketches';
import { initController } from './factory/controller';
import { initGuide } from './guide/guide';
import { initFactory } from './factory/scene';

// Same start-up order as the prototype: station first (it locks scroll and owns the
// story intro), then the scene sketches, the factory UI controller and the guide.
// The 3D scene comes last; the controller waits for window.FACTORY and falls back
// to the flat page if WebGL isn't available.
initStation();
drawSketches();
initController();
window.__guide = initGuide();
try {
  initFactory();
} catch (err) {
  console.error('3D factory failed to start; the flat page will be shown.', err);
}
