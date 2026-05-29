import { Bookmark, CheckCircle2, Clock3, Crown, Lock, MessageSquare, GitCompare, FileText } from 'lucide-react';
import SystemDocumentPreviewPopover from './SystemDocumentPreviewPopover';

const difficultyLabel = {
  basic: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

function AccessBadge({ level = 'free' }) {
  const normalized = String(level).toLowerCase();
  const label = normalized === 'vip' ? 'VIP' : normalized === 'pro' ? 'Pro' : 'Free';
  return (
    <span className={`sl-badge sl-badge--${normalized}`}>
      {normalized === 'vip' ? <Crown size={12} /> : normalized === 'pro' ? <Lock size={12} /> : null}
      {label}
    </span>
  );
}

export default function SystemDocumentCard({
  document,
  selected,
  canChat,
  onToggleSelect,
  onToggleBookmark,
  onToggleTag,
  onChat,
  onCompare,
}) {
  const title = document.title || document.filename || 'Tài liệu chưa có tiêu đề';
  const description = document.description || document.ai_summary || 'Chưa có thông tin mô tả.';
  const disabledReason = !document.is_vector_ready
    ? 'Tài liệu đang xử lý vector, chưa sẵn sàng cho AI.'
    : !canChat
      ? 'Tài liệu này yêu cầu gói Pro/VIP.'
      : '';

  return (
    <article className={`sl-card ${selected ? 'is-selected' : ''}`}>
      <SystemDocumentPreviewPopover document={document} />
      <div className="sl-card__header">
        <label className="sl-select-box" title="Chọn để chat collection">
          <input type="checkbox" checked={selected} onChange={() => onToggleSelect(document.id)} />
          <span />
        </label>
        <div className="sl-card__file-icon"><FileText size={20} /></div>
        <button
          type="button"
          className={`sl-bookmark ${document.bookmarked_by_current_user ? 'is-bookmarked' : ''}`}
          onClick={() => onToggleBookmark(document)}
          aria-label={document.bookmarked_by_current_user ? 'Bỏ ghim tài liệu' : 'Ghim vào Tủ sách của tôi'}
        >
          <Bookmark size={18} fill={document.bookmarked_by_current_user ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="sl-card__body">
        <div className="sl-card__badges">
          {document.is_new && <span className="sl-badge sl-badge--new">Mới</span>}
          <AccessBadge level={document.access_level} />
          <span className="sl-badge sl-badge--file">{document.file_type || 'FILE'}</span>
          <span className="sl-badge sl-badge--difficulty">{difficultyLabel[document.difficulty_level] || document.difficulty_level || 'Chưa phân cấp'}</span>
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="sl-card__meta">
          <span>{document.subject_area || 'Khác'}</span>
          <span>•</span>
          <span>{document.page_count ?? '—'} trang</span>
          <span>•</span>
          <span>{document.word_count ?? '—'} từ</span>
        </div>
        <div className="sl-card__tags">
          {(document.tags || []).slice(0, 4).map((tag) => (
            <button key={tag} type="button" className="sl-tag" onClick={() => onToggleTag(tag)}>
              #{tag}
            </button>
          ))}
          {(document.tags || []).length > 4 && <span className="sl-more-tags">+{document.tags.length - 4}</span>}
        </div>
      </div>

      <div className="sl-card__footer">
        <span className={`sl-vector ${document.is_vector_ready ? 'is-ready' : 'is-processing'}`}>
          {document.is_vector_ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
          {document.is_vector_ready ? 'Sẵn sàng cho AI' : 'Đang xử lý'}
        </span>
        <div className="sl-card__actions">
          <button type="button" className="sl-icon-action" onClick={() => onCompare(document)} title="So sánh với tài liệu khác">
            <GitCompare size={16} />
          </button>
          <button type="button" className="sl-chat-action" onClick={() => onChat([document.id], 'single')} disabled={!canChat || !document.is_vector_ready} title={disabledReason || 'Chat với tài liệu này'}>
            <MessageSquare size={15} /> Chat
          </button>
        </div>
      </div>
    </article>
  );
}
