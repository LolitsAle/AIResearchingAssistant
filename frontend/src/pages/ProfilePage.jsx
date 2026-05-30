import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

function useGoogleCredential(callback) {
  const buttonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    if (window.google?.accounts?.id) { setReady(true); return; }
    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);
    const script = existing || document.createElement('script');
    script.src = GOOGLE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    if (!existing) document.body.appendChild(script);
  }, [clientId]);

  useEffect(() => {
    if (!ready || !clientId || !buttonRef.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => credential && callback(credential) });
    window.google.accounts.id.renderButton(buttonRef.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 260 });
  }, [ready, clientId, callback]);

  return { buttonRef, configured: Boolean(clientId) };
}

function downloadBlob({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fmtDate(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value)); } catch { return value; }
}

export default function ProfilePage() {
  const { token, user, updateUserContext, logoutContext } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState(null);
  const [tab, setTab] = useState('basic');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const showSuccess = (text) => { setMessage(text); setError(''); };
  const showError = (err) => { setError(err?.message || 'Đã có lỗi xảy ra.'); setMessage(''); };

  const load = async () => {
    setLoading(true);
    try {
      const [profileResp, activityResp] = await Promise.all([api.getProfile(token), api.getProfileActivity(token)]);
      setProfile(profileResp.user);
      updateUserContext(profileResp.user);
      setActivity(activityResp);
    } catch (err) { showError(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const theme = profile?.preferred_theme || 'system';
    document.documentElement.dataset.themePreference = theme;
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('profile-dark', dark);
  }, [profile?.preferred_theme]);

  const updateProfile = (nextUser) => {
    setProfile(nextUser);
    updateUserContext(nextUser);
  };

  const tabs = [
    ['basic', 'Thông tin cá nhân'], ['security', 'Bảo mật'], ['social', 'Liên kết tài khoản'],
    ['activity', 'Hoạt động'], ['preferences', 'Tuỳ chọn'], ['data', 'Dữ liệu & tài khoản'],
  ];

  return (
    <main className="profile-page">
      <style>{styles}</style>
      <header className="profile-hero">
        <div>
          <p className="eyebrow">AI Researching Assistant</p>
          <h1>Hồ sơ cá nhân</h1>
          <p>Quản lý danh tính, bảo mật, dữ liệu cá nhân và trải nghiệm làm việc của bạn.</p>
        </div>
        <div className="hero-user">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" /> : <span>{(profile?.email || user?.email || 'U').charAt(0).toUpperCase()}</span>}
          <div><strong>{profile?.display_name || profile?.full_name || profile?.name || user?.email}</strong><small>{profile?.email || user?.email}</small></div>
        </div>
      </header>

      {message && <div className="notice success">✓ {message}</div>}
      {error && <div className="notice error">⚠ {error}</div>}

      <nav className="profile-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>

      {loading ? <section className="card">Đang tải hồ sơ...</section> : null}
      {!loading && profile && tab === 'basic' && <BasicInfo profile={profile} token={token} onUpdate={updateProfile} onSuccess={showSuccess} onError={showError} />}
      {!loading && profile && tab === 'security' && <Security profile={profile} token={token} onUpdate={updateProfile} onSuccess={showSuccess} onError={showError} />}
      {!loading && profile && tab === 'social' && <SocialLinks profile={profile} token={token} onUpdate={updateProfile} onSuccess={showSuccess} onError={showError} />}
      {!loading && tab === 'activity' && <Activity activity={activity} />}
      {!loading && profile && tab === 'preferences' && <Preferences profile={profile} token={token} onUpdate={updateProfile} onSuccess={showSuccess} onError={showError} />}
      {!loading && profile && tab === 'data' && <DataAccount token={token} onSuccess={showSuccess} onError={showError} logoutContext={logoutContext} />}
    </main>
  );
}

function BasicInfo({ profile, token, onUpdate, onSuccess, onError }) {
  const [form, setForm] = useState({ full_name: profile.full_name || '', display_name: profile.display_name || '', gender: profile.gender || 'prefer_not_to_say', date_of_birth: profile.date_of_birth || '' });
  const [preview, setPreview] = useState(profile.avatar_url || '');
  const [file, setFile] = useState(null);

  const chooseAvatar = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };
  const cropSquareAndUpload = async () => {
    if (!file) return;
    const img = new Image();
    img.src = preview;
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, file.type || 'image/png', 0.9));
    const cropped = new File([blob], file.name, { type: blob.type });
    try { const resp = await api.uploadAvatar(cropped, token); onUpdate(resp.user); setFile(null); onSuccess('Đã cập nhật avatar.'); }
    catch (err) { onError(err); }
  };
  const submit = async (event) => {
    event.preventDefault();
    try { const resp = await api.updateProfile({ ...form, date_of_birth: form.date_of_birth || null }, token); onUpdate(resp.user); onSuccess('Đã lưu thông tin cá nhân.'); }
    catch (err) { onError(err); }
  };
  return <section className="grid two"><div className="card"><h2>Avatar</h2><div className="avatar-editor">{preview ? <img src={preview} alt="Preview avatar" /> : <span>{profile.email.charAt(0).toUpperCase()}</span>}</div><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} /><p className="muted">Ảnh được crop vuông bằng canvas trước khi upload. Tối đa 5MB.</p><button className="primary" disabled={!file} onClick={cropSquareAndUpload}>Upload avatar</button></div><form className="card form" onSubmit={submit}><h2>Thông tin cá nhân</h2><label>Họ và tên<input value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} /></label><label>Tên hiển thị / nickname<input value={form.display_name} onChange={e=>setForm({...form, display_name:e.target.value})} /></label><label>Email<input value={profile.email} disabled /></label><label>Giới tính<select value={form.gender} onChange={e=>setForm({...form, gender:e.target.value})}><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option><option value="prefer_not_to_say">Không muốn nói</option></select></label><label>Ngày sinh<input type="date" value={form.date_of_birth || ''} onChange={e=>setForm({...form, date_of_birth:e.target.value})} /></label><button className="primary">Lưu thay đổi</button></form></section>;
}

function Security({ profile, token, onUpdate, onSuccess, onError }) {
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [resetEmail, setResetEmail] = useState(profile.email);
  const changePassword = async (e) => { e.preventDefault(); if (pw.new_password !== pw.confirm) return onError(new Error('Mật khẩu xác nhận không khớp.')); try { const resp = await api.changePassword({ current_password: pw.current_password || null, new_password: pw.new_password }, token); onSuccess(resp.message); setPw({ current_password:'', new_password:'', confirm:'' }); onUpdate({ ...profile, has_password: true }); } catch (err) { onError(err); } };
  const reset = async () => { try { const resp = await api.requestPasswordReset(resetEmail); onSuccess(resp.message); } catch (err) { onError(err); } };
  const toggle2fa = async () => { try { const resp = profile.email_2fa_enabled ? await api.disableEmail2fa(token) : await api.enableEmail2fa(token); if (resp.user) onUpdate(resp.user); onSuccess(resp.message); } catch (err) { onError(err); } };
  return <section className="grid two"><form className="card form" onSubmit={changePassword}><h2>Đổi mật khẩu</h2>{profile.has_password && <label>Mật khẩu hiện tại<input type="password" value={pw.current_password} onChange={e=>setPw({...pw,current_password:e.target.value})} /></label>}<label>Mật khẩu mới<input type="password" minLength={6} value={pw.new_password} onChange={e=>setPw({...pw,new_password:e.target.value})} required /></label><label>Xác nhận mật khẩu mới<input type="password" minLength={6} value={pw.confirm} onChange={e=>setPw({...pw,confirm:e.target.value})} required /></label><button className="primary">Cập nhật mật khẩu</button><p className="muted">Tài khoản chỉ dùng Google cần reset/xác thực email trước khi đặt mật khẩu.</p></form><div className="card form"><h2>Reset mật khẩu & 2FA email</h2><label>Email reset<input value={resetEmail} onChange={e=>setResetEmail(e.target.value)} /></label><button className="secondary" onClick={reset}>Yêu cầu reset mật khẩu</button><div className="divider" /><p>2FA email: <strong>{profile.email_2fa_enabled ? 'Đang bật' : 'Đang tắt'}</strong></p><p className="muted">Nếu SMTP chưa cấu hình, hệ thống sẽ không fake OTP và sẽ báo cần cấu hình.</p><button className="secondary" onClick={toggle2fa}>{profile.email_2fa_enabled ? 'Tắt 2FA email' : 'Bật 2FA email'}</button></div></section>;
}

function SocialLinks({ profile, token, onUpdate, onSuccess, onError }) {
  const onCredential = async (credential) => { try { const resp = await api.connectGoogle(credential, token); onUpdate(resp.user); onSuccess(resp.message); } catch (err) { onError(err); } };
  const { buttonRef, configured } = useGoogleCredential(onCredential);
  const disconnect = async () => { try { const resp = await api.disconnectGoogle(token); onUpdate(resp.user); onSuccess(resp.message); } catch (err) { onError(err); } };
  return <section className="card"><h2>Liên kết tài khoản</h2><div className="social-row"><div><strong>Google</strong><p>{profile.google_connected ? 'Đã kết nối' : 'Chưa kết nối'}</p></div>{profile.google_connected ? <button className="danger-soft" onClick={disconnect}>Ngắt kết nối Google</button> : configured ? <div ref={buttonRef} /> : <span className="muted">Cần cấu hình VITE_GOOGLE_CLIENT_ID.</span>}</div><p className="muted">Chỉ cho ngắt Google khi tài khoản còn cách đăng nhập khác bằng mật khẩu.</p></section>;
}

function Activity({ activity }) {
  const stats = activity?.stats || {};
  return <section className="card"><h2>Lịch sử hoạt động</h2><div className="stats"><div><strong>{fmtDate(activity?.account_created_at)}</strong><span>Ngày tạo tài khoản</span></div><div><strong>{stats.notebooks ?? 0}</strong><span>Notebook</span></div><div><strong>{stats.documents ?? 0}</strong><span>Tài liệu</span></div><div><strong>{stats.research_sessions ?? 0}</strong><span>Phiên nghiên cứu</span></div><div><strong>{stats.notes ?? 0}</strong><span>Note</span></div></div><ul className="timeline">{(activity?.recent_activity || []).map((item, idx)=><li key={`${item.type}-${idx}`}><span>{item.label}</span><time>{fmtDate(item.created_at)}</time></li>)}{!activity?.recent_activity?.length && <li>Chưa có hoạt động gần đây.</li>}</ul></section>;
}

function Preferences({ profile, token, onUpdate, onSuccess, onError }) {
  const [form, setForm] = useState({ preferred_theme: profile.preferred_theme || 'system', preferred_language: profile.preferred_language || 'vi' });
  const submit = async (e) => { e.preventDefault(); try { const resp = await api.updatePreferences(form, token); onUpdate(resp.user); onSuccess('Đã lưu tuỳ chọn trải nghiệm.'); } catch (err) { onError(err); } };
  const labels = useMemo(() => form.preferred_language === 'en' ? { title: 'Experience preferences', theme: 'Theme', lang: 'Language', save: 'Save preferences' } : { title: 'Tuỳ chọn trải nghiệm', theme: 'Giao diện', lang: 'Ngôn ngữ', save: 'Lưu tuỳ chọn' }, [form.preferred_language]);
  return <form className="card form" onSubmit={submit}><h2>{labels.title}</h2><label>{labels.theme}<select value={form.preferred_theme} onChange={e=>setForm({...form, preferred_theme:e.target.value})}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>{labels.lang}<select value={form.preferred_language} onChange={e=>setForm({...form, preferred_language:e.target.value})}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></label><p className="muted">Preference được lưu trên hồ sơ. Trang profile đổi label cơ bản; full i18n toàn app cần triển khai riêng.</p><button className="primary">{labels.save}</button></form>;
}

function DataAccount({ token, onSuccess, onError, logoutContext }) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const exportData = async () => { try { downloadBlob(await api.exportProfileData(token)); onSuccess('Đã tải file dữ liệu cá nhân.'); } catch (err) { onError(err); } };
  const deactivate = async () => { try { await api.deactivateAccount(token); logoutContext(); window.location.href = '/login'; } catch (err) { onError(err); } };
  const remove = async () => { try { await api.deleteAccount(token); logoutContext(); window.location.href = '/login'; } catch (err) { onError(err); } };
  return <section className="grid two"><div className="card"><h2>Tải dữ liệu cá nhân</h2><p>Xuất JSON gồm hồ sơ, notebooks, tài liệu, phiên nghiên cứu và notes thuộc tài khoản hiện tại.</p><button className="secondary" onClick={exportData}>Tải xuống dữ liệu cá nhân</button></div><div className="card danger-zone"><h2>Danger zone</h2><button className="danger-soft" onClick={()=>setDeactivateOpen(true)}>Vô hiệu hóa tài khoản</button>{deactivateOpen && <div className="confirm"><p>Bạn có chắc muốn vô hiệu hóa tài khoản? Dữ liệu không bị xóa và bạn sẽ được đăng xuất.</p><button className="danger" onClick={deactivate}>Xác nhận vô hiệu hóa</button><button className="secondary" onClick={()=>setDeactivateOpen(false)}>Hủy</button></div>}<div className="divider" /><label>Nhập <strong>XOA TAI KHOAN</strong> để xóa/ẩn danh hồ sơ<input value={deleteText} onChange={e=>setDeleteText(e.target.value)} /></label><button className="danger" disabled={deleteText !== 'XOA TAI KHOAN'} onClick={remove}>Xóa tài khoản vĩnh viễn</button></div></section>;
}

const styles = `
.profile-page{padding:28px; color:#2c251c; font-family:'DM Sans',system-ui,sans-serif; max-width:1200px; margin:0 auto}.profile-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(135deg,#fff8ea,#f2dfb6);border:1px solid #ead8ae;border-radius:28px;padding:28px;box-shadow:0 18px 50px rgba(82,61,28,.08)}.eyebrow{letter-spacing:.12em;text-transform:uppercase;color:#9b7640;font-size:12px;font-weight:800}.profile-hero h1{font-family:'Lora',serif;font-size:38px;margin:8px 0}.hero-user{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.7);border-radius:20px;padding:12px 14px;min-width:260px}.hero-user img,.hero-user span,.avatar-editor img,.avatar-editor span{width:58px;height:58px;border-radius:18px;object-fit:cover;background:#c4a464;color:#1a1510;display:grid;place-items:center;font-weight:800}.hero-user small{display:block;color:#806f5d}.notice{margin:16px 0;padding:13px 16px;border-radius:16px;border:1px solid}.notice.success{background:#ecfdf3;border-color:#b7ebc9;color:#166534}.notice.error{background:#fff1f2;border-color:#fecdd3;color:#9f1239}.profile-tabs{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.profile-tabs button{border:1px solid #e4d4ad;background:#fffaf0;border-radius:999px;padding:10px 14px;cursor:pointer;color:#6c5634;font-weight:700}.profile-tabs button.active{background:#1d1710;color:#f5db98;border-color:#1d1710}.grid{display:grid;gap:18px}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}.card{background:#fffdf8;border:1px solid #eadfca;border-radius:24px;padding:24px;box-shadow:0 18px 44px rgba(66,50,24,.06)}.card h2{font-family:'Lora',serif;margin:0 0 16px}.form{display:grid;gap:14px}.form label,.danger-zone label{display:grid;gap:7px;font-weight:700;color:#5f4a2b}.form input,.form select,.danger-zone input{border:1px solid #dfcfaa;border-radius:12px;padding:11px 12px;background:#fffaf0;color:#2c251c}.form input:disabled{color:#8d806d;background:#f5ead4}.primary,.secondary,.danger,.danger-soft{border:0;border-radius:13px;padding:11px 15px;font-weight:800;cursor:pointer}.primary{background:linear-gradient(135deg,#c4a464,#8a6a30);color:#1a1510}.secondary{background:#f6ead0;color:#624718;border:1px solid #e3c990}.danger{background:#b91c1c;color:white}.danger:disabled{opacity:.45;cursor:not-allowed}.danger-soft{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}.muted{color:#837260;font-size:13px}.avatar-editor{margin:10px 0}.avatar-editor img,.avatar-editor span{width:150px;height:150px;border-radius:36px}.divider{height:1px;background:#eadfca;margin:14px 0}.social-row{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #eadfca;border-radius:18px;padding:18px}.social-row p{margin:4px 0 0;color:#7c6a55}.stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:20px}.stats div{background:#fff7e7;border:1px solid #ecd9af;border-radius:18px;padding:16px}.stats strong{display:block;font-size:22px}.stats span{font-size:12px;color:#7b6a55}.timeline{display:grid;gap:10px;padding:0;margin:0;list-style:none}.timeline li{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #f0e4cd;padding:10px 0}.timeline time{color:#867761;font-size:12px;white-space:nowrap}.confirm{margin:12px 0;padding:14px;border:1px solid #fecdd3;border-radius:16px;background:#fff7f7;display:grid;gap:10px}@media(max-width:850px){.profile-page{padding:18px}.profile-hero,.hero-user{display:block}.grid.two,.stats{grid-template-columns:1fr}.timeline li{display:block}}`;
