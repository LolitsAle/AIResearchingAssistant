import { CheckCircle2, Clock3, Crown, Lock } from 'lucide-react';

const accessLabel = { free: 'Free', pro: 'Pro', vip: 'VIP' };

export default function SystemDocumentPreviewPopover({ document }) {
  const summary = document.ai_summary || document.description || 'Chưa có thông tin';
  const access = String(document.access_level || 'free').toLowerCase();

  return (
    <div className="sl-preview" role="tooltip">
      <div className="sl-preview__topline">
        <span>{document.file_type || 'Tài liệu'}</span>
        <span className={`sl-access sl-access--${access}`}>
          {access === 'vip' ? <Crown size={12} /> : access === 'pro' ? <Lock size={12} /> : null}
          {accessLabel[access] || access.toUpperCase()}
        </span>
      </div>
      <h4>{document.title || document.filename || 'Chưa có tiêu đề'}</h4>
      <p>{summary}</p>
      <dl>
        <div><dt>Độ dài</dt><dd>{document.page_count ?? '—'} trang · {document.word_count ?? '—'} từ</dd></div>
        <div><dt>Độ khó</dt><dd>{document.difficulty_level || 'Chưa có thông tin'}</dd></div>
        <div><dt>Chuyên ngành</dt><dd>{document.subject_area || 'Chưa có thông tin'}</dd></div>
      </dl>
      <div className="sl-preview__status">
        {document.is_vector_ready ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
        {document.is_vector_ready ? 'Sẵn sàng cho AI' : 'Đang xử lý vector'}
      </div>
      <div className="sl-preview__tags">
        {(document.tags || []).slice(0, 5).map((tag) => <span key={tag}>#{tag}</span>)}
        {(document.tags || []).length === 0 && <span>Chưa có tags</span>}
      </div>
    </div>
  );
}
