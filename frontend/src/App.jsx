import { useEffect, useState } from 'react';
import { api } from './services/api';
import './styles/global.css';

export default function App() {
  const [papers, setPapers] = useState([]); const [selected, setSelected] = useState(null); const [health, setHealth] = useState({status:'checking'});
  const [chat, setChat] = useState([]); const [input, setInput] = useState(''); const [sources, setSources] = useState([]); const [loading, setLoading]=useState(false);
  const [summary, setSummary] = useState(null); const [term, setTerm]=useState(''); const [termData, setTermData]=useState(null); const [compareIds,setCompareIds]=useState([]); const [compare,setCompare]=useState(null);
  const load = async () => { const d = await api.listPapers(); setPapers(d.papers || []);};
  useEffect(()=>{load(); api.health().then(setHealth).catch(()=>setHealth({status:'down',ollama:'unavailable'}));},[]);
  const selectPaper = async (p) => { setSelected(p); const [d,c]= await Promise.all([api.getPaper(p.id), api.chat(p.id)]); setSummary(d.summary); setChat(c.messages||[]); setSources([]); };
  const send = async (q=input) => { if(!selected || !q.trim()) return; setLoading(true); setChat(v=>[...v,{role:'user',content:q}]); setInput(''); try{const r=await api.ask(selected.id,q); setChat(v=>[...v,{role:'assistant',content:r.answer,citations:r.citations}]); setSources(r.citations||[]);}finally{setLoading(false);} };
  return <div className='layout'>
    <aside className='sidebar'><h2>Research Copilot</h2><div className='health'>Backend: {health.status || 'ok'} | Ollama: {health.ollama}</div>
      <input type='file' accept='application/pdf' onChange={async e=>{const f=e.target.files?.[0]; if(!f)return; setLoading(true); try{const r=await api.uploadPaper(f); await load(); const np=r.paper; const fp={...np}; setSelected(fp); await selectPaper(fp);}finally{setLoading(false);} }}/>
      <div>{papers.map(p=><div key={p.id} className={`paper ${selected?.id===p.id?'active':''}`}><button onClick={()=>selectPaper(p)}>{p.title}</button><small>{p.status}</small><button onClick={async()=>{await api.deletePaper(p.id);await load(); if(selected?.id===p.id) setSelected(null);}}>x</button></div>)}</div>
    </aside>
    <main className='main'>{!selected?<div className='empty'>Upload a paper to start researching with your AI assistant.</div>:<>
      <h3>{selected.title}</h3>
      <div className='quick'><button onClick={()=>api.summarize(selected.id).then(r=>setSummary(r.summary))}>Summarize this paper</button><button onClick={()=>send('Extract main contributions of this paper')}>Extract contributions</button><button onClick={()=>send('Explain methodology of this paper')}>Explain methodology</button></div>
      {summary && <section className='card'><h4>Summary</h4><p>{summary.short_summary}</p><p>{summary.detailed_summary}</p></section>}
      <section className='chat'>{chat.map((m,i)=><div key={i} className={`msg ${m.role}`}>{m.content}</div>)}{loading&&<div className='msg assistant'>Researching paper... Finding relevant sections... Generating grounded answer...</div>}</section>
      <div className='input'><textarea value={input} onChange={e=>setInput(e.target.value)} /><button onClick={()=>send()}>Send</button></div>
      <section className='card'><h4>Explain Term</h4><input value={term} onChange={e=>setTerm(e.target.value)} /><button onClick={async()=>{const r=await api.explainTerm(selected.id,term); setTermData(r); setSources(r.citations||[]);}}>Explain</button>{termData&&<p>{termData.explanation}</p>}</section>
      <section className='card'><h4>Compare Papers</h4><div>{papers.map(p=><label key={p.id}><input type='checkbox' checked={compareIds.includes(p.id)} onChange={e=>setCompareIds(v=>e.target.checked?[...v,p.id]:v.filter(x=>x!==p.id))}/>{p.title}</label>)}</div><button onClick={async()=>setCompare((await api.compare(compareIds)).comparison)}>Compare selected papers</button>{compare?.overview && <p>{compare.overview}</p>}</section>
    </>}</main>
    <aside className='sources'><h4>Sources</h4>{sources.map(s=><div key={s.chunk_id} className='source'><b>{s.section}</b><div>p{s.page_start}-{s.page_end} score {s.score?.toFixed?.(2)}</div><p>{s.snippet}</p></div>)}</aside>
  </div>
}
