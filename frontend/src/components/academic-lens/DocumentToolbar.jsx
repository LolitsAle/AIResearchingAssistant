import { Camera, FileUp, Library, NotebookTabs, RotateCcw } from 'lucide-react';

export default function DocumentToolbar({ title, uploading, layoutMode = 'reading', notepadCollapsed = false, onUploadClick, onOpenLibrary, onToggleSnip, onOpenNotepad, onLayoutModeChange, onResetLayout }) {
  return (
    <div className="al-toolbar">
      <div>
        <span className="al-eyebrow">Kính lúp Học thuật</span>
        <h2>{title || 'Chưa chọn tài liệu'}</h2>
      </div>
      <div className="al-toolbar-actions">
        <button type="button" onClick={onUploadClick} disabled={uploading}><FileUp size={16} /> {uploading ? 'Đang tải...' : 'Upload'}</button>
        <button type="button" onClick={onOpenLibrary}><Library size={16} /> Thư viện</button>
        <div className="al-mode-switcher" aria-label="Layout modes">
          {[
            ['reading', 'Đọc'],
            ['chat', 'Chat'],
            ['note', 'Ghi chú'],
            ['vision', 'Crop'],
          ].map(([mode, label]) => (
            <button key={mode} type="button" className={layoutMode === mode ? 'active' : ''} onClick={() => onLayoutModeChange?.(mode)} title={`Chuyển sang ${label} mode`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={onToggleSnip} className={layoutMode === 'vision' ? 'is-accent' : ''}><Camera size={16} /> Chụp ảnh</button>
        <button type="button" onClick={onOpenNotepad} title={notepadCollapsed ? 'Mở ghi chú' : 'Đi tới ghi chú'}><NotebookTabs size={16} /> {notepadCollapsed ? 'Mở ghi chú' : 'Notepad'}</button>
        <button type="button" onClick={onResetLayout} title="Đặt lại bố cục"><RotateCcw size={16} /> Reset layout</button>
      </div>
    </div>
  );
}
