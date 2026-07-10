const copyIcon = `<svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><rect height="14" rx="2" stroke="currentColor" stroke-width="2" width="14" x="8" y="8"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>`;
const checkIcon = `<svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="m20 6-11 11-5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"></path></svg>`;

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-code]')) {
  button.addEventListener('click', () => void copyCode(button));
}

async function copyCode(button: HTMLButtonElement) {
  const code = button.parentElement?.querySelector<HTMLElement>('.code-block')?.textContent ?? '';

  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  button.innerHTML = checkIcon;
  button.ariaLabel = 'Copied';
  button.title = 'Copied';

  window.setTimeout(() => {
    button.innerHTML = copyIcon;
    button.ariaLabel = 'Copy code';
    button.title = 'Copy code';
  }, 1400);
}
