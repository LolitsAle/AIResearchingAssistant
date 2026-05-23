import { Link } from 'react-router-dom'

export default function HomePage(){
  return <div className='home'><h1>AI Researching Assistant</h1><p>Workspace nghiên cứu kiểu Gemini/NotebookLM: upload tài liệu, chat có trích dẫn, studio ghi chú.</p><Link to='/research' className='cta'>Mở Workspace</Link></div>
}
