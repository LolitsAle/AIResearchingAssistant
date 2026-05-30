import { Languages, Search, Sparkles, WandSparkles } from 'lucide-react';

export default function SelectionActionPopover({ selection, onAction }) {
  if (!selection?.text) return null;
  const words = selection.text.trim().split(/\s+/).filter(Boolean).length;
  const shortActions = [
    { key: 'term', label: 'Giải thích thuật ngữ', icon: Sparkles, prompt: 'Hãy giải thích thuật ngữ này.' },
    { key: 'translate', label: 'Dịch thuật', icon: Languages, prompt: 'Hãy dịch cụm từ này sang tiếng Việt.' },
    { key: 'web', label: 'Tìm kiếm Web', icon: Search, prompt: 'Hãy tìm kiếm web độc lập về cụm từ này.', web: true },
  ];
  const longActions = [
    { key: 'summary', label: 'Tóm tắt', icon: WandSparkles, prompt: 'Hãy tóm tắt đoạn này.' },
    { key: 'translate_paragraph', label: 'Dịch đoạn này', icon: Languages, prompt: 'Hãy dịch đoạn này sang tiếng Việt.' },
    { key: 'deep', label: 'Phân tích sâu', icon: Sparkles, prompt: 'Hãy phân tích sâu đoạn này, nêu luận điểm chính và hàm ý học thuật.' },
  ];
  const actions = words <= 2 ? shortActions : longActions;
  const left = Math.min(selection.x, window.innerWidth - 260);
  const top = Math.max(12, selection.y - 52);

  return (
    <div className="al-selection-popover" style={{ left, top }}>
      {actions.map(({ key, label, icon: Icon, prompt, web }) => (
        <button key={key} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onAction({ prompt, web })}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}
