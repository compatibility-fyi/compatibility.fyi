import { checkCompoundCompatibility } from '../lib/engine';
import { formatDependencyName, formatRange } from '../lib/format';
import type {
  CompatibilityCheckResponse,
  CompatibilityDataset,
  DependencyCompatibilityEntry,
} from '../types/compatibility';

const dataElement = document.querySelector<HTMLScriptElement>('#project-compatibility-data');
const dataset = dataElement?.textContent
  ? (JSON.parse(dataElement.textContent) as CompatibilityDataset)
  : undefined;

if (dataset) {
  initializeChecker(dataset);
}

initializeMatrixFilters();
initializeConfidenceTooltips();

function initializeChecker(compatibilityDataset: CompatibilityDataset) {
  const checker = document.querySelector<HTMLElement>('[data-project-checker]');
  const projectId = checker?.dataset.projectId;
  const project = projectId ? compatibilityDataset.projects[projectId] : undefined;
  const versionSelect = checker?.querySelector<HTMLSelectElement>('[data-check-version]');
  const fields = checker?.querySelector<HTMLElement>('[data-check-fields]');
  const status = checker?.querySelector<HTMLElement>('[data-check-status]');
  const resultContainer = checker?.querySelector<HTMLElement>('[data-check-result]');

  if (
    !checker ||
    !projectId ||
    !project ||
    !versionSelect ||
    !fields ||
    !status ||
    !resultContainer
  ) {
    return;
  }

  const activeProjectId = projectId;
  const activeVersionSelect = versionSelect;
  const activeFields = fields;
  const activeStatus = status;
  const activeResultContainer = resultContainer;

  activeVersionSelect.addEventListener('change', () => {
    renderDependencyFields(
      project.versions[activeVersionSelect.value]?.dependencies ?? {},
      activeFields,
    );
    clearResult(activeStatus, activeResultContainer);
  });
  activeFields.addEventListener('input', () => updateResult());

  function updateResult() {
    const dependencies = Object.fromEntries(
      [...activeFields.querySelectorAll<HTMLInputElement>('[data-check-dependency]')]
        .map((input) => [input.dataset.checkDependency ?? '', input.value.trim()] as const)
        .filter(([dependency, value]) => dependency && value),
    );

    if (Object.keys(dependencies).length === 0) {
      clearResult(activeStatus, activeResultContainer);
      return;
    }

    const result = checkCompoundCompatibility(compatibilityDataset, {
      project: activeProjectId,
      version: activeVersionSelect.value,
      dependencies,
    });

    activeStatus.className = `status-badge ${result.compatible}`;
    activeStatus.textContent = result.compatible;
    activeStatus.hidden = false;
    renderCompoundResult(result.checks, activeResultContainer);
  }
}

function renderDependencyFields(
  dependencies: Record<string, DependencyCompatibilityEntry>,
  fields: HTMLElement,
) {
  const versionField = fields.querySelector<HTMLElement>('.select-field');
  fields.replaceChildren();
  if (versionField) {
    fields.append(versionField);
  }

  for (const [dependency, entry] of Object.entries(dependencies)) {
    const label = document.createElement('label');
    label.className = 'search-field';
    label.dataset.checkField = dependency;

    const name = document.createElement('span');
    name.textContent = `${formatDependencyName(dependency)}${entry.relationship ? ` (${entry.relationship})` : ''}`;

    const input = document.createElement('input');
    input.dataset.checkDependency = dependency;
    input.type = 'text';
    input.placeholder = entry.ranges.map(formatRange).join(', ');

    label.append(name, input);
    fields.append(label);
  }
}

function clearResult(status: HTMLElement, resultContainer: HTMLElement) {
  status.hidden = true;
  status.textContent = '';
  status.className = 'status-badge';
  resultContainer.hidden = true;
  resultContainer.replaceChildren();
}

function renderCompoundResult(checks: CompatibilityCheckResponse[], container: HTMLElement) {
  container.replaceChildren(...checks.map(renderCheck));
  container.hidden = false;
}

function renderCheck(check: CompatibilityCheckResponse): HTMLElement {
  const row = document.createElement('div');
  row.className = 'compound-result-row';

  const dependency = document.createElement('span');
  const name = document.createElement('strong');
  name.textContent = formatDependencyName(check.dependency);
  const version = document.createElement('small');
  version.textContent = check.dependencyVersion;
  dependency.append(name, version);

  const value = document.createElement('span');
  value.className = 'compound-result-value';
  const range = document.createElement('span');
  range.className = 'compound-result-range';
  range.textContent = check.matchedRange ? formatRange(check.matchedRange) : 'No matching range';
  const badge = document.createElement('span');
  badge.className = `status-badge ${check.compatible}`;
  badge.textContent = check.compatible;
  value.append(range, badge);

  row.append(dependency, value);
  return row;
}

function initializeMatrixFilters() {
  const matrix = document.querySelector<HTMLElement>('[data-project-matrix]');
  const search = matrix?.querySelector<HTMLInputElement>('[data-matrix-search]');
  const version = matrix?.querySelector<HTMLSelectElement>('[data-matrix-version]');
  const rows = [...(matrix?.querySelectorAll<HTMLElement>('[data-matrix-row]') ?? [])];
  const count = matrix?.querySelector<HTMLElement>('[data-matrix-count]');
  const empty = matrix?.querySelector<HTMLElement>('[data-matrix-empty]');

  if (!matrix || !search || !version || !count || !empty) {
    return;
  }

  const activeCount = count;
  const activeEmpty = empty;

  search.addEventListener('input', filterRows);
  version.addEventListener('change', filterRows);

  function filterRows() {
    const query = search?.value.trim().toLowerCase() ?? '';
    const selectedVersion = version?.value ?? 'all';
    let visible = 0;

    for (const row of rows) {
      const matchesVersion = selectedVersion === 'all' || row.dataset.version === selectedVersion;
      const matchesQuery = !query || (row.dataset.search ?? '').includes(query);
      row.hidden = !(matchesVersion && matchesQuery);
      if (!row.hidden) {
        visible += 1;
      }
    }

    activeCount.textContent = `${visible} ${visible === 1 ? 'entry' : 'entries'}`;
    activeEmpty.hidden = visible !== 0;
  }
}

function initializeConfidenceTooltips() {
  const tooltip = document.querySelector<HTMLElement>('[data-confidence-tooltip]');
  if (!tooltip) {
    return;
  }

  let activeButton: HTMLButtonElement | undefined;

  const show = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const width = 300;
    activeButton?.setAttribute('aria-expanded', 'false');
    activeButton = button;
    button.setAttribute('aria-expanded', 'true');
    tooltip.textContent = button.dataset.confidenceExplanation ?? '';
    tooltip.style.top = `${rect.bottom + 8}px`;
    tooltip.style.left = `${Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)}px`;
    tooltip.hidden = false;
  };
  const hide = () => {
    activeButton?.setAttribute('aria-expanded', 'false');
    activeButton = undefined;
    tooltip.hidden = true;
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-confidence-explanation]',
  )) {
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        show(button);
      }
    });
    button.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') {
        hide();
      }
    });
    button.addEventListener('blur', hide);
    button.addEventListener('click', () => {
      if (activeButton === button && !tooltip.hidden) {
        hide();
      } else {
        show(button);
      }
    });
  }

  document.addEventListener('pointerdown', (event) => {
    if (activeButton && event.target instanceof Node && !activeButton.contains(event.target)) {
      hide();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  });
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, { passive: true });
}
