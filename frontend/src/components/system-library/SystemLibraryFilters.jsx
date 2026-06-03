import { X } from 'lucide-react';

const FILTERS = {
  peer_review_status: [
    { value: 'PEER_REVIEWED', label: 'Peer-reviewed' },
    { value: 'PREPRINT', label: 'Preprint' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ],
  access_types: [
    { value: 'OPEN_ACCESS', label: 'Open Access' },
    { value: 'FREE_TO_READ', label: 'Free to Read' },
    { value: 'INSTITUTIONAL_ACCESS', label: 'Institutional Access' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ],
  review_types: [
    { value: 'RESEARCH_ARTICLE', label: 'Research Article' },
    { value: 'REVIEW', label: 'Review' },
    { value: 'SYSTEMATIC_REVIEW', label: 'Systematic Review' },
    { value: 'META_ANALYSIS', label: 'Meta-analysis' },
    { value: 'EDITORIAL', label: 'Editorial' },
    { value: 'UNKNOWN', label: 'Unknown' },
  ],
};

function FilterGroup({ title, options, value, onToggle }) {
  return (
    <div className="sl-filter-group">
      <h3>{title}</h3>
      <div className="sl-filter-options">
        {options.map((item) => {
          const checked = value.includes(item.value);
          return (
            <label key={item.value} className={`sl-filter-chip ${checked ? 'is-active' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(item.value)} />
              <span>{item.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function SystemLibraryFilters({ filters, selectedTags, suggestedTags = [], loading, onToggleFilter, onToggleTag, onBooleanFilter, onCitationChange, onClear }) {
  const hasFilters = Object.entries(filters).some(([key, value]) => key !== 'sort' && (Array.isArray(value) ? value.length > 0 : Boolean(value))) || selectedTags.length > 0;

  return (
    <aside className="sl-filters" aria-label="Bộ lọc thư viện tài liệu">
      <div className="sl-filters__header">
        <div><p>Community facets</p><strong>Lọc tài liệu</strong></div>
        {hasFilters && <button type="button" onClick={onClear} className="sl-link-button">Xóa bộ lọc</button>}
      </div>
      {loading && <div className="sl-filter-skeleton" aria-live="polite">Đang lọc/search tài liệu...</div>}
      <div className="sl-filter-group">
        <h3>Tags gợi ý</h3>
        <div className="sl-filter-options">
          {suggestedTags.length ? suggestedTags.map(({ tag, count }) => (
            <button key={tag} type="button" className={`sl-filter-chip ${selectedTags.includes(tag) ? 'is-active' : ''}`} onClick={() => onToggleTag(tag)}>#{tag} <span>({count})</span></button>
          )) : <span className="sl-modal__muted">Chưa có tag gợi ý</span>}
        </div>
      </div>
      {selectedTags.length > 0 && (
        <div className="sl-filter-group"><h3>Tags đang lọc</h3><div className="sl-active-tags">{selectedTags.map((tag) => <button key={tag} type="button" className="sl-tag is-selected" onClick={() => onToggleTag(tag)}>#{tag} <X size={12} /></button>)}</div></div>
      )}
      <FilterGroup title="Peer-review status" options={FILTERS.peer_review_status} value={filters.peer_review_status} onToggle={(value) => onToggleFilter('peer_review_status', value)} />
      <FilterGroup title="Access Type" options={FILTERS.access_types} value={filters.access_types} onToggle={(value) => onToggleFilter('access_types', value)} />
      <FilterGroup title="Review Type" options={FILTERS.review_types} value={filters.review_types} onToggle={(value) => onToggleFilter('review_types', value)} />
      <div className="sl-filter-group"><h3>File/Asset</h3><div className="sl-filter-options">
        {[['has_pdf', 'Has PDF'], ['has_data', 'Has Data'], ['has_code', 'Has Code']].map(([key, label]) => <button key={key} type="button" className={`sl-filter-chip ${filters[key] ? 'is-active' : ''}`} onClick={() => onBooleanFilter(key)}>{label}</button>)}
      </div></div>
      <label className="sl-filter-group sl-citation-filter"><h3>Citation threshold</h3><input type="number" min="0" value={filters.citation_count_min || ''} onChange={(event) => onCitationChange(event.target.value)} placeholder="VD: 10" /></label>
      <div className="sl-filter-group"><h3>AI-powered filters (schema ready)</h3><p className="sl-modal__muted">Research methodology, readability, reading time, empirical evidence và stance sẽ được bật khi có dữ liệu AI; stance chỉ dùng khi có hypothesis.</p></div>
    </aside>
  );
}
