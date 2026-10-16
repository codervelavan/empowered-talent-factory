import './styles/base.css';
import './styles/company.css';

import { drawSketches } from './factory/sketches';
import { initController } from './factory/controller';
import { initStoryIntro } from './story/intro';
import { initFactory } from './factory/scene';

// The 3D world opens first: the controller plays the opening, or goes straight to the place
// in the address (/career/assurance/, /workforce/campus/…). The story intro is optional
// reading from the menu. The 3D scene starts last; the controller waits for window.FACTORY
// and falls back to the standard page if WebGL isn't available.
window.__storyShowing = false;
drawSketches();
const controller = initController(() => story.replay());
const story = initStoryIntro(
  (intent) => { window.__storyShowing = false; controller.enterFromStory(intent); },
  () => { window.__storyShowing = true; controller.beforeStory(); },
  { startHidden: true },
);
try {
  initFactory();
} catch (err) {
  console.error('3D scene failed to start; the flat page will be shown.', err);
}
