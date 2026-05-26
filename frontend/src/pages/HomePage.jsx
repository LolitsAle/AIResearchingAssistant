import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const { user, login, register, logout } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        if (password !== confirm) throw new Error('Mật khẩu xác nhận không khớp.')
        await register(name, email, password)
      } else {
        await login(email, password)
      }
      navigate('/research')
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }


  if (user) {
    return <div className='home'><h1>Xin chào {user.name}</h1><p>Bạn đã đăng nhập.</p><div style={{display:'flex',gap:12}}><Link to='/research' className='cta'>Vào Workspace</Link><button className='cta' onClick={logout}>Đăng xuất</button></div></div>
  }

  return <div className='home'><h1>AI Researching Assistant</h1><p>Đăng nhập để bắt đầu nghiên cứu tài liệu.</p>
    <div style={{maxWidth:420,width:'100%',display:'grid',gap:10}}>
      {mode === 'register' && <input placeholder='Họ và tên' value={name} onChange={(e)=>setName(e.target.value)} />}
      <input placeholder='Email' value={email} onChange={(e)=>setEmail(e.target.value)} />
      <input type='password' placeholder='Mật khẩu' value={password} onChange={(e)=>setPassword(e.target.value)} />
      {mode === 'register' && <input type='password' placeholder='Xác nhận mật khẩu' value={confirm} onChange={(e)=>setConfirm(e.target.value)} />}
      {error && <small style={{color:'#ef4444'}}>{error}</small>}
      <button className='cta' onClick={submit} disabled={loading}>{mode === 'register' ? 'Đăng ký' : 'Đăng nhập'}</button>
      <button onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}</button>
    </div>
  </div>
}
