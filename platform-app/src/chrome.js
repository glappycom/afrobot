import { esc } from './format.js';

export function chrome({ title, home = '/', body, wide = false }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/home.css"><link rel="stylesheet" href="/work.css"></head><body class="work-app"><a class="skip" href="#main">Skip to content</a><header class="workhead"><a href="${esc(home)}" aria-label="AfroBot platform home"><img src="/logo-afrobot-navy.svg" alt="afrobot" width="148" height="33"></a></header><main id="main" class="${wide ? 'workwide' : 'workmain'}" tabindex="-1">${body}</main><footer class="appfoot"><p>Preview v0.8.3</p><p class="fine">Demo records controls. Not a certification. A digest shows a later change. It does not prove the first number was true.</p></footer></body></html>`;
}
