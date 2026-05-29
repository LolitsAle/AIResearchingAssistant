import { Bookmark, CheckCircle2, Clock3, Download, FileText, SendToBack } from 'lucide-react';
import SystemDocumentPreviewPopover from './SystemDocumentPreviewPopover';

export default function SystemDocumentCard({ document, onToggleBookmark, onToggleTag, onUseInResearch }) {
  const title = document.title || document.filename || 'Tài liệu chưa có tiêu đề';
  const summary = document.summary || document.ai_summary || 'Chưa có summary.';
  const downloadUrl = document.download_url || document.storage_path;

  return (
    <article className="sl-card">
      <SystemDocumentPreviewPopover document={document} />
      <div className="sl-card__header">
        <div className="sl-card__file-icon"><FileText size={20} /></div>
        <button type="button" className={`sl-bookmark ${document.bookmarked_by_current_user ? 'is-bookmarked' : ''}`} onClick={() => onToggleBookmark(document)} aria-label={document.bookmarked_by_current_user ? 'Bỏ ghim tài liệu' : 'Ghim tài liệu'}>
          <Bookmark size={18} fill={document.bookmarked_by_current_user ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="sl-card__body">
        <div className="sl-card__badges">
          {document.is_new && <span className="sl-badge sl-badge--new">Mới</span>}
          <span className="sl-badge sl-badge--file">{document.file_type || 'FILE'}</span>
        </div>
        <h3>{title}</h3>
        <p>{summary}</p>
        <div className="sl-card__meta"><span>{document.category || document.subject_area || 'Khác'}</span><span>•</span><span>{document.page_count ?? '—'} trang</span><span>•</span><span>{document.word_count ?? '—'} từ</span></div>
        <div className="sl-card__tags">
          {(document.tags || []).slice(0, 4).map((tag) => <button key={tag} type="button" className="sl-tag" onClick={() => onToggleTag(tag)}>#{tag}</button>)}
          {(document.tags || []).length > 4 && <span className="sl-more-tags">+{document.tags.length - 4}</span>}
        </div>
      </div>
      <div className="sl-card__footer">
        <span className={`sl-vector ${document.is_vector_ready ? 'is-ready' : 'is-processing'}`}>{document.is_vector_ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{document.is_vector_ready ? 'Sẵn sàng cho AI' : 'Đang xử lý'}</span>
        <div className="sl-card__actions">
          {downloadUrl && <a className="sl-icon-action" href={downloadUrl} target="_blank" rel="noreferrer" title="Tải xuống"><Download size={16} /></a>}
          <button type="button" className="sl-chat-action" onClick={() => onUseInResearch(document)} disabled={!document.is_vector_ready} title="Dùng trong Không gian Nghiên cứu"><SendToBack size={15} /> Dùng trong Không gian Nghiên cứu</button>
        </div>
      </div>
    </article>
  );
}
