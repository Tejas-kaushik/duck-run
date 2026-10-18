// Big centred call-outs during a run ("⚡ BOOST!", "🐕 A dog is on your tail!"). One at a time.

let current: HTMLElement | null = null;
let timer = 0;

export function showToast(text: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 1800): void {
  current?.remove();
  window.clearTimeout(timer);
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = text;
  document.getElementById('ui')?.appendChild(node);
  current = node;
  timer = window.setTimeout(() => {
    node.classList.add('leaving');
    window.setTimeout(() => node.remove(), 300);
    if (current === node) current = null;
  }, ms);
}

export function clearToast(): void {
  current?.remove();
  current = null;
  window.clearTimeout(timer);
}
