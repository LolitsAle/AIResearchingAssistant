export default function Toast({ toast, onClose }) {
  if (!toast) return null

  return (
    <div className={`toast toast-${toast.type || 'info'}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Đóng thông báo">×</button>
    </div>
  )
}
