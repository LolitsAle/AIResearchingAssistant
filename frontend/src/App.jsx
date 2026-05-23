import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ResearchPage from './pages/ResearchPage'

export default function App() {
  return <BrowserRouter><Routes><Route path='/' element={<HomePage />} /><Route path='/research' element={<ResearchPage />} /><Route path='*' element={<Navigate to='/' replace />} /></Routes></BrowserRouter>
}
