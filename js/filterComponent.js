// Filter Component - Reusable filter dropdown for lists
// Used by student-list, membership-list, routine-list

export class FilterDropdown {
  constructor(options = {}) {
    this.id = options.id || `filter-${Date.now()}`;
    this.label = options.label || 'Filtrar';
    this.placeholder = options.placeholder || 'Todos';
    this.options = options.options || [];
    this.value = options.defaultValue || '';
    this.onChange = options.onChange || (() => {});
    this.icon = options.icon || 'filter_list';
    this.containerClass = options.containerClass || '';
  }

  render() {
    return `
      <div class="filter-dropdown ${this.containerClass}" id="${this.id}">
        <button type="button" 
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-dark bg-surface-dark hover:bg-slate-800 transition-colors text-sm"
          onclick="window.filterDropdowns['${this.id}'].toggle()">
          <span class="material-symbols-rounded text-[18px] text-slate-400">${this.icon}</span>
          <span class="text-slate-300">${this.label}</span>
          <span class="material-symbols-rounded text-[18px] text-slate-500 chevron">expand_more</span>
        </button>
        <div class="filter-menu hidden absolute right-0 mt-2 w-48 bg-surface-dark border border-border-dark rounded-xl shadow-lg z-50 overflow-hidden">
          <div class="p-2 flex flex-col">
            <button type="button" 
              class="filter-option w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm ${this.value === '' ? 'text-primary font-medium' : 'text-slate-300'}"
              data-value="">
              ${this.placeholder}
            </button>
            ${this.options
              .map(
                (opt) => `
              <button type="button" 
                class="filter-option w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-sm ${this.value === opt.value ? 'text-primary font-medium' : 'text-slate-300'}"
                data-value="${opt.value}">
                ${opt.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  mount(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.insertAdjacentHTML('beforeend', this.render());
    this._bindEvents();
  }

  _bindEvents() {
    const menu = document.getElementById(this.id)?.querySelector('.filter-menu');
    if (!menu) return;

    menu.querySelectorAll('.filter-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.value = btn.dataset.value;
        this.onChange(this.value);
        this.close();
        this._updateUI();
      });
    });

    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById(this.id);
      if (wrapper && !wrapper.contains(e.target)) {
        this.close();
      }
    });
  }

  _updateUI() {
    const wrapper = document.getElementById(this.id);
    if (!wrapper) return;

    wrapper.querySelectorAll('.filter-option').forEach((btn) => {
      btn.classList.toggle('text-primary', btn.dataset.value === this.value);
      btn.classList.toggle('font-medium', btn.dataset.value === this.value);
      btn.classList.toggle('text-slate-300', btn.dataset.value !== this.value);
    });
  }

  toggle() {
    const menu = document.getElementById(this.id)?.querySelector('.filter-menu');
    if (!menu) return;

    const isOpen = !menu.classList.contains('hidden');
    document.querySelectorAll('.filter-menu').forEach((m) => m.classList.add('hidden'));

    if (!isOpen) {
      menu.classList.remove('hidden');
    }
  }

  close() {
    const menu = document.getElementById(this.id)?.querySelector('.filter-menu');
    if (menu) menu.classList.add('hidden');
  }

  setValue(value) {
    this.value = value;
    this._updateUI();
  }

  getValue() {
    return this.value;
  }
}

export function createFilterDropdown(options) {
  const dropdown = new FilterDropdown(options);

  if (!window.filterDropdowns) window.filterDropdowns = {};
  window.filterDropdowns[dropdown.id] = dropdown;

  return dropdown;
}

export function initPageFilters(configs = []) {
  if (!window.filterDropdowns) window.filterDropdowns = {};

  configs.forEach((config) => {
    const dropdown = createFilterDropdown(config);
    if (config.mountTo) {
      dropdown.mount(config.mountTo);
    }
  });

  return window.filterDropdowns;
}

export const filterComponent = {
  FilterDropdown,
  create: createFilterDropdown,
  init: initPageFilters
};

export default filterComponent;
