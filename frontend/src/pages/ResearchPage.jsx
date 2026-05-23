import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'

const TEMPLATES = [
  ['overview', 'Tổng quan tài liệu'], ['deep_summary', 'Tóm tắt chuyên sâu'], ['key_arguments', 'Rút trích luận điểm'], ['mind_map', 'Bản đồ tư duy'], ['quiz', 'Bài kiểm tra'], ['flashcards', 'Flashcards'], ['terminology', 'Giải thích thuật ngữ'], ['compare_sources', 'So sánh nhiều nguồn'], ['citation_answer', 'Trả lời có trích dẫn'], ['data_table', 'Bảng dữ liệu'],
]

export default function ResearchPage() {
  const [workspaces, setWorkspaces] = useState([]); const [workspaceId, setWorkspaceId] = useState('')
  const [workspaceName, setWorkspaceName] = useState(''); const [sources, setSources] = useState([]); const [selectedIds, setSelectedIds] = useState([])
  const [messages, setMessages] = useState([]); const [notes, setNotes] = useState([]); const [input, setInput] = useState(''); const [error, setError] = useState('')
  const [loading, setLoading] = useState(false); const [search, setSearch] = useState(''); const [settings, setSettings] = useState({ accent_color: '#6d5dfc' })
  const fileRef = useRef(null)
  const loadWorkspace = async (id) => {
    const [src, chat, ns] = await Promise.all([api.getWorkspaceSources(id), api.getWorkspaceChat(id), api.getNotes(id)])
    setSources(src.documents || []); setSelectedIds(src.selected_document_ids || []); setMessages(chat.messages || []); setNotes(ns.notes || [])
  }
  useEffect(() => { (async () => {
    const wsr = await api.getWorkspaces(); let list = wsr.workspaces || []
    if (!list.length) { const created = await api.createWorkspace({ name: 'Workspace mặc định' }); list = [created] }
    setWorkspaces(list); setWorkspaceId(list[0].id); setWorkspaceName(list[0].name); await loadWorkspace(list[0].id)
    const st = await api.getSettings(); setSettings(st); document.documentElement.style.setProperty('--accent', st.accent_color || '#6d5dfc')
  })().catch((e) => setError(e.message)) }, [])

  const filtered = useMemo(() => sources.filter((d) => (d.title || d.filename).toLowerCase().includes(search.toLowerCase())), [sources, search])
  const send = async (text=input) => { const message = text.trim(); if (!message || !workspaceId || loading) return; if (!selectedIds.length) return setError('Vui lòng chọn ít nhất một nguồn để AI trả lời có căn cứ.');
    setError(''); setInput(''); setLoading(true); setMessages((m)=>[...m,{role:'user',content:message}])
    try { const r = await api.sendWorkspaceMessage(workspaceId,{message,selected_document_ids:selectedIds}); setMessages((m)=>[...m,{role:'assistant',content:r.answer,citations:r.citations||[]}]) } catch(e){setError(e.message)} finally {setLoading(false)} }
  return <div className='workspace-shell'>
    <div className='top-nav'><div className='left'><strong>◉ AI Researching Assistant</strong><select value={workspaceId} onChange={async e=>{const id=e.target.value;setWorkspaceId(id);const w=workspaces.find(x=>x.id===id);setWorkspaceName(w?.name||'');await loadWorkspace(id)}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} onBlur={async()=>{if(workspaceId) await api.updateWorkspace(workspaceId,{name:workspaceName})}}/></div>
    <div className='right'><button onClick={async()=>{await api.createNewChat(workspaceId); setMessages([])}}>+ Tạo đoạn chat mới</button><button onClick={async()=>alert(JSON.stringify(await api.getAnalytics(workspaceId),null,2))}>Số liệu phân tích</button><button onClick={async()=>{const next=prompt('Accent color hex',settings.accent_color)||settings.accent_color;const st=await api.updateSettings({theme_mode:'dark',accent_color:next});setSettings(st);document.documentElement.style.setProperty('--accent',st.accent_color)}}>Cài đặt</button></div></div>
    <div className='workspace-grid'>
      <section className='panel'><h3>Nguồn</h3><button onClick={()=>fileRef.current?.click()}>+ Thêm nguồn</button><input ref={fileRef} hidden type='file' accept='application/pdf' onChange={async e=>{const f=e.target.files?.[0];if(f){await api.uploadDocument(workspaceId,f);await loadWorkspace(workspaceId)}}} />
      <input placeholder='Tìm nguồn...' value={search} onChange={e=>setSearch(e.target.value)} /><label><input type='checkbox' checked={selectedIds.length===sources.length&&sources.length>0} onChange={async e=>{const ids=e.target.checked?sources.map(s=>s.id):[];setSelectedIds(ids);await api.updateSourceSelection(workspaceId,ids)}} />Chọn tất cả</label><small>{selectedIds.length} nguồn được chọn</small>
      <div className='list'>{filtered.map(d=><div className='item' key={d.id}><label><input type='checkbox' checked={selectedIds.includes(d.id)} onChange={async()=>{const ids=selectedIds.includes(d.id)?selectedIds.filter(x=>x!==d.id):[...selectedIds,d.id];setSelectedIds(ids);await api.updateSourceSelection(workspaceId,ids)}} />{d.title||d.filename}</label><small>{d.status} • {d.page_count} trang • {d.chunk_count} chunks</small></div>)}</div></section>
      <section className='panel center'><h3>Cuộc trò chuyện</h3><div className='chat-log'>{messages.map((m,i)=><div key={i} className={`msg ${m.role}`}><p>{m.content}</p>{m.citations?.length>0 && <div>{m.citations.map((c,idx)=><button key={c.chunk_id} title={c.snippet}>[{idx+1}]</button>)}</div>} {m.role==='assistant'&&<button onClick={async()=>{await api.createNote(workspaceId,{title:'Ghi chú từ chat',content:m.content,citations:m.citations||[]});setNotes((await api.getNotes(workspaceId)).notes||[])}}>Lưu vào ghi chú</button>}</div>)}{loading&&<div className='msg assistant'><p>AI đang tìm đoạn liên quan...<br/>AI đang đọc các nguồn đã chọn...<br/>AI đang tạo câu trả lời có trích dẫn...</p></div>}</div>
      {error&&<div className='error'>{error}</div>}<div className='chat-input'><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder='Đặt câu hỏi hoặc tạo nội dung' onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><div><span>{selectedIds.length} nguồn</span><button onClick={()=>send()} disabled={loading||!input.trim()||!selectedIds.length}>➤</button></div></div></section>
      <section className='panel'><h3>Studio</h3><div className='studio-grid'>{TEMPLATES.map(([k,t])=><button key={k} onClick={async()=>{const r=await api.runStudioTemplate(workspaceId,{template:k,selected_document_ids:selectedIds});setNotes((p)=>[{...r,id:Math.random().toString()},...p])}}>{t}</button>)}</div><h4>Ghi chú</h4><div className='list'>{notes.length?notes.map(n=><div className='item' key={n.id}><strong>{n.title}</strong><p>{n.content}</p></div>):<p>Đầu ra của Studio sẽ được lưu ở đây.</p>}</div></section>
    </div>
  </div>
}
