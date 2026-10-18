/** Tiny DOM helper so the overlay screens stay short. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text !== undefined) node.textContent = props.text;
  node.append(...children);
  return node;
}

/**
 * Wire a menu button. Focus is dropped after the click: otherwise a later Space or Enter press would
 * "click" the focused button again instead of reaching the game.
 */
export function onButton(button: HTMLButtonElement, action: () => void): void {
  button.addEventListener('click', () => {
    button.blur();
    action();
  });
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
