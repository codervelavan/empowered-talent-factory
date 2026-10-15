import './styles/base.css';
import './styles/company.css';

import { drawSketches } from './factory/sketches';
import { initController } from './factory/controller';
import { initStoryIntro } from './story/intro';
import { initFactory } from './factory/scene';

// The story intro plays first, over everything else. When it hands over, the company
// tour starts at the Company stop. The 3D scene starts last; the controller waits for
// window.FACTORY and falls back to the flat page if WebGL isn't available.
window.__storyShowing = true;
drawSketches();
const controller = initController(() => story.replay());
const story = initStoryIntro(
  (intent) => { window.__storyShowing = false; controller.enterFromStory(intent); },
  () => { window.__storyShowing = true; controller.beforeStory(); },
);
// Deep links (#career, #workforce, #ai-for-everyone, #evidence, #skip-3d) go straight into the site.
if (/^#(career|workforce|ai-for-everyone|globe|evidence|skip-3d|skip)$/.test(location.hash)) story.skip();
try {
  initFactory();
} catch (err) {
  console.error('3D scene failed to start; the flat page will be shown.', err);
}
