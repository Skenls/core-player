import type { Familiarity, Mood, SynapseFilters as Filters } from '@/types/synapse';

const familiarityOptions: { value: Familiarity; label: string }[] = [
  { value: 'familiar', label: 'Знакомое' },
  { value: 'unfamiliar', label: 'Открытия' },
  { value: 'favorites', label: 'Избранное' },
];
const moods: { value: NonNullable<Mood>; label: string }[] = [
  { value: 'sad', label: 'Грустное' },
  { value: 'productive', label: 'Для фокуса' },
  { value: 'upbeat', label: 'Энергичное' },
];

export function SynapseFilters({ filters, onChange }: { filters: Filters; onChange: (filters: Filters) => void }) {
  return (
    <div className="synapse-filters">
      <div className="synapse-chips" role="group" aria-label="Знакомство с музыкой">
        {familiarityOptions.map(({ value, label }) => {
          const active = filters.familiarity.includes(value);
          return <button type="button" key={value} aria-pressed={active} className={`synapse-chip ${active ? 'is-selected' : ''}`}
            onClick={() => onChange({ ...filters, familiarity: active ? filters.familiarity.filter(item => item !== value) : [...filters.familiarity, value] })}>
            <span aria-hidden="true" className="synapse-chip-dot" />{label}
          </button>;
        })}
      </div>
      <div className="synapse-chips synapse-moods" role="group" aria-label="Настроение">
        <span className="synapse-mood-label">Настроение</span>
        {moods.map(({ value, label }) => <button type="button" key={value} aria-pressed={filters.mood === value}
          className={`synapse-chip ${filters.mood === value ? 'is-selected' : ''}`}
          onClick={() => onChange({ ...filters, mood: filters.mood === value ? null : value })}>{label}</button>)}
      </div>
    </div>
  );
}
