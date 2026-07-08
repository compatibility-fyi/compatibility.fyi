/// <reference types="vite/client" />

declare module '*.yaml?raw' {
  const source: string;
  export default source;
}
