import { X } from 'lucide-react';

const FILTERS = {
  peer_review_status: [
    { value: 'PEER_REVIEWED', label: 'Đã bình duyệt' },
    { value: 'PREPRINT', label: 'Bản thảo / preprint' },
    { value: 'UNKNOWN', label: 'Chưa rõ' },
  ],
  access_types: [
    { value: 'OPEN_ACCESS', label: 'Truy cập mở' },
    { value: 'FREE_TO_READ', label: 'Đọc miễn phí' },
    { value: 'INSTITUTIONAL_ACCESS', label: 'Qua tổ chức' },
    { value: 'UNKNOWN', label: 'Chưa rõ' },
  ],
  review_types: [
    { value: 'RESEARCH_ARTICLE', label: 'Bài nghiên cứu' },
    { value: 'REVIEW', label: 'Tổng quan' },
    { value: 'SYSTEMATIC_REVIEW', label: 'Tổng quan hệ thống' },
    { value: 'META_ANALYSIS', label: 'Phân tích gộp' },
    { value: 'EDITORIAL', label: 'Xã luận' },
    { value: 'UNKNOWN', label: 'Chưa rõ' },
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
  const hasFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'sort') return false;
    if (key === 'citation_count_min') return Boolean(filters.citation_count_enabled) && value !== '';
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }) || selectedTags.length > 0;

  return (
    <aside className="sl-filters" aria-label="Bộ lọc thư viện tài liệu">
      <div className="sl-filters__header">
        <div><p>Bộ lọc cộng đồng</p><strong>Lọc tài liệu</strong></div>
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
      <FilterGroup title="Trạng thái bình duyệt" options={FILTERS.peer_review_status} value={filters.peer_review_status} onToggle={(value) => onToggleFilter('peer_review_status', value)} />
      <FilterGroup title="Kiểu truy cập" options={FILTERS.access_types} value={filters.access_types} onToggle={(value) => onToggleFilter('access_types', value)} />
      <FilterGroup title="Loại bài viết" options={FILTERS.review_types} value={filters.review_types} onToggle={(value) => onToggleFilter('review_types', value)} />
      <div className="sl-filter-group"><h3>Tệp / tài nguyên</h3><div className="sl-filter-options">
        {[['has_pdf', 'Có PDF'], ['has_data', 'Có dữ liệu'], ['has_code', 'Có mã nguồn']].map(([key, label]) => <button key={key} type="button" className={`sl-filter-chip ${filters[key] ? 'is-active' : ''}`} onClick={() => onBooleanFilter(key)}>{label}</button>)}
      </div></div>
      <div className="sl-filter-group sl-citation-filter">
        <h3>Lọc theo số trích dẫn</h3>
        <button
          type="button"
          className={`sl-filter-chip ${filters.citation_count_enabled ? 'is-active' : ''}`}
          onClick={() => onBooleanFilter('citation_count_enabled')}
        >
          {filters.citation_count_enabled ? 'Đang lọc citation ≥ ngưỡng' : 'Không lọc citation'}
        </button>
        <input
          type="number"
          min="0"
          disabled={!filters.citation_count_enabled}
          value={filters.citation_count_min || ''}
          onChange={(event) => onCitationChange(event.target.value)}
          placeholder="Mặc định: 0"
        />
        <p className="sl-modal__muted">Khi bật, chỉ hiển thị tài liệu có số trích dẫn lớn hơn hoặc bằng ngưỡng đã chọn.</p>
      </div>
      <div className="sl-filter-group"><h3>Bộ lọc AI (đã chuẩn bị schema)</h3><p className="sl-modal__muted">Phương pháp nghiên cứu, độ dễ đọc, thời gian đọc, bằng chứng thực nghiệm và lập trường sẽ được bật khi có dữ liệu AI; lập trường chỉ dùng khi có giả thuyết.</p></div>
    </aside>
  );
}
