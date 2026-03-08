import React, { useState, useRef, useEffect } from "react";

const PROXY_URL = "https://trading-copilot-api-cjfaa8debddtdfar.eastus-01.azurewebsites.net/api/proxy";
  type: "url",
  url: "https://bcmcp.freewheel.com",
  name: "BWFW",
  tool_configuration: {
    enabled: true,
    allowed_tools: [
      "buyer_cloud_login_encrypted",
      "buyer_cloud_logout",
      "v2_get_campaigns",
      "v2_get_campaigns_id",
      "v2_get_campaigns_id_metrics",
      "v2_get_line_items",
      "v2_get_line_items_id",
      "v2_get_line_items_id_metrics",
      "v2_get_line_items_id_notifications",
      "v2_get_advertisers",
      "v2_get_advertisers_id",
      "v2_get_deals",
      "v2_get_deals_id",
      "v2_get_creatives",
      "v2_get_creatives_id",
      "v2_get_bid_modifiers",
      "v2_get_bid_modifiers_id",
      "v2_get_delivery_modifiers",
      "v2_get_delivery_modifiers_id",
      "v2_get_targeting_expressions",
      "v2_get_targeting_expressions_id",
      "v2_get_reporting_saved_reports",
      "v2_get_reporting_saved_reports_id",
      "v2_get_reporting_async_results_id",
      "v2_get_segments",
      "v2_get_segment",
      "bidstream_analyzer",
      "deal_analyst",
      "check_campaign_health",
      "commitment_analyst",
      "ssp_analyzer",
      "quality_evaluator"
    ]
  }
};

const SYSTEM_PROMPT = `You are a programmatic trading copilot for a digital advertising DSP (Demand-Side Platform) called FreeWheel/Beeswax.

Your role is to:
- Provide tactical advice on campaign pacing, including under/over-delivery, flighting, and intra-day pacing, with the goal of meeting performance objectives while maximizing profit margin.
- Recommend deal setup and optimization changes: deal types, floor/ceiling prices, inventory sources, supply paths, and domain/app lists.
- Analyze live performance data (campaigns, line items, deals, inventory sources, domains) retrieved via the DSP connector and highlight what is working well or poorly.
- Suggest optimizations including: budget reallocations, bid and bid-modifier changes, targeting adjustments, inclusion/exclusion of domains or inventory sources, and pricing tactics (floors, CPM/CPA/CPC targets).
- Generate daily updates and round-ups of the previous day's activity (spend, delivery, key KPIs, notable wins/losses, major pacing or performance shifts) and use these insights when recommending future actions.

Behavior and constraints:
- Always balance performance (e.g., CPA, ROAS, CTR, Viewability) with maximizing margin; explicitly call out trade-offs when recommending changes.
- Use the DSP tools to pull fresh data before making recommendations; clearly reference which campaigns, line items, deals, or domains your advice is based on.
- Prefer concrete, actionable recommendations over generic commentary.
- Communicate in concise, trader-friendly language and, where useful, provide a short prioritized action list.
- Format responses using markdown with clear headers, bullet points, and tables where helpful.`;

// ── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:      "#000000", bgCard: "#0d0d0d", bgInput: "#111111",
  border:  "#1f1f1f", borderHi: "#7759ED", accent: "#7759ED",
  pop:     "#F26724", red: "#F25F5C", green: "#A1E887", teal: "#2FE1EA",
  text:    "#F9EFEF", muted: "#7a7065", subtle: "#3a3530",
};
const FONT = `'Satoshi', 'Inter', system-ui, sans-serif`;

const SUGGESTED_PROMPTS = [
  { icon: "📊", label: "Daily Round-Up",      color: C.accent, prompt: "Generate a daily round-up of yesterday's campaign performance. Pull spend, delivery, and key KPIs across all active campaigns." },
  { icon: "⚠️", label: "Pacing Alerts",       color: C.red,    prompt: "Check all active line items for pacing issues. Flag anything under-delivering by more than 15% or over-delivering." },
  { icon: "🎯", label: "Deal Health Check",   color: C.pop,    prompt: "Audit my active deals. Identify any with low win rates, high floors relative to clearing price, or low fill rates." },
  { icon: "💰", label: "Budget Reallocation", color: C.green,  prompt: "Based on current performance, where should I reallocate budget to maximize margin and hit delivery goals?" },
  { icon: "📈", label: "Top Performers",      color: C.teal,   prompt: "Show me my top-performing campaigns and line items by margin. What's working and why?" },
  { icon: "🔍", label: "Inventory Analysis",  color: C.accent, prompt: "Analyze my inventory sources and SSPs. Which are delivering the best CPM efficiency and viewability?" },
];

function parseCipherSnippet(raw) {
  const ct   = raw.match(/"ciphertext"\s*[:\s]+["']?([A-Za-z0-9+/=]+)["']?/);
  const acc  = raw.match(/"account_id"\s*[:\s]+["']?(\d+)["']?/);
  const sess = raw.match(/session_id\s*[:\s]+["']?([a-zA-Z0-9_\-]+)["']?/);
  return { ciphertext: ct?.[1]||null, account_id: acc?.[1]||null, session_id: sess?.[1]||null };
}

const pillBtn = (hi) => ({
  background:"transparent", border:`1px solid ${hi?C.accent:C.subtle}`,
  borderRadius:"6px", color: hi?C.text:C.muted, fontSize:"11px",
  padding:"4px 10px", cursor:"pointer", fontFamily:FONT,
  transition:"all 0.15s", whiteSpace:"nowrap",
});

const MMIcon = ({ size=28 }) => (
  <svg width={size} height={size*(34/91)} viewBox="0 0 91 34" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
    <path d="M62.4506 0 69.5022 0 69.5022 18.2334 62.4506 18.2334Z" fill="#FFFFFF"/>
    <path d="M20.8396 15.6271 27.8913 15.6271 27.8913 33.8605 20.8396 33.8605Z" fill="#FFFFFF"/>
    <path d="M0 24.7438 7.05164 24.7438 7.05164 33.8605 0 33.8605Z" fill="#FFFFFF"/>
    <path d="M41.653 0 48.7046 0 48.7046 33.8605 41.653 33.8605Z" fill="#FFFFFF"/>
    <path d="M83.2534 0 90.3051 0 90.3051 9.11668 83.2534 9.11668Z" fill="#FFFFFF"/>
  </svg>
);

const GlobalStyle = () => (
  <style>{`
    @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${C.bg}; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: ${C.bg}; }
    ::-webkit-scrollbar-thumb { background: ${C.subtle}; border-radius: 3px; }
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes pulse   { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1)} }
    @keyframes fadein  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `}</style>
);

// ── API CALL ───────────────────────────────────────────────────────────────
async function callClaude(messages, systemSuffix = "") {
  // Keep only last 6 messages to prevent context bloat from MCP tool results
  const trimmedMessages = messages.slice(-6);
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT + systemSuffix,
          cache_control: { type: "ephemeral" }
        }
      ],
      messages: trimmedMessages,
      mcp_servers: [MCP_SERVER],
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("\n");
}

// ── AUTH GATE ──────────────────────────────────────────────────────────────
function AuthGate({ onSuccess }) {
  const [snippet, setSnippet] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);

  const handleConnect = async () => {
    const parsed = parseCipherSnippet(snippet);
    if (!parsed.ciphertext || !parsed.account_id) { setErr("parse"); return; }
    setLoading(true); setErr(null);
    try {
      const loginPrompt = `Use the buyer_cloud_login_encrypted tool with — ciphertext: "${parsed.ciphertext}", account_id: "${parsed.account_id}"${parsed.session_id?`, session_id: "${parsed.session_id}"`:""}. Confirm when authenticated.`;
      const text = await callClaude([{ role:"user", content: loginPrompt }]);
      if (["fail","error","invalid","unable","cannot","unauthorized","wrong"].some(w=>text.toLowerCase().includes(w)))
        throw new Error("auth");
      onSuccess(parsed);
    } catch(e) { setErr(e.message==="parse"?"parse":"auth"); }
    finally    { setLoading(false); }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.text,fontFamily:FONT,alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <GlobalStyle/>
      <div style={{width:"100%",maxWidth:"440px",display:"flex",flexDirection:"column",gap:"28px",animation:"fadein 0.4s ease"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"14px"}}>
          <MMIcon size={72}/>
          <div style={{fontSize:"11px",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trading Copilot · FreeWheel / Beeswax</div>
        </div>
        <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:"16px",padding:"26px",display:"flex",flexDirection:"column",gap:"18px"}}>
          <div>
            <div style={{fontWeight:700,fontSize:"14px",color:C.text,marginBottom:"6px"}}>🔐 Connect to Buyer Cloud</div>
            <div style={{fontSize:"12px",color:C.muted,lineHeight:"1.7"}}>
              Paste your full cipher snippet from the{" "}
              <a href="https://bcmcp.freewheel.com/cipher" target="_blank" rel="noreferrer" style={{color:C.pop,textDecoration:"none"}}>cipher generator ↗</a>.
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            <label style={{fontSize:"11px",color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>Cipher Snippet</label>
            <textarea value={snippet} onChange={e=>{setSnippet(e.target.value);setErr(null);}}
              placeholder={`Paste your snippet here, e.g:\n  "ciphertext":"wp4ts..."\n  "account_id":"4"\n  session_id : "chpgt-..."\n  ~~~~~~~~`}
              rows={7}
              style={{background:C.bgInput,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"10px 12px",color:C.text,fontSize:"12px",fontFamily:"'Courier New',monospace",resize:"vertical",outline:"none",lineHeight:"1.6",transition:"border 0.15s"}}
              onFocus={e=>e.target.style.borderColor=C.accent}
              onBlur={e=>e.target.style.borderColor=C.border}
            />
          </div>
          {err && (
            <div style={{background:"#110a00",border:`1px solid ${C.pop}`,borderRadius:"8px",padding:"12px 14px",fontSize:"12px",lineHeight:"1.7",color:C.text}}>
              <div style={{fontWeight:700,color:C.pop,marginBottom:"6px"}}>{err==="parse"?"⚠️ Snippet not recognised":"⚠️ Authentication Failed"}</div>
              {err==="parse" ? (
                <div>Make sure you paste the <strong>complete output</strong> from the cipher generator, including ciphertext, account_id, and session_id lines.</div>
              ) : (
                <ol style={{marginLeft:"16px",display:"flex",flexDirection:"column",gap:"5px"}}>
                  <li>Go to <a href="https://bcmcp.freewheel.com/cipher" target="_blank" rel="noreferrer" style={{color:C.pop}}>https://bcmcp.freewheel.com/cipher</a></li>
                  <li>Click <strong>'Load server public key'</strong></li>
                  <li>Input your Beeswax credentials — email, password, and Buzz Key <strong>(dentsu)</strong></li>
                  <li>Click <strong>'Generate Ciphertext'</strong> then <strong>'Copy output'</strong></li>
                  <li>Paste that output <strong>EXACTLY</strong> into this window</li>
                </ol>
              )}
            </div>
          )}
          <button onClick={handleConnect} disabled={!snippet.trim()||loading}
            style={{background:snippet.trim()&&!loading?C.accent:C.subtle,color:snippet.trim()&&!loading?C.text:C.muted,border:"none",borderRadius:"8px",padding:"12px",fontSize:"13px",fontWeight:700,cursor:snippet.trim()&&!loading?"pointer":"default",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",fontFamily:FONT}}>
            {loading?(<><span style={{display:"inline-block",width:"14px",height:"14px",border:`2px solid ${C.teal}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/> Authenticating…</>):"Connect →"}
          </button>
        </div>
        <div style={{textAlign:"center",fontSize:"11px",color:C.muted}}>Your credentials are encrypted end-to-end and never stored.</div>
      </div>
    </div>
  );
}

// ── SHARED HEADER ──────────────────────────────────────────────────────────
function Header({ session, onMenu, onSignOut, showMenu }) {
  return (
    <div style={{padding:"13px 20px",borderBottom:`1px solid ${C.border}`,background:C.bg,display:"flex",alignItems:"center",gap:"12px",flexShrink:0}}>
      <MMIcon size={32}/>
      <span style={{fontSize:"11px",color:C.muted,letterSpacing:"0.04em"}}>Trading Copilot</span>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"}}>
        <div style={{width:"7px",height:"7px",borderRadius:"50%",background:C.green}}/>
        <span style={{fontSize:"11px",color:C.muted}}>Account {session.account_id}</span>
        {showMenu && <button onClick={onMenu} style={pillBtn(true)}>⬅ Menu</button>}
        <button onClick={onSignOut} style={pillBtn(false)}>Sign out</button>
      </div>
    </div>
  );
}

// ── WELCOME MENU ───────────────────────────────────────────────────────────
function WelcomeMenu({ session, onSelect, onSignOut }) {
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.text,fontFamily:FONT}}>
      <GlobalStyle/>
      <Header session={session} onMenu={null} onSignOut={onSignOut} showMenu={false}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"32px",padding:"32px 24px",animation:"fadein 0.4s ease"}}>
        <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"}}>
          <MMIcon size={64}/>
          <div style={{fontSize:"11px",color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>Trading Copilot · FreeWheel / Beeswax</div>
          <p style={{color:C.muted,fontSize:"13px",marginTop:"4px",maxWidth:"400px",lineHeight:"1.7"}}>
            Connected to account <strong style={{color:C.teal}}>{session.account_id}</strong>. Pick a quick action or open the copilot.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",width:"100%",maxWidth:"560px"}}>
          {SUGGESTED_PROMPTS.map((s,i)=>(
            <button key={i} onClick={()=>onSelect(s.prompt)}
              style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"16px",cursor:"pointer",textAlign:"left",color:C.text,transition:"all 0.18s",display:"flex",flexDirection:"column",gap:"6px",fontFamily:FONT}}
              onMouseOver={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background="#0d0d0d";}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.bgCard;}}>
              <span style={{fontSize:"20px"}}>{s.icon}</span>
              <span style={{fontWeight:700,color:s.color,fontSize:"12px"}}>{s.label}</span>
              <span style={{fontSize:"11px",color:C.muted,lineHeight:"1.5"}}>{s.prompt.slice(0,62)}…</span>
            </button>
          ))}
        </div>
        <button onClick={()=>onSelect("")}
          style={{background:C.accent,border:"none",borderRadius:"8px",padding:"11px 28px",color:C.text,fontSize:"13px",fontWeight:700,cursor:"pointer",fontFamily:FONT,transition:"opacity 0.15s"}}
          onMouseOver={e=>e.currentTarget.style.opacity="0.85"}
          onMouseOut={e=>e.currentTarget.style.opacity="1"}>
          Open Copilot Chat →
        </button>
      </div>
    </div>
  );
}

// ── FORMATTING ─────────────────────────────────────────────────────────────
function renderInline(text) {
  return text.split(/(\*\*.*?\*\*|`.*?`)/g).map((p,i)=>{
    if (p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:C.text,fontWeight:700}}>{p.slice(2,-2)}</strong>;
    if (p.startsWith("`")&&p.endsWith("`"))   return <code key={i} style={{background:"#1a1a1a",color:C.teal,padding:"1px 5px",borderRadius:"3px",fontSize:"12px",fontFamily:"monospace"}}>{p.slice(1,-1)}</code>;
    return p;
  });
}
function formatContent(text) {
  return text.split("\n").map((line,i)=>{
    if (line.startsWith("### ")) return <h3 key={i} style={{color:C.accent,margin:"12px 0 6px",fontSize:"13px",fontWeight:700}}>{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={i} style={{color:C.text,margin:"14px 0 8px",fontSize:"14px",fontWeight:700}}>{line.slice(3)}</h2>;
    if (line.startsWith("# "))  return <h1 key={i} style={{color:C.text,margin:"16px 0 10px",fontSize:"15px",fontWeight:700}}>{line.slice(2)}</h1>;
    if (line.startsWith("- ")||line.startsWith("* ")) return <div key={i} style={{display:"flex",gap:"8px",margin:"3px 0",paddingLeft:"8px"}}><span style={{color:C.accent,flexShrink:0}}>•</span><span>{renderInline(line.slice(2))}</span></div>;
    if (/^\d+\./.test(line)) { const m=line.match(/^(\d+)\.\s(.*)/); return m?<div key={i} style={{display:"flex",gap:"8px",margin:"3px 0",paddingLeft:"8px"}}><span style={{color:C.accent,fontWeight:700,flexShrink:0}}>{m[1]}.</span><span>{renderInline(m[2])}</span></div>:<p key={i}>{line}</p>; }
    if (line.startsWith("---")) return <hr key={i} style={{border:"none",borderTop:`1px solid ${C.border}`,margin:"12px 0"}}/>;
    if (line==="") return <div key={i} style={{height:"6px"}}/>;
    return <p key={i} style={{margin:"3px 0",lineHeight:"1.65"}}>{renderInline(line)}</p>;
  });
}

// ── CHAT ───────────────────────────────────────────────────────────────────
function Chat({ session, initialPrompt, onMenu, onSignOut }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef(null);
  const didInit   = useRef(false);

  useEffect(()=>{ if (initialPrompt&&!didInit.current){didInit.current=true;sendMessage(initialPrompt);} },[]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  const sendMessage = async (userText) => {
    if (!userText.trim()||loading) return;
    const userMsg    = { role:"user", content: userText.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory); setInput(""); setLoading(true);
    try {
      const suffix = `\n\nUser is already authenticated. account_id: ${session.account_id}${session.session_id?`, session_id: ${session.session_id}`:""}.  Do not ask for credentials.`;
      const txt = await callClaude(newHistory, suffix);
      setMessages(prev=>[...prev,{role:"assistant",content:txt}]);
    } catch(e) { setMessages(prev=>[...prev,{role:"assistant",content:`⚠️ Error: ${e.message}`}]); }
    finally    { setLoading(false); }
  };

  const handleKey  = (e)=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);} };
  const autoResize = (e)=>{ e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,160)+"px"; };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.text,fontFamily:FONT,fontSize:"13px"}}>
      <GlobalStyle/>
      <Header session={session} onMenu={onMenu} onSignOut={onSignOut} showMenu={true}/>
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
        {messages.length===0&&!loading&&(
          <div style={{textAlign:"center",color:C.muted,marginTop:"60px",fontSize:"13px",animation:"fadein 0.4s ease"}}>
            <div style={{fontSize:"24px",marginBottom:"10px"}}>📡</div>
            Ask anything about your campaigns, deals, or inventory…
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:"10px",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"fadein 0.25s ease"}}>
            {m.role==="assistant"&&(
              <div style={{width:"26px",height:"26px",borderRadius:"6px",flexShrink:0,marginTop:"2px",background:C.bgCard,padding:"4px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <MMIcon size={20}/>
              </div>
            )}
            <div style={{maxWidth:"82%",background:m.role==="user"?C.accent:C.bgCard,border:m.role==="assistant"?`1px solid ${C.border}`:"none",borderRadius:m.role==="user"?"14px 14px 4px 14px":"4px 14px 14px 14px",padding:"12px 14px",color:C.text,lineHeight:"1.65"}}>
              {m.role==="assistant"?formatContent(m.content):<p style={{margin:0}}>{m.content}</p>}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
            <div style={{width:"26px",height:"26px",borderRadius:"6px",flexShrink:0,background:C.bgCard,padding:"4px",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <MMIcon size={20}/>
            </div>
            <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:"4px 14px 14px 14px",padding:"12px 16px",display:"flex",gap:"5px",alignItems:"center"}}>
              {[0,1,2].map(j=><div key={j} style={{width:"6px",height:"6px",borderRadius:"50%",background:C.accent,animation:`pulse 1.2s ${j*0.2}s infinite`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"14px 20px",borderTop:`1px solid ${C.border}`,background:C.bg,flexShrink:0}}>
        <div style={{display:"flex",gap:"10px",alignItems:"flex-end",background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"10px 14px",transition:"border 0.15s"}}
          onFocusCapture={e=>e.currentTarget.style.borderColor=C.accent}
          onBlurCapture={e=>e.currentTarget.style.borderColor=C.border}>
          <textarea value={input} onChange={e=>{setInput(e.target.value);autoResize(e);}} onKeyDown={handleKey}
            placeholder="Ask about pacing, deals, performance, inventory…"
            rows={1}
            style={{flex:1,background:"transparent",border:"none",outline:"none",color:C.text,resize:"none",fontSize:"13px",lineHeight:"1.5",fontFamily:FONT,minHeight:"22px",maxHeight:"160px"}}/>
          <button onClick={()=>sendMessage(input)} disabled={!input.trim()||loading}
            style={{width:"32px",height:"32px",borderRadius:"8px",border:"none",background:input.trim()&&!loading?C.accent:C.subtle,color:C.text,cursor:input.trim()&&!loading?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0,transition:"background 0.15s"}}>↑</button>
        </div>
        <div style={{textAlign:"center",fontSize:"10px",color:C.muted,marginTop:"8px"}}>Shift+Enter for new line · Connected to FreeWheel / Beeswax MCP</div>
      </div>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]             = useState(null);
  const [view, setView]                   = useState("auth");
  const [initialPrompt, setInitialPrompt] = useState("");

  const handleAuth    = (s) => { setSession(s); setView("menu"); };
  const handleSelect  = (p) => { setInitialPrompt(p); setView("chat"); };
  const handleMenu    = ()  => { setInitialPrompt(""); setView("menu"); };
  const handleSignOut = ()  => { setSession(null); setView("auth"); };

  if (view==="auth") return <AuthGate onSuccess={handleAuth}/>;
  if (view==="menu") return <WelcomeMenu session={session} onSelect={handleSelect} onSignOut={handleSignOut}/>;
  return <Chat session={session} initialPrompt={initialPrompt} onMenu={handleMenu} onSignOut={handleSignOut}/>;
}