interface City {
  readonly city: string;
  readonly growth_from_2000_to_2013: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly population: string;
  readonly rank: string;
  readonly state: string;
}
// Sort state definition: Restricts sortable attributes and manages tri-state cycle (desc, asc, null)
type SortField = 'rank' | 'growth' | null;
type SortDirection = 'desc' | 'asc' | null;

interface SortState {
  field: SortField;
  direction: SortDirection;
}

const ENDPOINT =
  'https://gist.githubusercontent.com/Miserlou/c5cd8364bf9b2420bb29/raw/2bf258763cdddd704f8ffd3ea9a3e81d25e2c6f6/cities.json';

const numberFormatter = new Intl.NumberFormat('en-US');
// Single source of truth for the active sort field and direction across user interactions
let currentSort: SortState = {
  field: null,
  direction: null,
};

async function loadCities(): Promise<City[]> {
  try {
    const response = await fetch(ENDPOINT);

    if (!response.ok) {
      throw new Error(`Network error: Status ${response.status}`);
    }

    const data = (await response.json()) as City[];
    return data;
  } catch (error) {
    console.error('Could not load Cities', error);
    return [];
  }
}
// Escapes special regex characters to prevent syntax errors on inputs like "(" or "["
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Performs a case-insensitive search matching against city or state names
function findMatches(wordToMatch: string, cities: City[]): City[] {
  // Guard clause: Avoid unnecessary regex execution on empty inputs
  if (!wordToMatch.trim()) return [];

  const regex = new RegExp(escapeRegExp(wordToMatch), 'i');
  return cities.filter(place => {
    return regex.test(place.city) || regex.test(place.state);
  });
}

// State machine: Cycles sorting state (null -> asc -> desc -> null) or switches to a new field
function cycleSort(field: 'rank' | 'growth'): void {
  if (currentSort.field !== field) {
    currentSort = { field, direction: 'desc' };
    return;
  }

  switch (currentSort.direction) {
    case 'desc':
      currentSort.direction = 'asc';
      break;
    case 'asc':
      currentSort = { field: null, direction: null };
      break;
    default:
      currentSort.direction = 'desc';
      break;
  }
}

// Pure sorting logic: Returns an immutable sorted shallow copy or the unaltered list if inactive
function sortMatches(matches: City[], sort: SortState): City[] {
  if (!sort.field || !sort.direction) {
    return matches;
  }

  return [...matches].sort((a, b) => {
    let comparison = 0;

    if (sort.field === 'rank') {
      comparison = Number(a.rank) - Number(b.rank);
    } else if (sort.field === 'growth') {
      const growthA = parseFloat(a.growth_from_2000_to_2013);
      const growthB = parseFloat(b.growth_from_2000_to_2013);
      comparison = growthA - growthB;
    }
    return sort.direction === 'desc' ? -comparison : comparison;
  });
}

// Generates the HTML markup for matching entries and highlights search terms
function displayMatches(matches: City[], query: string): string {
  const regex = new RegExp(escapeRegExp(query), 'gi');
  return matches
    .map(place => {
      const cityName = place.city.replace(regex, '<span class="hl">$&</span>');
      const stateName = place.state.replace(
        regex,
        '<span class="hl">$&</span>',
      );
      const growth = place.growth_from_2000_to_2013;
      const latitude = place.latitude;
      const longitude = place.longitude;
      const rank = place.rank;
      return `
    <li>
      <div class="summary">
        <span class="name">${cityName}, ${stateName}</span>
        <span class="population">${numberFormatter.format(Number(place.population))}</span>
      </div>
      <div class="details">
        <span class="detail-item"><strong class="sortable" data-sort="rank">Rank:</strong> #${rank} in US</span>
        <span class="detail-item"><strong class="sortable" data-sort="growth">Growth:</strong> ${growth}</span>
        <span class="detail-item"><strong>Coordinates:</strong> ${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}</span>
      </div>
    </li>`;
    })
    .join('');
}

const cities = await loadCities();
const searchInput = document.querySelector<HTMLInputElement>('.search');
const suggestions = document.querySelector<HTMLUListElement>('.suggestions');
// Fail-fast guard: Ensures DOM elements exist and narrows types for TypeScript
if (!searchInput || !suggestions) {
  throw new Error('Required DOM element not found');
}

function renderCurrentList(): void {
  const query = searchInput!.value;

  if (!query.trim()) {
    suggestions!.innerHTML = `
      <li>Filter for a city</li>
      <li>or a state</li>`;
    return;
  }
  // UI state persistence: Tracks currently open accordion item to preserve expanded view across re-renders
  const expandedName = suggestions!.querySelector(
    'li.is-expanded .name',
  )?.textContent;

  const matches = findMatches(query, cities);
  const sorted = sortMatches(matches, currentSort);
  suggestions!.innerHTML = displayMatches(sorted, query);
  // Re-applies expanded state to the corresponding card after DOM replacement
  if (expandedName) {
    const listItems = suggestions!.querySelectorAll('li');
    listItems.forEach(li => {
      const nameEl = li.querySelector('.name');
      if (nameEl && nameEl.textContent === expandedName) {
        li.classList.add('is-expanded');
      }
    });
  }
}

// Handles real-time search input and manages the default empty state
searchInput.addEventListener('input', renderCurrentList);
// Event delegation: Centralized click handler for dynamically rendered <li> elements
suggestions.addEventListener('click', (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const sortButton = target.closest<HTMLElement>('[data-sort]');

  if (sortButton) {
    event.stopPropagation();

    const field = sortButton.dataset.sort as 'rank' | 'growth';
    cycleSort(field);
    renderCurrentList();
    return;
  }

  const listItem = target.closest('li');
  if (!listItem) return;
  // Toggles the detailcard
  listItem.classList.toggle('is-expanded');
});

export {};
