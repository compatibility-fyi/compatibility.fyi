import React from 'react';

interface CodeBlockProps {
  children: string;
  copyable?: boolean;
}

export function CodeBlock({ children, copyable = false }: CodeBlockProps) {
  return (
    <div className={copyable ? 'code-block-shell copyable' : 'code-block-shell'}>
      {copyable ? (
        <button
          aria-label="Copy code"
          className="code-block-copy"
          data-copy-code
          title="Copy code"
          type="button"
        >
          <CopyIcon />
        </button>
      ) : null}
      <pre className="code-block">{children}</pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <rect height="14" rx="2" stroke="currentColor" strokeWidth="2" width="14" x="8" y="8" />
      <path
        d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
