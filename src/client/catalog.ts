const catalog = document.querySelector<HTMLElement>('[data-catalog]');

if (catalog) {
  const search = catalog.querySelector<HTMLInputElement>('[data-catalog-search]');
  const categoryButtons = [
    ...catalog.querySelectorAll<HTMLButtonElement>('[data-catalog-category]'),
  ];
  const projects = [...catalog.querySelectorAll<HTMLElement>('[data-catalog-project]')];
  const heading = catalog.querySelector<HTMLElement>('[data-catalog-heading]');
  const count = catalog.querySelector<HTMLElement>('[data-catalog-count]');
  const table = catalog.querySelector<HTMLElement>('[data-catalog-table]');
  const empty = catalog.querySelector<HTMLElement>('[data-catalog-empty]');
  const results = catalog.querySelector<HTMLElement>('[data-catalog-results]');
  let selectedCategory = 'All';

  search?.addEventListener('input', filterProjects);

  for (const button of categoryButtons) {
    button.addEventListener('click', () => {
      selectedCategory = button.dataset.catalogCategory ?? 'All';

      for (const candidate of categoryButtons) {
        candidate.classList.toggle('active', candidate === button);
      }

      filterProjects();
      window.requestAnimationFrame(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        results?.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    });
  }

  function filterProjects() {
    const query = search?.value.trim().toLowerCase() ?? '';
    let visible = 0;

    for (const project of projects) {
      const categories = project.dataset.categories?.split('|') ?? [];
      const matchesCategory = selectedCategory === 'All' || categories.includes(selectedCategory);
      const matchesQuery = !query || (project.dataset.search ?? '').includes(query);
      project.hidden = !(matchesCategory && matchesQuery);
      if (!project.hidden) {
        visible += 1;
      }
    }

    if (heading) {
      heading.textContent = selectedCategory === 'All' ? 'All projects' : selectedCategory;
    }
    if (count) {
      count.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
    }
    if (table) {
      table.hidden = visible === 0;
    }
    if (empty) {
      empty.hidden = visible !== 0;
    }
  }
}
