import dataset from 'virtual:compatibility-data';

import type { CompatibilityDataset } from '../types/compatibility';

export function loadDataset(): CompatibilityDataset {
  return dataset;
}
