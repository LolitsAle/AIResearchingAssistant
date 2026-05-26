import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ResearchPage from './pages/ResearchPage'
import { useAuth } from './contexts/AuthContext'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className='home'><p>Đang tải phiên đăng nhập...</p></div>
  if (!user) return <Navigate to='/' replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/research' element={<ProtectedRoute><ResearchPage /></ProtectedRoute>} />
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}
