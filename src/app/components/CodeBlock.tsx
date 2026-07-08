interface CodeBlockProps {
  children: string;
}

export function CodeBlock({ children }: CodeBlockProps) {
  return <pre className="code-block">{children}</pre>;
}
