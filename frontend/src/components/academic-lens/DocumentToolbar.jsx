import { Camera, FileUp, Library, MessageSquareText, NotebookTabs, RotateCcw } from 'lucide-react';

function shortTitle(title) {
  const clean = String(title || 'Chưa chọn tài liệu').trim();
  return clean.length > 72 ? `${clean.slice(0, 42)}…${clean.slice(-18)}` : clean;
}

export default function DocumentToolbar({ title, uploading, layoutMode = 'reading', notepadCollapsed = false, chatCollapsed = false, onUploadClick, onOpenLibrary, onToggleSnip, onOpenNotepad, onOpenChat, onLayoutModeChange, onResetLayout }) {
  const displayTitle = shortTitle(title);
  return (
    <div className="al-toolbar">
      <div className="al-toolbar-title" title={title || 'Chưa chọn tài liệu'}>
        <span className="al-eyebrow">Kính lúp Học thuật</span>
        <h2>{displayTitle}</h2>
      </div>
      <div className="al-toolbar-actions">
        <button type="button" onClick={onUploadClick} disabled={uploading}><FileUp size={16} /> {uploading ? 'Đang tải...' : 'Upload'}</button>
        <button type="button" onClick={onOpenLibrary}><Library size={16} /> Thư viện</button>
        <div className="al-mode-switcher" aria-label="Layout modes">
          {[
            ['reading', 'Đọc'],
            ['chat', 'Chat'],
            ['note', 'Ghi chú'],
          ].map(([mode, label]) => (
            <button key={mode} type="button" className={layoutMode === mode ? 'active' : ''} onClick={() => onLayoutModeChange?.(mode)} title={`Chuyển sang ${label} mode`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={onToggleSnip}><Camera size={16} /> Chụp ảnh</button>
        {chatCollapsed && <button type="button" onClick={onOpenChat} title="Mở AI ChatBox"><MessageSquareText size={16} /> Mở Chat</button>}
        <button type="button" onClick={onOpenNotepad} title={notepadCollapsed ? 'Mở ghi chú' : 'Đi tới ghi chú'}><NotebookTabs size={16} /> {notepadCollapsed ? 'Mở ghi chú' : 'Notepad'}</button>
        <button type="button" onClick={onResetLayout} title="Đặt lại bố cục"><RotateCcw size={16} /> Reset layout</button>
      </div>
    </div>
  );
}
