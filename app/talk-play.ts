// Talk with Bean on the Talk tab (spec, section 15). Not built yet: its grown-up settings (kid's first name,
// speaking style, the AI chat note) are in index.html, and nothing reads them yet. Start here does nothing.
import type { Mode } from './mode.ts';

export function createTalk(): Mode {
  const bubble = document.getElementById('tab-talk')!.querySelector('path')!.getAttribute('d')!; // the Talk tab's speech bubble
  return {
    screen: { idle: { status: 'Talk with Bean', hint: 'Coming soon: Bean will chat with your kid.', glyph: bubble } },
    showsDistance: false,
    async start() {},
    stop() {},
  };
}
