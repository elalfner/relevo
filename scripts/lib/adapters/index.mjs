// One renderer per tool. A tool that Relevo can set up appears here and nowhere else in the core.
import { renderAntigravity } from './antigravity.mjs';

export const RENDERERS = {
  antigravity: { label: 'Antigravity', render: renderAntigravity }
};
