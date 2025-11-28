// HSAI — Router v8.2
// - PURE MATH MODE upgrade:
//   * Robust equation detection & solving (any single-letter variable; auto "=0" if missing)
//   * Graphing triggers broadened
//   * Built-in "Identités remarquables" & math rules
//   * Topic/Chapter explainers (derivatives, integrals, trig, exponent/log, sequences, vectors, complex)
// - Search/Conversation from v8.1 kept intact (RRF web search), instant replies (no spinner)

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM =====
  const sendButton    = document.getElementById("send-button");
  const inputField    = document.getElementById("text-input");
  const chatContainer = document.getElementById("chat-container");
  const greetingBlock = document.getElementById("greeting");
  const sourcesRow    = document.getElementById("sources");
  const btn1 = document.getElementById("button1");
  const btn2 = document.getElementById("button2");
  const btn3 = document.getElementById("button3");
  const mathToggleBtn = document.getElementById("math-toggle");
  const mathHost      = document.getElementById("hs-math-kb");

  // Mode switch elements (from your UI markup)
  const modeRoot   = document.getElementById("mode-switch");
  const modeBtn    = document.getElementById("mode-current");
  const modeMenu   = document.getElementById("mode-list");
  const modeOpts   = modeMenu ? Array.from(modeMenu.querySelectorAll(".mode-option")) : [];

  if (!sendButton || !inputField || !chatContainer) { console.error("Missing core DOM nodes."); return; }

  // ===== Config (search; unchanged from v8.1) =====
  const SEARCH_CONFIG = {
    useServerGoogle:  false,  // /api/search/google?q=...
    useServerBing:    false,  // /api/search/bing?q=...
    useServerBrave:   false,  // /api/search/brave?q=...
    useServerSerpAPI: false,  // /api/search/serpapi?q=...
    googleCSE: { enabled:false, key:"", cx:"" },
    wikiEnabled: true,
    ddgEnabled:  true,
    timeouts: { perRequest: 3000, group: 5000 },
    rrfK: 60,
    topN: 5
  };

  // ===== Greeting hide once chat starts =====
  let greetingHidden = false;
  function hideGreetingOnce() {
    if (greetingBlock && !greetingHidden) {
      greetingHidden = true;
      greetingBlock.style.transition = "opacity .35s ease, transform .35s ease";
      greetingBlock.style.opacity = "0";
      greetingBlock.style.transform = "translateY(-8px)";
      setTimeout(() => { greetingBlock.style.display = "none"; }, 380);
      const quick = document.getElementById("predefined-questions");
      if (quick) { quick.classList.add("fade-out"); setTimeout(() => { quick.classList.add("collapsed"); }, 360); }
    }
  }

  // ===== Templates =====
  const TEMPLATES = { greet: ["Hey 👋","Hi there!","Hello!","Yo!"] };

  // ===== Capital quick map (unchanged) =====
  const CAPITALS = {
    germany:"Berlin", france:"Paris", italy:"Rome", spain:"Madrid", portugal:"Lisbon",
    netherlands:"Amsterdam", belgium:"Brussels", switzerland:"Bern", austria:"Vienna",
    poland:"Warsaw", "czech republic":"Prague", czech:"Prague", slovakia:"Bratislava",
    hungary:"Budapest", romania:"Bucharest", bulgaria:"Sofia", greece:"Athens",
    uk:"London", "united kingdom":"London", ireland:"Dublin",
    usa:"Washington, D.C.", "united states":"Washington, D.C.", canada:"Ottawa",
    mexico:"Mexico City", brazil:"Brasília", argentina:"Buenos Aires", chile:"Santiago",
    peru:"Lima", colombia:"Bogotá", venezuela:"Caracas",
    russia:"Moscow", ukraine:"Kyiv", turkey:"Ankara", "saudi arabia":"Riyadh",
    uae:"Abu Dhabi", "united arab emirates":"Abu Dhabi", israel:"Jerusalem",
    egypt:"Cairo", "south africa":"Pretoria (exec.)", south_africa:"Pretoria (exec.)",
    india:"New Delhi", china:"Beijing", japan:"Tokyo", "south korea":"Seoul",
    australia:"Canberra", "new zealand":"Wellington", new_zealand:"Wellington"
  };

  // ===== Utils =====
  const Utils = {
    pick: a => a[Math.floor(Math.random()*a.length)],
    clean: s => String(s||"")
      .replace(/[“”]/g,'"').replace(/[‘’]/g,"'")
      .replace(/[\u200B-\u200D\uFEFF]/g,"")
      .replace(/[^\S\r\n]+/g," ").trim(),
    lc: s => String(s||"").toLowerCase(),
    tokenize: s => Utils.lc(s).replace(/[^\w.()+\-/*^=π]/g," ").split(/\s+/).filter(Boolean),
    stop: new Set(["the","is","are","and","or","a","an","in","on","for","to","of","by","with","at","about","please","pls","me","you","u","tell","what","who","where","when","how","why","that","this","these","those","from","into","it","its","as","be","was","were","do","does","did","up","down","over","under","my","your","their","our","his","her","than","then","so"]),
    keywords(toks){ return toks.filter(t => !Utils.stop.has(t)); },
    scrollBottom(){ chatContainer.scrollTop = chatContainer.scrollHeight; },
    cap: s => s.charAt(0).toUpperCase() + s.slice(1),
    titleCase: s => s.replace(/\b\w/g, c=>c.toUpperCase()),
    escapeHTML: str => String(str||"").replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
    stripTags: str => String(str||"").replace(/<[^>]*>/g,""),
    withTimeout(url, ms){
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal }).finally(()=>clearTimeout(t));
    },
    normalizeURL(u){
      try{
        const url = new URL(u);
        url.hash = "";
        if (url.hostname.startsWith("www.")) url.hostname = url.hostname.slice(4);
        return url.toString();
      }catch{ return u; }
    }
  };

  // ===== Chat helpers =====
  function bubble(html, who){
    const el = document.createElement("div");
    el.className = "message " + (who === "user" ? "user" : "ai");
    el.innerHTML = html;
    chatContainer.appendChild(el);
    Utils.scrollBottom();
    return el;
  }
  const say = t => bubble(t, "ai");

  // Welcome
  (function wish(){ const h=new Date().getHours(); say(h<12?"Good morning ☀️":h<18?"Good afternoon 🌤️":"Good evening 🌙"); })();

  if (btn1) btn1.onclick = () => submit("Capital of Germany");
  if (btn2) btn2.onclick = () => submit("Isaac Newton");
  if (btn3) btn3.onclick = () => submit("search Orcas");
  sendButton.addEventListener("click", () => submit());
  inputField.addEventListener("keypress", e => { if (e.key === "Enter") submit(); });

  // ===== Local conversation backend =====
  const Conversation = (() => {
    const SYS_PROMPT = "You are HSAI. Speak naturally, concise and friendly. Be rational and helpful.";
    async function askLocalAPI(prompt){
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ system: SYS_PROMPT, prompt })
      });
      if (!res.ok) throw new Error("local_api_error");
      const data = await res.json();
      return (data.reply || data.text || "").trim();
    }
    async function ask(prompt){
      try { return await Promise.race([askLocalAPI(prompt), new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), 1000))]); } catch(e){}
      return "I’m here. Tell me more.";
    }
    return { ask };
  })();

  // ===== Heuristics (unchanged) =====
  function isPlainGreeting(s){
    const t = Utils.lc(Utils.clean(s));
    const w = t.split(/\s+/);
    const GREET = ["hi","hey","hello","yo","sup","hola","bonjour","wassup","howdy"];
    return w.length<=3 && GREET.includes(w[0]) && !/\b(how|news|latest|headline)\b/.test(t);
  }
  function greetReply(){ return Utils.pick(["hey 👋 how’s it going?","hi! good to see you 🙂","hello! what’s up?","yo! ready when you are."]); }
  function isHowAreYouLike(s){ return /\b(how\s*are\s*(u|you)|you\s*are\s*how|how\s*r\s*u|hru|hry|hr)\b/i.test(s); }
  function isExplicitSearchStart(s){
    const t=Utils.lc(Utils.clean(s)); const first=(t.split(/\s+/)[0]||"");
    return /^(search|lookup|look\s*up|look\s*for|find)$/.test(first) && !/\b(time|date)\b/.test(t);
  }
  function extractExplicitQuery(s){ return s.replace(/^\s*(search|look\s*up|look\s*for|find)\b\s*/i, "").trim(); }

  // System triggers (unchanged in non-Math)
  function needsNewsQuery(s){ const t=Utils.lc(Utils.clean(s)); return t==="news" || /\b(news|headline|headlines|latest)\b/.test(t); }
  function isLocalTimeDateQuery(s){ return /\b(time|date|today|tomorrow|yesterday)\b/i.test(s) && !/[=]/.test(s); }
  function isWeatherQuery(s){ return /\b(weather|forecast|temperature|meteo|climate)\b/i.test(s); }
  function localTimeDateAnswer(){ const now=new Date(); return "It's " + now.toLocaleTimeString() + " on " + now.toLocaleDateString() + "."; }
  async function weatherPlaceholder(){ return "Weather lookup isn’t enabled here 🌦️."; }

  // ======== MATH MODE UPGRADE ========

  // --- Identity & rules KB ---
  const MATH_IDENTITIES = {
    "identites": [
      "<b>(a + b)² = a² + 2ab + b²</b>",
      "<b>(a - b)² = a² - 2ab + b²</b>",
      "<b>a² - b² = (a - b)(a + b)</b>",
      "<b>(a + b)³ = a³ + 3a²b + 3ab² + b³</b>",
      "<b>(a - b)³ = a³ - 3a²b + 3ab² - b³</b>",
      "<b>(a + b)(a² - ab + b²) = a³ + b³</b>",
      "<b>(a - b)(a² + ab + b²) = a³ - b³</b>"
    ],
    "log": [
      "<b>log(a·b) = log a + log b</b>",
      "<b>log(a/b) = log a − log b</b>",
      "<b>log(a^r) = r · log a</b>",
      "<b>Change of base:</b> log_b a = ln(a)/ln(b)"
    ],
    "exp": [
      "<b>a^m · a^n = a^{m+n}</b>",
      "<b>a^m / a^n = a^{m−n}</b>",
      "<b>(a^m)^n = a^{mn}</b>",
      "<b>a^0 = 1</b>, <b>a^{−n} = 1/a^n</b>"
    ],
    "trig": [
      "<b>sin²x + cos²x = 1</b>",
      "<b>1 + tan²x = sec²x</b>",
      "<b>sin(α±β) = sinα cosβ ± cosα sinβ</b>",
      "<b>cos(α±β) = cosα cosβ ∓ sinα sinβ</b>"
    ]
  };
  const MATH_CHAPTERS = {
    "derivatives": [
      "<b>Idea</b>: instantaneous rate of change; slope of tangent.",
      "<b>Rules</b>: (u+v)'=u'+v', (uv)'=u'v+uv', (u/v)'=(u'v-uv')/v²",
      "<b>Basics</b>: (x^n)'=n x^{n-1}, (e^x)'=e^x, (ln x)'=1/x",
      "<b>Trig</b>: (sin x)'=cos x, (cos x)'=−sin x, (tan x)'=sec² x"
    ],
    "integrals": [
      "<b>Idea</b>: area under curve; antiderivative.",
      "<b>Basics</b>: ∫x^n dx = x^{n+1}/(n+1)+C (n≠−1), ∫1/x dx = ln|x|+C",
      "<b>Exp/Trig</b>: ∫e^x dx = e^x + C, ∫sin x dx = −cos x + C, ∫cos x dx = sin x + C",
      "<b>FTC</b>: If F'=f, then ∫_a^b f(x)dx = F(b)−F(a)"
    ],
    "trigonometry": [
      "<b>Unit circle</b>, radian measure.",
      "<b>Identities</b>: sin²+cos²=1, addition formulas, double-angle.",
      "<b>Graphs</b>: sin/cos periodicity 2π; phase shift & amplitude."
    ],
    "exponentials": MATH_IDENTITIES.exp,
    "logarithms":  MATH_IDENTITIES.log,
    "sequences": [
      "<b>Arithmetic</b>: u_n = u_0 + n·r; sum_n = n/2·(2u_0 + (n−1)r)",
      "<b>Geometric</b>: u_n = u_0 · q^n; sum_n = u_0·(1−q^{n+1})/(1−q) (q≠1)"
    ],
    "vectors": [
      "<b>Dot product</b>: a·b = |a||b|cosθ = axbx + ayby (+ azbz)",
      "<b>Projection</b>, orthogonality (a·b=0).",
      "<b>Equation of a line</b> via point+direction; plane via normal."
    ],
    "complex": [
      "<b>i² = −1</b>",
      "<b>z = x + i y</b>, conjugate z̄ = x − i y, |z| = √(x²+y²)",
      "<b>Euler</b>: e^{iθ} = cosθ + i sinθ"
    ]
  };

  // --- Math parsing helpers ---
  function detectVariableName(s){
    // Pick the first single-letter variable present (prefer x), else return 'x'
    const vars = new Set((s.match(/[a-wyzA-WYZ]/g) || []).map(ch => ch.toLowerCase()));
    if (vars.has('x')) return 'x';
    if (vars.size) return [...vars][0];
    return 'x';
  }
  function normalizeVariableToX(s){
    const v = detectVariableName(s);
    if (v === 'x') return { text: s, varName: 'x' };
    // Replace occurrences of that variable as a standalone symbol with x
    const re = new RegExp(`\\b${v}\\b`, 'gi');
    return { text: s.replace(re, 'x'), varName: v };
  }

  function looksLikeEquation(s){
    const t = Utils.lc(s);
    if (/[=]/.test(t)) return true;
    if (/\b(solve|root|roots|zero|zeros|solutions?|where|intersect|intersection)\b/.test(t)) return true;
    // “x^2-5x+6”, “2x+3= ” (space), etc.
    if (/[a-z]\s*[\^\*\/\+\-]|[\+\-]\s*\d/.test(t) && /[a-z]/i.test(t)) return true;
    return false;
  }
  function needsGraph(s){
    const t = Utils.lc(s);
    if (/\b(graph|plot|draw)\b/.test(t)) return true;
    if (/y\s*=/.test(t) || /f\s*\(\s*x\s*\)\s*=/.test(t)) return true;
    // “graph sin x”
    if (/\b(sin|cos|tan|exp|ln|log|sqrt)\b/.test(t) && /x/.test(t)) return true;
    return false;
  }
  function asksIdentities(s){
    return /\b(identit[eé]s?|identities|remarkables?|identit[eé]s\s+remarquables?|formulas?|rules)\b/i.test(s);
  }
  function asksChapter(s){
    return /\b(chapter|explain|course|lesson|overview|revision|revise|recap|rules\s+of|basics\s+of)\b/i.test(s);
  }

  // --- Math engine (evaluation/solve/graph from v8.1; extended detection) ---
  function addMathPrefix(expr, name){ const re=new RegExp("(^|[^.])"+name+"\\(","gi"); return expr.replace(re,(_,p1)=>p1+"Math."+name+"("); }
  function stdExpr(expr){
    let s=String(expr||"");
    s=s.replace(/\^/g,"**").replace(/π/gi,"Math.PI").replace(/\bpi\b/gi,"Math.PI").replace(/\be\b/g,"Math.E");
    const funcs=["sin","cos","tan","asin","acos","atan","sqrt","ln","log10","log","abs","exp"];
    for (let i=0;i<funcs.length;i++){ const nm=funcs[i]==="ln"?"log":funcs[i]; s=addMathPrefix(s,nm); }
    s=s.replace(/(\d)(x)/gi,"$1*$2").replace(/(x)\s*\(/gi,"$1*(").replace(/\)\s*(x)/gi,")*$1").replace(/(\d)\s*\(/g,"$1*(").replace(/\)\s*\(/g,")*(");
    return s;
  }
  function keepMath(str){
    return String(str||"")
      .replace(/\b(?!sin|cos|tan|sqrt|ln|log|log10|exp|pi|π|x)([a-z]+)\b/gi, " ")
      .replace(/[^\dA-Za-z+\-*/^().= π]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function doCalc(input){
    let expr=input.replace(/^(calc(ulate)?|what\s*is|evaluate|compute)\s*/i,"").trim(); if(!expr) expr=input;
    expr=keepMath(expr);
    try{
      const code=stdExpr(expr);
      const val=Function("x","with(Math){return ("+code+");}")(0);
      if (typeof val==="number" && isFinite(val)) return "= <b>"+(+val.toFixed(10))+"</b>";
      return "That doesn’t look like a numeric expression.";
    }catch(e){ return "Couldn’t evaluate that expression."; }
  }

  function forceEqZeroIfMissing(raw){
    if (/[=]/.test(raw)) return raw;
    return raw.replace(/^\s*(solve|find|roots?\b|zeros?\b|where)\s*/i,"").trim() + " = 0";
  }

  function doSolveFromRawFlexible(input){
    // normalize variable to x; add "=0" if absent
    const { text, varName } = normalizeVariableToX(input);
    let s = Utils.clean(forceEqZeroIfMissing(text)).replace(/:/g,"=").replace(/\s+/g," ");
    if (!/=/.test(s)) return "Say it like: <code>solve 2x+4=0</code> or <code>x^2=9</code>.";
    // keep only math-ish tokens (but keep x)
    const keep = s.replace(/\b(?!sin|cos|tan|sqrt|ln|log|log10|exp|pi|π|x)([a-wyz]+)\b/gi, " "); // drop vars other than x
    const t = keepMath(keep);
    const idx = t.lastIndexOf("="); if (idx < 1 || idx >= t.length-1) return "I couldn’t see an equation.";
    const L = t.slice(0, idx).trim();
    const R = t.slice(idx+1).trim();

    // numeric root find
    let g;
    try{
      const fL = new Function("x","with(Math){return (" + stdExpr(L) + ");}");
      const fR = new Function("x","with(Math){return (" + stdExpr(R) + ");}");
      g = function(x){ const v = fL(x) - fR(x); return isFinite(v) ? v : NaN; };
      g(0);
    }catch(e){ return "Parse error. Check syntax."; }

    const roots = [], seen = [];
    const XMIN=-100, XMAX=100, STEPS=2000;
    let prevX = XMIN, prevY = g(prevX);
    for (let i=1;i<=STEPS;i++){
      const x = XMIN + (i*(XMAX-XMIN))/STEPS;
      const y = g(x);
      if (isFinite(prevY) && isFinite(y) && prevY*y <= 0){
        const r = (function bisect(fn,a,b){
          let fa=fn(a), fb=fn(b);
          if (!isFinite(fa) || !isFinite(fb) || fa*fb>0) return null;
          if (fa===0) return a; if (fb===0) return b;
          for (let k=0;k<70;k++){
            const m=(a+b)/2, fm=fn(m);
            if (!isFinite(fm)) return null;
            if (Math.abs(fm)<1e-12) return m;
            if (fa*fm<=0){ b=m; fb=fm; } else { a=m; fa=fm; }
          }
          return (a+b)/2;
        })(g, prevX, x);
        if (r!=null && isFinite(r) && !seen.some(v=>Math.abs(v-r)<1e-7)){ seen.push(r); roots.push(r); }
      }
      prevX = x; prevY = y;
    }
    if (!roots.length) return `No real roots found (in −100..100). Try a different interval or check syntax.`;
    const rootLines = roots.map(r => `${varName} ≈ <b>${Number(r.toFixed(6))}</b>`).join("<br>");
    return rootLines;
  }

  function expandIdentityIfRecognized(s){
    // Simple patterns for classic ones
    const t = s.replace(/\s+/g,'').toLowerCase();
    // (a+b)^2 style (works for any symbolic A and B letters)
    let m = t.match(/^\(?([a-z])\+([a-z])\)?\^2$/i);
    if (m) return `${m[1]}² + 2${m[1]}${m[2]} + ${m[2]}²`;
    m = t.match(/^\(?([a-z])\-([a-z])\)?\^2$/i);
    if (m) return `${m[1]}² - 2${m[1]}${m[2]} + ${m[2]}²`;
    m = t.match(/^\(?([a-z])\+([a-z])\)?\(\1\-?\2\)$/i); // (a+b)(a-b)
    if (m) return `${m[1]}² - ${m[2]}²`;
    return null;
  }

  // Graphing (same engine as v8.1)
  function extractFunctionSpec(text){
    const t=text.replace(/plot|graph|draw/ig,"");
    let m=t.match(/y\s*=\s*([^,;]+)/i)||t.match(/f\s*\(\s*x\s*\)\s*=\s*([^,;]+)/i);
    if (m) return { expr:m[1].trim() };
    if (/[x]/i.test(t) && /(sin|cos|tan|sqrt|ln|log|exp|\^|x[)\s])/i.test(t)) return { expr:t.trim() };
    return null;
  }
  function createGraphContainer(){
    const wrap=document.createElement("div"); wrap.className="message ai graph-wrap";
    const canvas=document.createElement("canvas"); canvas.className="graph-canvas";
    const tip=document.createElement("div"); tip.className="graph-tooltip"; tip.style.display="none";
    wrap.appendChild(canvas); wrap.appendChild(tip); chatContainer.appendChild(wrap); Utils.scrollBottom();
    return {wrap, canvas, tip};
  }
  function graphFunction(text){
    const spec=extractFunctionSpec(text);
    if (!spec){ say("I couldn’t parse that as a function of x."); return; }
    const exprCode=stdExpr(spec.expr); let f;
    try{ f=new Function("x","with(Math){ return ("+exprCode+"); }"); f(0); }
    catch(e){ say("Function invalid. Try <code>y=2x+1</code> or <code>y=sin(x)</code>."); return; }
    const gc=createGraphContainer(); const canvas=gc.canvas, tip=gc.tip;
    const ctx=canvas.getContext("2d",{alpha:false, desynchronized:true});
    const st={ scaleX:70, scaleY:70, originX:0, originY:0, width:0, height:0, dpr:1, dragging:false, mouse:{x:null,y:null} };
    const ro=new ResizeObserver(resize); ro.observe(canvas);
    function resize(){
      const rect=canvas.getBoundingClientRect(); const dpr=window.devicePixelRatio||1;
      st.dpr=dpr; canvas.width=Math.max(320,Math.floor(rect.width*dpr)); canvas.height=Math.max(220,Math.floor(rect.height*dpr));
      st.width=rect.width; st.height=rect.height; ctx.setTransform(dpr,0,0,dpr,0,0);
      if (st.originX===0&&st.originY===0){ st.originX=st.width/2; st.originY=st.height/2; } render();
    }
    function w2s(x,y){ return { x: st.originX + x*st.scaleX, y: st.originY - y*st.scaleY }; }
    function s2w(px,py){ return { x: (px - st.originX)/st.scaleX, y: (st.originY - py)/st.scaleY }; }
    function grid(){
      const W=st.width, H=st.height, scaleX=st.scaleX, scaleY=st.scaleY, originX=st.originX, originY=st.originY;
      ctx.clearRect(0,0,W,H); ctx.fillStyle="#151515"; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(255,255,255,0.08)"; ctx.lineWidth=1;
      let xs=originX%scaleX; if (xs<0) xs+=scaleX; for (let x=xs;x<=W;x+=scaleX){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      let ys=originY%scaleY; if (ys<0) ys+=scaleY; for (let y=ys;y<=H;y+=scaleY){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      ctx.strokeStyle="rgba(79,195,247,.95)"; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(0,originY); ctx.lineTo(W,originY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(originX,0); ctx.lineTo(originX,H); ctx.stroke();
      ctx.fillStyle="rgba(200,230,255,.7)"; ctx.font="12px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign="center"; ctx.textBaseline="top";
      for (let x=originX%scaleX; x<=W; x+=scaleX){ const wx=((x-originX)/scaleX).toFixed(0); if (wx==="0") continue; ctx.fillText(wx, x, originY+4); }
      ctx.textAlign="right"; ctx.textBaseline="middle";
      for (let y=originY%scaleY; y<=H; y+=scaleY){ const wy=((originY-y)/scaleY).toFixed(0); if (wy==="0") continue; ctx.fillText(wy, originX-4, y); }
    }
    function plot(){
      const W=st.width, samples=Math.max(300,Math.floor(W)), dx=W/samples, YMAX=1e6;
      ctx.save(); ctx.lineWidth=2; ctx.strokeStyle="rgba(79,195,247,1)"; ctx.beginPath(); let prev=null;
      for (let i=0;i<=samples;i++){
        const sx=i*dx; const w=s2w(sx,0); let y; try{ y=f(w.x); }catch(e){ y=NaN; }
        if (!isFinite(y)||Math.abs(y)>YMAX){ prev=null; continue; }
        const sy=w2s(0,y).y;
        if (prev&&(Math.abs(sy-prev.sy)>200||Math.abs(y-prev.y)>5)){ ctx.stroke(); ctx.beginPath(); prev=null; }
        if (!prev) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy); prev={sy,y};
      }
      ctx.stroke(); ctx.restore();
    }
    function cross(){
      if (st.mouse.x==null) return;
      const W=st.width,H=st.height; ctx.save(); ctx.lineWidth=1; ctx.strokeStyle="rgba(255,255,255,.25)"; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(st.mouse.x,0); ctx.lineTo(st.mouse.x,H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,st.mouse.y); ctx.lineTo(W,st.mouse.y); ctx.stroke(); ctx.restore();
    }
    function render(){ grid(); plot(); cross(); }
    canvas.style.cursor="crosshair";
    canvas.addEventListener("mousemove", e => {
      const rect=canvas.getBoundingClientRect(); st.mouse.x=e.clientX-rect.left; st.mouse.y=e.clientY-rect.top;
      const p=s2w(st.mouse.x,st.mouse.y); let yVal; try{ yVal=f(p.x); }catch(e){ yVal=NaN; }
      if (isFinite(yVal)){ tip.style.display="block"; tip.textContent="x: "+p.x.toFixed(3)+"  y: "+yVal.toFixed(3);
        tip.style.left=(st.mouse.x+12)+"px"; tip.style.top=(st.mouse.y+12)+"px"; } else { tip.style.display="none"; }
      if (st.dragging){ st.originX+=e.movementX; st.originY+=e.movementY; }
      requestAnimationFrame(render);
    });
    canvas.addEventListener("mouseleave", ()=>{ st.mouse.x=null; st.mouse.y=null; tip.style.display="none"; requestAnimationFrame(render); });
    canvas.addEventListener("mousedown", ()=>{ st.dragging=true; });
    window.addEventListener("mouseup", ()=>{ st.dragging=false; });
    canvas.addEventListener("wheel", e=>{
      e.preventDefault();
      const factor=e.deltaY<0?1.1:0.9;
      const mx=st.mouse.x!=null?st.mouse.x:st.width/2, my=st.mouse.y!=null?st.mouse.y:st.height/2;
      const before=s2w(mx,my);
      st.scaleX=Math.min(300,Math.max(10,st.scaleX*factor));
      st.scaleY=Math.min(300,Math.max(10,st.scaleY*factor));
      const after=s2w(mx,my);
      st.originX+=(after.x-before.x)*st.scaleX; st.originY-=(after.y-before.y)*st.scaleY;
      requestAnimationFrame(render);
    }, {passive:false});
    resize();
    say("Here’s an interactive plot of <code>y = "+spec.expr+"</code>.");
  }
  const doGraph = input => { graphFunction(input); return "Plotting…"; };

  // ===== Search providers (same as v8.1) =====
  async function provider_wikipedia(q){
    const enc = encodeURIComponent(q);
    const url1 = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*&titles=${enc}`;
    try{
      const r1 = await Utils.withTimeout(url1, SEARCH_CONFIG.timeouts.perRequest);
      if (r1.ok) {
        const j = await r1.json();
        if (j?.query?.pages) {
          const pages = j.query.pages;
          const firstKey = Object.keys(pages)[0];
          if (firstKey && pages[firstKey]) {
            const page = pages[firstKey];
            const extract = (page.extract || "").trim();
            if (extract) {
              const title = page.title || q;
              const link = `https://en.wikipedia.org/?curid=${page.pageid}`;
              return [{ title, url: link, snippet: extract, source: "Wikipedia" }];
            }
          }
        }
      }
    }catch{}
    try{
      const url2 = `https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`;
      const r2 = await Utils.withTimeout(url2, SEARCH_CONFIG.timeouts.perRequest);
      if (r2.ok) {
        const j2 = await r2.json();
        const extract = (j2 && j2.extract) ? Utils.stripTags(j2.extract).trim() : "";
        if (extract) {
          const title = j2.title || q;
          const link = (j2.content_urls?.desktop?.page) || `https://en.wikipedia.org/wiki/${enc}`;
          return [{ title, url: link, snippet: extract, source: "Wikipedia" }];
        }
      }
    }catch{}
    return [];
  }
  async function provider_duckduckgo(q){
    const enc = encodeURIComponent(q);
    const url = `https://api.duckduckgo.com/?q=${enc}&format=json&no_html=1&skip_disambig=1&kl=us-en`;
    try{
      const r = await Utils.withTimeout(url, SEARCH_CONFIG.timeouts.perRequest);
      if (!r.ok) return [];
      const j = await r.json();
      const out=[];
      if (j.AbstractText && j.AbstractURL){
        out.push({ title: j.Heading || q, url: j.AbstractURL, snippet: j.AbstractText, source: "DuckDuckGo" });
      }
      if (Array.isArray(j.RelatedTopics)){
        for (const t of j.RelatedTopics){
          if (t?.Text && t?.FirstURL){
            out.push({ title: t.Text.split(" - ")[0], url: t.FirstURL, snippet: t.Text, source: "DuckDuckGo" });
          }
          if (t?.Topics){
            for (const u of t.Topics){
              if (u?.Text && u?.FirstURL){
                out.push({ title: u.Text.split(" - ")[0], url: u.FirstURL, snippet: u.Text, source: "DuckDuckGo" });
              }
            }
          }
        }
      }
      return out.slice(0,8);
    }catch{ return []; }
  }
  async function provider_google_cse(q){
    const cfg = SEARCH_CONFIG.googleCSE;
    if (!cfg.enabled || !cfg.key || !cfg.cx) return [];
    const enc = encodeURIComponent(q);
    const url = `https://www.googleapis.com/customsearch/v1?q=${enc}&key=${cfg.key}&cx=${cfg.cx}`;
    try{
      const r = await Utils.withTimeout(url, SEARCH_CONFIG.timeouts.perRequest);
      if (!r.ok) return [];
      const j = await r.json();
      if (!Array.isArray(j.items)) return [];
      return j.items.slice(0,10).map(it => ({
        title: it.title,
        url: it.link,
        snippet: Utils.stripTags((it.snippet || it.htmlSnippet || "").replace(/\s+/g," ").trim()),
        source: "Google"
      }));
    }catch{ return []; }
  }
  async function provider_server(path, q, label){
    try{
      const r = await Utils.withTimeout(`${path}?q=${encodeURIComponent(q)}`, SEARCH_CONFIG.timeouts.perRequest);
      if (!r.ok) return [];
      const j = await r.json();
      if (Array.isArray(j.results)) return j.results.map(x => ({
        title: x.title, url: x.url, snippet: x.snippet || "", source: label
      }));
      return [];
    }catch{ return []; }
  }
  function rrfMerge(resultsByEngine){
    const k = SEARCH_CONFIG.rrfK;
    const scores = new Map(); const best = new Map();
    for (const [engine, list] of Object.entries(resultsByEngine)) {
      const seen = new Set();
      (list || []).forEach((item, idx) => {
        const norm = Utils.normalizeURL(item.url || ""); if (!norm || seen.has(norm)) return;
        seen.add(norm);
        const contrib = 1 / (k + idx + 1);
        scores.set(norm, (scores.get(norm) || 0) + contrib);
        if (!best.has(norm)) best.set(norm, { ...item, engineHint: engine });
      });
    }
    return Array.from(scores.entries()).sort((a,b)=>b[1]-a[1]).map(([norm]) => best.get(norm));
  }
  async function webSearchRanked(query){
    const tasks = [];
    if (SEARCH_CONFIG.useServerGoogle)  tasks.push(provider_server("/api/search/google", query, "Google"));
    if (SEARCH_CONFIG.useServerBing)    tasks.push(provider_server("/api/search/bing",   query, "Bing"));
    if (SEARCH_CONFIG.useServerBrave)   tasks.push(provider_server("/api/search/brave",  query, "Brave"));
    if (SEARCH_CONFIG.useServerSerpAPI) tasks.push(provider_server("/api/search/serpapi",query, "Google (SerpAPI)"));
    tasks.push(provider_google_cse(query));
    tasks.push(provider_wikipedia(query));
    tasks.push(provider_duckduckgo(query));

    let settled = [];
    try {
      const all = await Promise.race([
        Promise.all(tasks.map(p => p.catch(()=>[]))),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("group_timeout")), SEARCH_CONFIG.timeouts.group))
      ]);
      settled = all;
    } catch {
      const [w, d] = await Promise.all([ provider_wikipedia(query).catch(()=>[]), provider_duckduckgo(query).catch(()=>[]) ]);
      settled = [w, d];
    }
    const engines = {};
    const labels = [];
    if (SEARCH_CONFIG.useServerGoogle)  labels.push("Google");
    if (SEARCH_CONFIG.useServerBing)    labels.push("Bing");
    if (SEARCH_CONFIG.useServerBrave)   labels.push("Brave");
    if (SEARCH_CONFIG.useServerSerpAPI) labels.push("Google (SerpAPI)");
    labels.push("GoogleCSE","Wikipedia","DuckDuckGo");
    settled.forEach((arr, i) => { engines[labels[i] || ("E"+i)] = arr || []; });

    let merged = rrfMerge(engines).slice(0, Math.max(SEARCH_CONFIG.topN, 3));
    if (!merged.length) {
      const wikiOnly = await provider_wikipedia(query);
      if (wikiOnly.length) merged = wikiOnly;
    }
    return merged;
  }
  function renderSourcesChips(list){
    if (!sourcesRow) return;
    sourcesRow.innerHTML = "";
    if (!list || !list.length) return;
    list.forEach(({title, url, source}) => {
      const a = document.createElement("a");
      a.className = "source-chip";
      a.href = url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = (source ? source + ": " : "") + (title || url.replace(/^https?:\/\//,""));
      sourcesRow.appendChild(a);
    });
  }
  function clearSources(){ if (sourcesRow) sourcesRow.innerHTML = ""; }
  function summarizeResults(query, ranked){
    const bullets = []; const chips = []; let lead = "";
    for (const item of ranked){
      if (!item || !item.url) continue;
      chips.push({ title: item.title, url: item.url, source: item.source || item.engineHint || "Web" });
      if (!lead && item.source === "Wikipedia" && item.snippet) lead = item.snippet.trim();
    }
    const pool = ranked.map(r => (r.snippet || "").replace(/\s+/g," ").trim()).filter(Boolean);
    const seen = new Set();
    for (const s of pool){
      const frag = s.length > 220 ? s.slice(0, 210).trim() + "…" : s;
      if (!seen.has(frag)) { bullets.push("• " + Utils.escapeHTML(frag)); seen.add(frag); }
      if (bullets.length >= 5) break;
    }
    const leadHtml = lead ? `<div style="margin-bottom:6px">${Utils.escapeHTML(lead)}</div>` : "";
    const listHtml = bullets.length ? `<div>${bullets.join("<br>")}</div>` : "<div>No clean summary available.</div>";
    renderSourcesChips(chips);
    return `<div><b>Summary:</b></div>${leadHtml}${listHtml}`;
  }

  // ===== Capital quick answer (unchanged) =====
  async function tryCapitalAnswer(cleaned){
    const t = Utils.lc(cleaned);
    const m = t.match(/capital\s+of\s+(.+?)$/i) || t.match(/^capital\s+(.+?)$/i);
    if (!m) return null;
    const country = m[1].replace(/[^\w\s-]/g,'').trim();
    const key = Utils.lc(country).replace(/\s+/g, "_");
    const val = CAPITALS[key] || CAPITALS[country] || null;
    if (!val) return null;
    clearSources();
    return "The capital of " + Utils.cap(country) + " is <b>" + Utils.escapeHTML(val) + "</b>.";
  }

  // ===== Router =====
  const MODE_META = {
    search: { label: 'Search',        placeholder: 'Type anything to fetch & summarize…' },
    conversation: { label: 'Conversation', placeholder: 'Chat naturally…' },
    math: { label: 'Math',            placeholder: 'Ask to solve/graph/explain… e.g., “solve x^2-5x+6”, “graph y=sin x”' },
  };
  let CURRENT_MODE = (modeBtn?.dataset?.mode) || 'search';
  function applyMode(mode, { persist=true, announce=true }={}) {
    if (!MODE_META[mode]) mode='search';
    CURRENT_MODE=mode;
    const labelSpan=modeBtn?.querySelector('.mode-label'); if (labelSpan) labelSpan.textContent = MODE_META[mode].label;
    if (modeBtn) modeBtn.dataset.mode=mode;
    modeOpts.forEach(li => li.setAttribute('aria-selected', String(li.dataset.mode===mode)));
    if (inputField) inputField.placeholder = MODE_META[mode].placeholder;
    if (persist) localStorage.setItem('hs_mode', mode);
    if (announce) window.dispatchEvent(new CustomEvent('rtra:modechange', { detail:{mode} }));
  }
  const storedMode = localStorage.getItem('hs_mode');
  if (storedMode && MODE_META[storedMode]) applyMode(storedMode, { persist:false, announce:false });
  else applyMode(CURRENT_MODE, { persist:false, announce:false });

  function openMenu(){ if (modeBtn) modeBtn.setAttribute('aria-expanded','true'); modeRoot && modeRoot.classList.add('open'); }
  function closeMenu(){ if (modeBtn) modeBtn.setAttribute('aria-expanded','false'); modeRoot && modeRoot.classList.remove('open'); }
  if (modeBtn && modeRoot && modeMenu) {
    modeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); const ex=modeBtn.getAttribute('aria-expanded')==='true'; ex?closeMenu():openMenu(); });
    modeBtn.addEventListener('keydown', (e)=>{
      if (e.key==='Enter' || e.key===' ') { e.preventDefault(); const ex=modeBtn.getAttribute('aria-expanded')==='true'; ex?closeMenu():openMenu(); }
      if (e.key==='Escape') { e.preventDefault(); closeMenu(); }
      if (e.key==='ArrowDown' || e.key==='ArrowUp') {
        e.preventDefault(); openMenu(); const sel=modeOpts.findIndex(li=>li.getAttribute('aria-selected')==='true'); const idx=Math.max(0,sel); modeOpts[idx]?.focus();
      }
    });
    modeOpts.forEach(li=>{
      li.tabIndex=0;
      li.addEventListener('click', (e)=>{ e.stopPropagation(); const m=li.dataset.mode; applyMode(m); closeMenu(); });
      li.addEventListener('keydown', (e)=>{
        if (e.key==='Enter' || e.key===' ') { e.preventDefault(); li.click(); }
        if (e.key==='Escape') { e.preventDefault(); closeMenu(); modeBtn.focus({preventScroll:true}); }
        if (e.key==='ArrowDown' || e.key==='ArrowUp') {
          e.preventDefault(); const i=modeOpts.indexOf(li);
          const next = e.key==='ArrowDown' ? (i+1)%modeOpts.length : (i-1+modeOpts.length)%modeOpts.length;
          modeOpts[next]?.focus();
        }
      });
    });
    document.addEventListener('click', (e)=>{ if (!modeRoot.contains(e.target)) closeMenu(); });
    window.addEventListener('blur', ()=> closeMenu());
    window.addEventListener('rtra:setmode', (e)=>{ if (e?.detail?.mode) applyMode(e.detail.mode); });
  }

  // ===== MAIN ROUTER =====
  async function routeAndAnswer(raw){
    const cleaned = Utils.clean(raw);
    const lower = Utils.lc(cleaned);

    // system
    if (isLocalTimeDateQuery(lower)) { clearSources(); return localTimeDateAnswer(); }
    if (isWeatherQuery(lower))      { clearSources(); return await weatherPlaceholder(); }

    // greetings
    if (isPlainGreeting(lower))     { clearSources(); return greetReply(); }
    if (isHowAreYouLike(lower))     { clearSources(); return "doing great 🙂 what do you need?"; }

    // === MATH MODE (PURE) ===
    if (CURRENT_MODE === 'math') {
      clearSources();

      // 1) Identities or rules?
      if (asksIdentities(cleaned)) {
        const blocks = [
          "<b>Identités remarquables</b>",
          ...MATH_IDENTITIES.identites,
          "<br><b>Exponent rules</b>",
          ...MATH_IDENTITIES.exp,
          "<br><b>Logarithm rules</b>",
          ...MATH_IDENTITIES.log,
          "<br><b>Trig identities</b>",
          ...MATH_IDENTITIES.trig
        ];
        return blocks.join("<br>");
      }

      // 2) Chapter/topic explanations?
      if (asksChapter(cleaned)) {
        const t = lower;
        const key =
          (/\bderiv/i.test(t) && "derivatives") ||
          (/\bintegr/i.test(t) && "integrals") ||
          (/\btrig|trigon/i.test(t) && "trigonometry") ||
          (/\bexponen/i.test(t) && "exponentials") ||
          (/\blog/i.test(t) && "logarithms") ||
          (/\bsequence|series/i.test(t) && "sequences") ||
          (/\bvector/i.test(t) && "vectors") ||
          (/\bcomplex|imaginary/i.test(t) && "complex") ||
          null;
        if (key && MATH_CHAPTERS[key]) {
          return `<div><b>${Utils.titleCase(key)}</b></div>` + MATH_CHAPTERS[key].map(s=>"<div>"+s+"</div>").join("");
        }
        // generic help
        return "Tell me the chapter, e.g., <code>explain derivatives</code>, <code>chapter: trigonometry</code>, <code>rules of logarithms</code>.";
      }

      // 3) Graphs?
      if (needsGraph(cleaned) || extractFunctionSpec(cleaned)) {
        doGraph(cleaned);
        return "Plotting…";
      }

      // 4) Symbolic quick expansion if they wrote an identity like (a+b)^2
      const exp = expandIdentityIfRecognized(cleaned);
      if (exp) return `<b>Expansion:</b> ${exp}`;

      // 5) Equations/roots/zeros (broad detection)
      if (looksLikeEquation(cleaned)) {
        return doSolveFromRawFlexible(cleaned);
      }

      // 6) Plain calculation?
      if (/[\dπpix]\s*[\+\-\*\/\^]/i.test(lower) || /^\s*(calc|evaluate|compute|what\s*is)\b/i.test(lower) || /^\d+(\.\d+)?$/.test(lower)) {
        try { return doCalc(cleaned); } catch(e){}
      }

      // 7) If it looks like a statement about math (contains x and operators), try solve anyway
      if (/[a-z].*[\+\-\*\/\^=]/i.test(cleaned)) {
        return doSolveFromRawFlexible(cleaned);
      }

      // default math help
      return "Math mode ready. Try: <code>solve x^2-5x+6</code>, <code>x^2=9</code>, <code>graph y=sin x</code>, <code>identités remarquables</code>, or <code>explain derivatives</code>.";
    }

    // === CONVERSATION MODE ===
    if (CURRENT_MODE === 'conversation') {
      const capOnly = await tryCapitalAnswer(cleaned);
      if (capOnly) return capOnly;
      if (isExplicitSearchStart(lower)) {
        const q = extractExplicitQuery(raw) || cleaned;
        const ranked = await webSearchRanked(q);
        if (ranked.length) return summarizeResults(q, ranked);
        clearSources();
        return await Conversation.ask(cleaned);
      }
      clearSources();
      return await Conversation.ask(cleaned);
    }

    // === SEARCH MODE (always web) ===
    {
      const capOnly = await tryCapitalAnswer(cleaned);
      if (capOnly) return capOnly;

      const topics = (function extractTopics(raw){
        if (isExplicitSearchStart(raw)) return [extractExplicitQuery(raw)];
        const text = Utils.clean(raw).replace(/[#@][\w-]+/g," ").replace(/[^\w\s'.-]/g," ");
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length <= 3) return [text];
        const caps=[]; let buf=[];
        for (const w of words){
          if (/^[A-Z][a-zA-Z'.-]*$/.test(w)) buf.push(w);
          else { if (buf.length){ caps.push(buf.join(" ")); buf=[]; } }
        }
        if (buf.length) caps.push(buf.join(" "));
        const toks = Utils.keywords(Utils.tokenize(text)).filter(t=>t.length>=3 && !/^\d+$/.test(t));
        const scores=new Map();
        for (const t of toks) scores.set(t,(scores.get(t)||0)+1);
        for (const c of caps) scores.set(Utils.lc(c),(scores.get(Utils.lc(c))||0)+2);
        const ranked = Array.from(scores.entries()).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
        const topics = [...new Set([...caps.map(Utils.lc), ...ranked])];
        const pretty = topics.slice(0,3).map(t=> caps.find(c=>Utils.lc(c)===t) || t);
        return pretty.length?pretty:[text];
      })(cleaned).slice(0,3);

      const sections = [];
      for (const t of topics){
        const ranked = await webSearchRanked(t);
        if (ranked.length){
          sections.push(`<div style="margin-bottom:6px"><b>${Utils.escapeHTML(Utils.titleCase(t))}</b></div>${summarizeResults(t, ranked)}`);
        } else {
          sections.push(`<div><b>${Utils.escapeHTML(Utils.titleCase(t))}</b> — No results found.</div>`);
        }
      }
      if (sections.length){
        return sections.join("<hr style='border:0;border-top:1px solid rgba(255,255,255,.12);margin:10px 0'>");
      }
      clearSources();
      return await Conversation.ask(cleaned);
    }
  }

  // ===== Submit (instant) =====
  async function submit(text){
    const userInput = (text != null ? String(text) : inputField.value).trim();
    if (!userInput) return;
    hideGreetingOnce();
    bubble(userInput, "user");
    inputField.value = "";

    const mode = (typeof CURRENT_MODE === "string" ? CURRENT_MODE : "search");
    const placeholder = mode === "math" ? "…" : (mode === "conversation" ? "…" : "Fetching facts…");
    const ai = bubble('<span class="ai-pending" style="opacity:.92">'+placeholder+'</span>', "ai");

    try {
      const resp = await routeAndAnswer(userInput);
      ai.innerHTML = resp || "I couldn’t find anything helpful.";
    } catch (e) {
      console.error(e);
      ai.innerHTML = "Something went off. Try again?";
      clearSources();
    } finally {
      Utils.scrollBottom();
    }
  }

  // ===== Math keyboard (unchanged) =====
  function insertAtCursor(text, delta){
    const d=(typeof delta==="number")?delta:0;
    const start=inputField.selectionStart!=null?inputField.selectionStart:inputField.value.length;
    const end  =inputField.selectionEnd  !=null?inputField.selectionEnd  :inputField.value.length;
    const v=inputField.value;
    inputField.value = v.slice(0,start)+text+v.slice(end);
    const pos=start+text.length+d;
    inputField.setSelectionRange(pos,pos);
    inputField.focus();
  }
  function ensureKeyboard(){
    if (!mathHost || mathHost.dataset.ready === "1") return;
    mathHost.innerHTML =
      '<div class="kb-header"><div class="kb-title">Math Keyboard</div><div class="kb-controls"><button class="kb-ctrl kb-min" title="Minimize"></button><button class="kb-ctrl kb-close" title="Close"></button></div></div>' +
      '<div class="kb-rows">' +
        '<div class="kb-row">'+["7","8","9","4","5","6","1","2","3","0",".","x","π"].map(v=>'<button class="kb-key">'+v+'</button>').join("")+'</div>' +
        '<div class="kb-row">'+["(",")","+","-","*","/","^","="].map(v=>'<button class="kb-key">'+v+'</button>').join("") +
          '<button class="kb-key wide accent" data-action="plot">Graph</button>' +
          '<button class="kb-key wide accent" data-action="solve">Solve</button>' +
          '<button class="kb-key wide" data-action="calc">Calc</button></div>' +
        '<div class="kb-row">'+["sin()","cos()","tan()","log()","ln()","sqrt()"].map(v=>'<button class="kb-key func">'+v+'</button>').join("") +
          '<button class="kb-key danger" data-action="back">⌫</button>' +
          '<button class="kb-key danger" data-action="clear">Clear</button></div>' +
      '</div>' +
      '<div class="kb-minbar">' +
        '<button class="kb-key mini">(</button><button class="kb-key mini">)</button><button class="kb-key mini">x</button><button class="kb-key mini">π</button>' +
        '<button class="kb-key mini" data-action="plot">Graph</button><button class="kb-key mini" data-action="solve">Solve</button><button class="kb-key mini" data-action="calc">Calc</button>' +
      '</div>';
    const header=mathHost.querySelector(".kb-header");
    let dragging=false, sx=0, sy=0, startLeft=0, startTop=0;
    header.addEventListener("mousedown",(e)=>{
      dragging=true; mathHost.classList.add("dragging");
      const r=mathHost.getBoundingClientRect(); startLeft=r.left; startTop=r.top; sx=e.clientX; sy=e.clientY; e.preventDefault();
    });
    window.addEventListener("mousemove",(e)=>{
      if (!dragging) return;
      mathHost.style.left=(startLeft+(e.clientX-sx))+"px";
      mathHost.style.top =(startTop +(e.clientY-sy))+"px";
      mathHost.style.transform="none";
    });
    window.addEventListener("mouseup",()=>{ dragging=false; mathHost.classList.remove("dragging"); });
    mathHost.querySelector(".kb-close").onclick = ()=> mathHost.classList.remove("visible");
    mathHost.querySelector(".kb-min").onclick   = ()=> mathHost.classList.toggle("minimized");
    mathHost.addEventListener("click",(e)=>{
      const btn=e.target.closest(".kb-key"); if (!btn) return;
      const act=btn.getAttribute("data-action");
      if (act==="plot"){ if (!/^graph|^plot|^draw|y\s*=|f\s*\(\s*x\s*\)\s*=/i.test(inputField.value)) inputField.value="y="; submit(); return; }
      if (act==="solve"){ if (!/^solve\b/i.test(inputField.value)) inputField.value="solve "; submit(); return; }
      if (act==="calc"){ submit(); return; }
      if (act==="back"){ inputField.value=inputField.value.slice(0,-1); inputField.focus(); return; }
      if (act==="clear"){ inputField.value=""; inputField.focus(); return; }
      let t=btn.textContent||""; if (btn.classList.contains("func")) { insertAtCursor(t, -1); return; }
      insertAtCursor(t, 0);
    });
    mathHost.dataset.ready="1";
  }
  if (mathToggleBtn && mathHost) {
    mathToggleBtn.addEventListener("click", ()=>{
      ensureKeyboard();
      mathHost.classList.toggle("visible");
      if (mathHost.classList.contains("visible") && !mathHost.style.left) {
        mathHost.style.left="50%"; mathHost.style.top="18%"; mathHost.style.transform="translateX(-50%)";
      }
      if (CURRENT_MODE !== 'math') applyMode('math');
    });
  }
});
