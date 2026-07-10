/// <reference types="vite/client" />

declare module 'virtual:compatibility-data' {
  import type { CompatibilityDataset } from './types/compatibility';

  const dataset: CompatibilityDataset;
  export default dataset;
}
