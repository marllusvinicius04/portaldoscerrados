/* Segurança do cliente:
   A URL da API usada pelo navegador é necessariamente observável no DevTools/Network.
   A proteção real deve existir no Apps Script: autenticação, autorização por ação,
   validação de payload, rate limiting e nunca retornar segredos ao frontend. */
const API_URL = 'https://script.google.com/macros/s/AKfycbw3rB2obc8IV7Cy0FJkxj_S5ZH5c6F0ysANc1H3ygYZbPLCffhNzoDd5kyWsCtl5DiUZw/exec';
const SUPPORT_WA = '5589994372011';
const CHANNELS = [
  {id:'Politica',label:'Política',icon:'<i class="fa-solid fa-landmark"></i>'},
  {id:'Educacao',label:'Educação',icon:'<i class="fa-solid fa-graduation-cap"></i>'},
  {id:'Cultura',label:'Cultura',icon:'<i class="fa-solid fa-masks-theater"></i>'},
  {id:'Agro',label:'Agro',icon:'<i class="fa-solid fa-wheat-awn"></i>'},
  {id:'Esporte',label:'Esporte',icon:'<i class="fa-solid fa-futbol"></i>'},
  {id:'Negocios',label:'Negócios',icon:'<i class="fa-solid fa-briefcase"></i>'},
  {id:'Entretenimento',label:'Entretenimento',icon:'<i class="fa-solid fa-film"></i>'}
];

let state = { user:null, cities:[], news:[], ads:[], feed:[], followed:[], currentNews:null, authMode:'login', currentCommentNewsId:null, replyTo:null, online:0, feedNonce:Date.now(), feedSoundOn:localStorage.getItem('pc_feed_sound')==='1' };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toggle(id,show){ document.getElementById(id).classList.toggle('hide',!show); }
function loading(show,text='Carregando...'){ $('#loadingText').textContent=text; toggle('loading',show); }
function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2300); }
function safe(v=''){ return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function fmtDate(v){ if(!v)return''; try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(v));}catch{return v} }

async function api(action,data={}){
  if(API_URL.includes('COLE_AQUI')) throw new Error('Configure API_URL no arquivo.');
  const payload = {action,...data,token:localStorage.getItem('pc_token')||''};
  const ctrl = new AbortController(); const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
    const r = await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:ctrl.signal});
    const j = await r.json(); if(!j.ok) throw new Error(j.error||'Erro na conexão'); return j;
  } finally { clearTimeout(timer); }
}

async function boot(){
  loading(true,'Preparando o Portal dos Cerrados...');
  try{
    const cached = JSON.parse(localStorage.getItem('pc_boot')||'null');
    if(cached && Date.now()-cached.ts < 5*60*1000){
      state.cities=cached.cities||[]; state.news=cached.news||[]; state.ads=cached.ads||[];
      fillCities(); renderAll();
    }
    if(!API_URL.includes('COLE_AQUI')){
      const data = await api('bootstrap',{city:localStorage.getItem('pc_city')||''});
      state.cities=data.cities||[]; state.news=data.news||[]; state.ads=data.ads||[]; state.online=data.online||0;
      localStorage.setItem('pc_boot',JSON.stringify({ts:Date.now(),cities:state.cities,news:state.news,ads:state.ads}));
      if(data.user){ state.user=data.user; state.followed=data.user.followed||[]; localStorage.setItem('pc_city',data.user.city||''); }
      fillCities(); personalize(); renderAll();
    } else {
      demoData(); fillCities(); personalize(); renderAll();
    }
    const hasSession = !!localStorage.getItem('pc_token');
    if(!hasSession) toggle('preview',true);
    else if(!state.user && !API_URL.includes('COLE_AQUI')) await restoreSession();
    updateAccount();
    startHeartbeat();
  }catch(e){ toast(e.message); if(!localStorage.getItem('pc_token')) toggle('preview',true); }
  finally{ setTimeout(()=>loading(false),350); }
}

function demoData(){
  state.cities=['Uruçuí','Benedito Leite','Baixa Grande do Ribeiro','Ribeiro Gonçalves'];
  state.news=[
    {id:'n1',city:'Uruçuí',category:'Politica',title:'Novas pautas movimentam a semana em Uruçuí',summary:'Veja os principais assuntos em debate na cidade.',cover:'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=80',video:'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',body:'<h2>Informação com contexto</h2><p>Esta é uma matéria demonstrativa para visualizar o formato editorial do Portal dos Cerrados.</p><blockquote>O objetivo é unir leitura confortável com uma experiência visual de streaming.</blockquote><p>Você poderá publicar o conteúdo completo pelo painel gerente.</p>',publishedAt:new Date().toISOString()},
    {id:'n2',city:'Uruçuí',category:'Educacao',title:'Educação local ganha novos projetos',summary:'Iniciativas de escolas e estudantes da região em destaque.',cover:'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',video:'',body:'<p>Conteúdo demonstrativo.</p>',publishedAt:new Date(Date.now()-86400000).toISOString()},
    {id:'n3',city:'Baixa Grande do Ribeiro',category:'Agro',title:'Agro dos Cerrados segue em transformação',summary:'Tecnologia, produção e histórias de quem movimenta o campo.',cover:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',video:'',body:'<p>Conteúdo demonstrativo.</p>',publishedAt:new Date(Date.now()-172800000).toISOString()}
  ];
  state.ads=[{id:'a1',city:'Uruçuí',company:'Empresa Parceira',title:'Uma oferta especial para você',media:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',mediaType:'image',buttonText:'Ver informações',link:'https://example.com',frequency:3,expiresAt:new Date(Date.now()+7*86400000).toISOString()}];
}

async function restoreSession(){
  try{
    const r=await api('me'); state.user=r.user; state.followed=r.user.followed||[]; personalize(); renderAll(); updateAccount();
  }catch{ localStorage.removeItem('pc_token'); toggle('preview',true); }
}

function fillCities(){
  const opts=['Todas',...state.cities].map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join('');
  $('#cityFilter').innerHTML=opts; $('#signupCity').innerHTML=state.cities.map(c=>`<option>${safe(c)}</option>`).join('');
  const selected=localStorage.getItem('pc_city')||state.user?.city||'Todas'; $('#cityFilter').value=selected || 'Todas';
  $('#cityFilter').onchange=()=>{localStorage.setItem('pc_city',$('#cityFilter').value); state.feedNonce=Date.now(); personalize(); renderAll();};
}

function seededRandom(key){
  let h=2166136261;
  const s=String(key)+'|'+String(state.feedNonce);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return ((h>>>0)%10000)/10000;
}
function personalize(){
  const city=$('#cityFilter')?.value || localStorage.getItem('pc_city') || 'Todas';
  const filtered=state.news.filter(n=>city==='Todas'||n.city===city);
  const nowMs=Date.now();
  state.feed=[...filtered].sort((a,b)=>{
    const score=n=>{
      const ageHours=Math.max(0,(nowMs-new Date(n.publishedAt||n.createdAt||nowMs).getTime())/36e5);
      const recentWeight=5*Math.exp(-ageHours/72);       // últimas notícias ganham peso
      const followWeight=state.followed.includes(n.category)?2.4:0;
      const randomWeight=seededRandom(n.id)*4.2;         // mantém o feed imprevisível
      return recentWeight+followWeight+randomWeight;
    };
    return score(b)-score(a);
  });
}

function renderAll(){ personalize(); renderHero(); renderHome(); renderChannels(); renderFeed(); }

function renderHero(){
  const city=$('#cityFilter')?.value || localStorage.getItem('pc_city') || state.user?.city || 'sua região';
  const label=city==='Todas'?'os Cerrados':city;
  $('#hero').innerHTML=`<img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1800&q=88" alt="Cerrados">
    <div class="heroContent">
      <span class="eyebrow">PORTAL DOS CERRADOS</span>
      <h1>Veja o que está em alta em ${safe(label)}</h1>
      <p>Notícias, histórias e acontecimentos da sua cidade em uma experiência rápida, visual e regional.</p>
      <div class="row"><button class="btn primary" onclick="goPage('feed')"><i class="fa-solid fa-play"></i> Assistir agora</button>
      <span class="badge"><span class="onlineDot"></span><b id="heroOnline">${state.online||0}</b> online</span></div>
    </div>`;
}

function newsCard(n){
  let media='';
  if(n.video){
    const poster=cloudinaryVideoPoster(n.video);
    media=poster
      ? `<img src="${safe(poster)}" alt="" loading="lazy">`
      : `<div style="height:140px;display:grid;place-items:center;background:#06272d;color:#9da7b1">Vídeo</div>`;
  }else{
    media=mediaImage(n.cover||'',n.coverFileId||'');
  }
  return `<article class="card" onclick="openArticle('${n.id}')">${media}<div class="pad"><span class="eyebrow">${safe(n.category)} • ${safe(n.city)}</span><h3>${safe(n.title)}</h3></div></article>`;
}
function renderHome(){
  $('#highlights').innerHTML=state.feed.slice(0,8).map(newsCard).join('')||'<div class="empty">Nenhuma pauta nessa cidade.</div>';
  const favorite=state.feed.filter(n=>state.followed.includes(n.category));
  $('#likedForYou').innerHTML=(favorite.length?favorite:state.feed).slice(0,8).map(newsCard).join('');
  $('#latest').innerHTML=[...state.feed].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)).slice(0,10).map(newsCard).join('');
}

function renderChannels(){
  const cards=CHANNELS.map(c=>`<article class="card channelCard ${state.followed.includes(c.id)?'following':''}">
    <div class="channelIcon">${c.icon}</div><div class="eyebrow">CANAL</div><h2>${c.label}</h2>
    <button class="btn ${state.followed.includes(c.id)?'ghost':'primary'}" onclick="toggleFollow('${c.id}')">${state.followed.includes(c.id)?'Seguindo':'Seguir'}</button>
  </article>`).join('');
  $('#channels').innerHTML=cards; $('#channelsGrid').innerHTML=cards;
}

async function toggleFollow(cat){
  if(!state.user && !API_URL.includes('COLE_AQUI')) return openAuth('login');
  const has=state.followed.includes(cat); state.followed=has?state.followed.filter(x=>x!==cat):[...state.followed,cat];
  if(state.user) state.user.followed=state.followed; localStorage.setItem('pc_followed',JSON.stringify(state.followed));
  renderAll(); toast(has?'Canal removido dos favoritos':'Você está seguindo este canal');
  if(!API_URL.includes('COLE_AQUI')) try{ await api('setFollow',{category:cat,follow:!has}); }catch(e){toast(e.message)}
}


function isDrivePreview(url=''){ return /drive\.google\.com\/file\/d\/[^/]+\/preview/.test(String(url)); }

function isCloudinaryUrl(url=''){
  return /^https:\/\/res\.cloudinary\.com\//i.test(String(url||''));
}

function extractDriveId(value=''){
  const s=String(value||'');
  let m=s.match(/drive\.google\.com\/file\/d\/([^/?]+)/i);
  if(m) return m[1];
  m=s.match(/[?&]id=([^&]+)/i);
  if(m) return m[1];
  m=s.match(/drive\.usercontent\.google\.com\/download\?id=([^&]+)/i);
  if(m) return m[1];
  return '';
}

function imageUrl(url='',fileId=''){
  url=String(url||'');
  if(isCloudinaryUrl(url)) return url;
  const id=String(fileId||extractDriveId(url)||'').trim();
  if(id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
  return url;
}

function videoUrl(url='',fileId=''){
  url=String(url||'');
  if(isCloudinaryUrl(url)) return url;
  const id=String(fileId||extractDriveId(url)||'').trim();

  // Mantido apenas para conteúdo antigo. Google Drive pode falhar como streaming.
  if(id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  return url;
}

function cloudinaryVideoPoster(url=''){
  url=String(url||'');
  if(!isCloudinaryUrl(url)) return '';
  try{
    const u=new URL(url);
    let p=u.pathname;
    p=p.replace('/video/upload/','/video/upload/so_0,f_jpg,q_auto/');
    p=p.replace(/\.[a-z0-9]+$/i,'.jpg');
    return `${u.origin}${p}`;
  }catch{return ''}
}

function mediaImage(url,fileId=''){
  const src=imageUrl(url,fileId);
  return `<img src="${safe(src)}" alt="" loading="lazy"
    onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=75'">`;
}

function feedMedia(url,cover='',isVideo=false,fileId=''){
  if(isVideo){
    const src=videoUrl(url,fileId);
    const poster=cloudinaryVideoPoster(url)||imageUrl(cover,'');
    return `<video class="feedVideo" src="${safe(src)}" ${poster?`poster="${safe(poster)}"`:''}
      muted loop playsinline webkit-playsinline preload="metadata"
      onloadedmetadata="this.muted=true;this.controls=false"
      onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"></video>
      <div style="display:none;position:absolute;inset:0;place-items:center;background:#06272d;color:#fff;padding:30px;text-align:center;z-index:2">
        <div><b>Este vídeo antigo precisa ser reenviado.</b><br><small>Abra a pauta no painel gerente e envie novamente a mídia para a CDN.</small></div>
      </div>`;
  }
  return mediaImage(url||cover,fileId);
}

function renderFeed(){
  const city=$('#cityFilter')?.value||'Todas';
  const ads=state.ads.filter(a=>!a.city||a.city==='Todas'||city==='Todas'||a.city===city);
  const mixed=[]; const inserted=new Set();
  state.feed.forEach((n,i)=>{
    mixed.push({type:'news',data:n});
    ads.forEach(a=>{
      const freq=Math.max(1,Number(a.frequency||3));
      if((i+1)%freq===0){
        mixed.push({type:'ad',data:a});
        inserted.add(a.id);
      }
    });
  });
  // Se houver pouco conteúdo, garante ao menos uma exibição dos anúncios ativos.
  ads.filter(a=>!inserted.has(a.id)).forEach(a=>mixed.push({type:'ad',data:a}));
  $('#feed').innerHTML=`<div class="feedRefresh">↑ Continue deslizando para atualizar no final</div>`+(mixed.map(x=>x.type==='ad'?adFeed(x.data):newsFeed(x.data)).join('')||'<div class="empty">Nenhum conteúdo disponível.</div>');
  setupFeedVideoInteraction(); setupFeedRefreshGesture(); applyFeedSound(); if($('#page-feed')?.classList.contains('active')) setupVideoObserver(); else pauseAllFeedVideos();
}
function newsFeed(n){
  const media=n.video?feedMedia(n.video,n.cover||'',true,n.videoFileId||''):feedMedia(n.cover||'',n.cover||'',false,n.coverFileId||'');
  return `<article class="feedItem" data-id="${n.id}">${media}<div class="feedShade"></div>
    <div class="feedMeta"><span class="eyebrow">${safe(n.category)} • ${safe(n.city)}</span><h2>${safe(n.title)}</h2><p>${safe(n.summary||'')}</p>
      <button class="btn primary" onclick="openArticle('${n.id}')">Ver pauta completa</button></div>
    <div class="feedActions">
      <button class="soundBtn" onclick="toggleFeedSound(event)">${state.feedSoundOn?'<i class="fa-solid fa-volume-high"></i>':'<i class="fa-solid fa-volume-xmark"></i>'}<small>${state.feedSoundOn?'Som':'Sem som'}</small></button>
      <button onclick="openComments('${n.id}')"><i class="fa-solid fa-comment-dots"></i><small>Comentários</small></button>
      <button onclick="shareNews('${n.id}')"><i class="fa-solid fa-share-nodes"></i><small>Compartilhar</small></button>
      <button><span class="onlineDot" style="display:inline-block"></span><small><span class="onlineCount">${state.online||0}</span> online</small></button>
    </div>
    <div class="feedTapState"><i class="fa-solid fa-pause"></i></div>
    <div class="feedSeek"><span class="feedSeekFill"></span></div>
  </article>`;
}
function adFeed(a){
  const media=feedMedia(a.media,'',a.mediaType==='video',a.mediaFileId||'');
  return `<article class="feedItem">${media}<div class="feedShade"></div><div class="feedMeta">
    <span class="eyebrow">ANÚNCIO PRA VOCÊ</span><h2>${safe(a.company)}</h2><p>${safe(a.title)}</p>
    <a class="btn primary" style="display:inline-block;text-decoration:none" href="${safe(a.link)}" target="_blank" rel="noopener noreferrer">${safe(a.buttonText||'Ver informações')}</a>
  </div>
  <div class="feedActions"><button class="soundBtn" onclick="toggleFeedSound(event)">${state.feedSoundOn?'<i class="fa-solid fa-volume-high"></i>':'<i class="fa-solid fa-volume-xmark"></i>'}<small>${state.feedSoundOn?'Som':'Sem som'}</small></button></div><div class="feedTapState"><i class="fa-solid fa-pause"></i></div><div class="feedSeek"><span class="feedSeekFill"></span></div></article>`;
}
let feedGestureBound=false, touchStartY=0;
async function refreshFeed(){
  loading(true,'Atualizando seu feed...');
  try{
    if(!API_URL.includes('COLE_AQUI')){
      const r=await api('bootstrap',{city:$('#cityFilter').value||localStorage.getItem('pc_city')||''});
      state.news=r.news||state.news; state.ads=r.ads||state.ads; state.online=r.online||state.online;
      localStorage.setItem('pc_boot',JSON.stringify({ts:Date.now(),cities:state.cities,news:state.news,ads:state.ads}));
    }
    state.feedNonce=Date.now()+Math.random();
    personalize(); renderFeed(); renderHome(); renderHero();
    toast('Feed atualizado');
    $('#feed').scrollTo({top:0,behavior:'smooth'});
  }catch(e){ toast(e.message); } finally{ setTimeout(()=>loading(false),250); }
}

function setupFeedVideoInteraction(){
  $$('.feedVideo').forEach(v=>{
    if(v.dataset.interactionBound==='1') return;
    v.dataset.interactionBound='1';
    v.controls=false;

    const item=v.closest('.feedItem');
    const bar=item?.querySelector('.feedSeek');
    const fill=item?.querySelector('.feedSeekFill');
    const stateIcon=item?.querySelector('.feedTapState');

    let startX=0,startY=0,startTime=0,dragging=false,pointerId=null;
    let moved=false;

    const flashState=icon=>{
      if(!stateIcon) return;
      stateIcon.innerHTML=icon;
      stateIcon.classList.add('show');
      clearTimeout(stateIcon._timer);
      stateIcon._timer=setTimeout(()=>stateIcon.classList.remove('show'),520);
    };

    const setProgress=()=>{
      if(!fill || !v.duration || !isFinite(v.duration)) return;
      fill.style.width=((v.currentTime/v.duration)*100)+'%';
    };

    v.addEventListener('timeupdate',setProgress);

    // Reforço explícito do loop. Não depende apenas do atributo "loop".
    v.addEventListener('ended',()=>{
      v.currentTime=0;
      if(item?.classList.contains('is-active') && $('#page-feed')?.classList.contains('active')){
        v.play().catch(()=>{});
      }
    });

    const begin=(x,y,id=null)=>{
      startX=x; startY=y; startTime=v.currentTime||0;
      dragging=false; moved=false; pointerId=id;
    };

    const move=(x,y)=>{
      const dx=x-startX, dy=y-startY;
      if(Math.abs(dx)>6 || Math.abs(dy)>6) moved=true;

      if(!v.duration || !isFinite(v.duration)) return;

      // Arraste horizontal = avançar/voltar no vídeo.
      if(!dragging && Math.abs(dx)>16 && Math.abs(dx)>Math.abs(dy)*1.35){
        dragging=true;
        item?.classList.add('dragging');
        bar?.classList.add('show');
        v.pause();
      }

      if(!dragging) return;

      const width=Math.max(220,item?.clientWidth||window.innerWidth);
      const delta=(dx/width)*v.duration;
      v.currentTime=Math.max(0,Math.min(v.duration,startTime+delta));
      setProgress();
    };

    const end=()=>{
      if(dragging){
        item?.classList.remove('dragging');
        setTimeout(()=>bar?.classList.remove('show'),650);
        if(item?.classList.contains('is-active') && $('#page-feed')?.classList.contains('active')){
          v.play().catch(()=>{});
        }
      }else if(!moved && item?.classList.contains('is-active')){
        // Toque simples no vídeo = pausar / continuar.
        if(v.paused){
          v.dataset.userPaused='0';
          v.play().then(()=>flashState('<i class="fa-solid fa-play"></i>')).catch(()=>{});
        }else{
          v.dataset.userPaused='1';
          v.pause();
          flashState('<i class="fa-solid fa-pause"></i>');
        }
      }
      dragging=false; moved=false; pointerId=null;
    };

    v.addEventListener('pointerdown',e=>{
      begin(e.clientX,e.clientY,e.pointerId);
      try{v.setPointerCapture(e.pointerId)}catch{}
    });
    v.addEventListener('pointermove',e=>{
      if(pointerId===e.pointerId) move(e.clientX,e.clientY);
    });
    v.addEventListener('pointerup',end);
    v.addEventListener('pointercancel',()=>{
      dragging=false;moved=false;pointerId=null;
      item?.classList.remove('dragging');
      bar?.classList.remove('show');
    });
  });
}

function setupFeedRefreshGesture(){
  const f=$('#feed'); if(!f || f.dataset.refreshBound==='1') return;
  f.dataset.refreshBound='1';
  f.addEventListener('touchstart',e=>{touchStartY=e.touches[0].clientY},{passive:true});
  f.addEventListener('touchend',e=>{
    const endY=e.changedTouches[0].clientY;
    const swipeUp=touchStartY-endY>75;
    const atBottom=f.scrollTop+f.clientHeight>=f.scrollHeight-30;
    if(swipeUp && atBottom) refreshFeed();
  },{passive:true});
}
let feedObserver=null;
let feedScrollRaf=0;

function applyFeedSound(){
  $$('.feedVideo').forEach(v=>{
    const isActive=v.closest('.feedItem')?.classList.contains('is-active');
    v.muted=!state.feedSoundOn;
    if(isActive && $('#page-feed')?.classList.contains('active')){
      v.play().catch(()=>{});
    }
  });
  $$('.soundBtn').forEach(btn=>{
    btn.innerHTML=`${state.feedSoundOn?'<i class="fa-solid fa-volume-high"></i>':'<i class="fa-solid fa-volume-xmark"></i>'}<small>${state.feedSoundOn?'Som':'Sem som'}</small>`;
  });
}

function toggleFeedSound(e){
  if(e){ e.stopPropagation(); e.preventDefault(); }
  state.feedSoundOn=!state.feedSoundOn;
  localStorage.setItem('pc_feed_sound',state.feedSoundOn?'1':'0');

  const current=getCurrentFeedItem?.();
  const v=current?.querySelector('.feedVideo');
  if(v){
    v.muted=!state.feedSoundOn;
    if(state.feedSoundOn){
      v.play().catch(()=>{});
    }
  }
  applyFeedSound();
}

function pauseAllFeedVideos(){
  $$('.feedVideo').forEach(v=>{
    try{ v.pause(); }catch{}
    v.controls=false;
  });
  $$('.feedItem').forEach(i=>i.classList.remove('is-active'));
}

function getCurrentFeedItem(){
  const wrap=$('#feed');
  if(!wrap) return null;

  const wr=wrap.getBoundingClientRect();
  const center=wr.top + wr.height/2;
  let best=null;
  let bestDistance=Infinity;

  $$('.feedItem').forEach(item=>{
    const r=item.getBoundingClientRect();
    const itemCenter=r.top+r.height/2;
    const distance=Math.abs(itemCenter-center);
    if(distance<bestDistance){
      bestDistance=distance;
      best=item;
    }
  });
  return best;
}

function activateVisibleFeedVideo(){
  if(!$('#page-feed')?.classList.contains('active')){
    pauseAllFeedVideos();
    return;
  }

  const current=getCurrentFeedItem();

  // Primeiro paramos absolutamente tudo.
  $$('.feedVideo').forEach(v=>{
    if(v.closest('.feedItem')!==current){
      v.pause();
      v.dataset.userPaused='0';
    }
  });
  $$('.feedItem').forEach(i=>i.classList.toggle('is-active',i===current));

  if(!current) return;

  // Se o item atual for IMAGEM, nenhum vídeo toca.
  const v=current.querySelector('.feedVideo');
  if(!v){
    pauseAllFeedVideos();
    current.classList.add('is-active');
    return;
  }

  v.muted=!state.feedSoundOn;
  v.loop=true;
  v.controls=false;

  // Só inicia se o usuário não tiver pausado manualmente este item.
  if(v.dataset.userPaused!=='1'){
    v.play().catch(()=>{});
  }
}

function setupVideoObserver(){
  if(feedObserver) feedObserver.disconnect();

  const wrap=$('#feed');
  if(!wrap) return;

  feedObserver=new IntersectionObserver(()=>{
    cancelAnimationFrame(feedScrollRaf);
    feedScrollRaf=requestAnimationFrame(activateVisibleFeedVideo);
  },{root:wrap,threshold:[0,.25,.5,.7,.9,1]});

  $$('.feedItem').forEach(i=>feedObserver.observe(i));

  // O scroll é a fonte principal de verdade para troca estilo TikTok.
  if(wrap.dataset.playerScrollBound!=='1'){
    wrap.dataset.playerScrollBound='1';
    wrap.addEventListener('scroll',()=>{
      cancelAnimationFrame(feedScrollRaf);
      feedScrollRaf=requestAnimationFrame(activateVisibleFeedVideo);
    },{passive:true});
  }

  if($('#page-feed')?.classList.contains('active')){
    requestAnimationFrame(activateVisibleFeedVideo);
  }else{
    pauseAllFeedVideos();
  }
}

function openArticle(id){
  pauseAllFeedVideos();
  const n=state.news.find(x=>x.id===id); if(!n)return; state.currentNews=n;
  $('#articleContent').innerHTML=`<div class="tag">${safe(n.category)} • ${safe(n.city)} • ${fmtDate(n.publishedAt)}</div><h1>${safe(n.title)}</h1><p class="lead">${safe(n.summary||'')}</p>
  ${n.cover?`<img src="${safe(imageUrl(n.cover,n.coverFileId))}" onerror="this.style.display='none'">`:''}
  ${n.video?`<video src="${safe(videoUrl(n.video,n.videoFileId))}" controls playsinline style="width:100%;max-height:70vh;border-radius:18px;background:#000;margin:14px 0"></video>`:''}
  <div class="body">${n.body||''}</div>
  <div class="row" style="margin-top:24px"><button class="btn primary" onclick="shareNews('${n.id}')">Compartilhar</button><button class="btn ghost" onclick="openComments('${n.id}')">Comentários</button></div>`;
  $('#articleSheet').classList.add('open'); $('#sheetBackdrop').classList.add('open'); document.body.style.overflow='hidden';
}
function closeSheet(){ $('#articleSheet').classList.remove('open'); $('#sheetBackdrop').classList.remove('open'); document.body.style.overflow=''; if($('#page-feed')?.classList.contains('active')) requestAnimationFrame(activateVisibleFeedVideo); }

function avatarLabel(email=''){ return (String(email).split('@')[0]||'U').slice(0,2).toUpperCase(); }
function commentHtml(c,replies=[]){
  const who=safe((c.email||'leitor').split('@')[0]);
  const children=replies.filter(r=>String(r.parentId||'')===String(c.id));
  return `<div class="igComment">
    <div class="igAvatar">${avatarLabel(c.email)}</div>
    <div class="igText"><p><b>${who}</b> ${safe(c.text)}</p>
      <div class="igMeta"><span>${fmtDate(c.createdAt)}</span><button class="btn ghost" style="padding:2px 7px;font-size:11px" onclick="beginReply('${c.id}','${who}')">Responder</button></div>
    </div>
  </div>
  ${children.map(r=>`<div class="igReply">${commentHtml(r,[])}</div>`).join('')}`;
}
async function openComments(id){
  state.currentCommentNewsId=id; state.replyTo=null; $('#replyBar').classList.add('hide');
  toggle('commentsModal',true); $('#commentsList').innerHTML='<div class="muted">Carregando comentários...</div>';
  if(API_URL.includes('COLE_AQUI')){
    const demo=[{id:'c1',email:'leitor@demo.com',text:'Gostei desse formato de pauta.',createdAt:new Date().toISOString(),parentId:''},{id:'c2',email:'maria@demo.com',text:'Também achei bem mais fácil de acompanhar.',createdAt:new Date().toISOString(),parentId:'c1'}];
    $('#commentsList').innerHTML=demo.filter(c=>!c.parentId).map(c=>commentHtml(c,demo)).join(''); return;
  }
  try{
    const r=await api('getComments',{newsId:id}); const all=r.comments||[];
    $('#commentsList').innerHTML=all.filter(c=>!c.parentId).map(c=>commentHtml(c,all)).join('')||'<div class="muted">Seja o primeiro a comentar.</div>';
  }catch(e){$('#commentsList').innerHTML=`<div class="muted">${safe(e.message)}</div>`}
}
function beginReply(id,name){ state.replyTo=id; $('#replyLabel').textContent='Respondendo a @'+name; $('#replyBar').classList.remove('hide'); $('#commentText').focus(); }
function cancelReply(){ state.replyTo=null; $('#replyBar').classList.add('hide'); }
function closeComments(){ cancelReply(); toggle('commentsModal',false); }
async function sendComment(){
  const text=$('#commentText').value.trim(); if(!text)return;
  if(!state.user && !API_URL.includes('COLE_AQUI')) return openAuth('login');
  loading(true,state.replyTo?'Publicando resposta...':'Publicando comentário...');
  try{
    if(!API_URL.includes('COLE_AQUI')) await api('addComment',{newsId:state.currentCommentNewsId,text,parentId:state.replyTo||''});
    $('#commentText').value=''; cancelReply(); await openComments(state.currentCommentNewsId); toast('Publicado');
  }catch(e){toast(e.message)} finally{loading(false)}
}

function openAuth(mode){ state.authMode=mode; toggle('preview',false); toggle('authModal',true); $('#signupFields').classList.toggle('hide',mode!=='signup'); $('#authTitle').textContent=mode==='signup'?'Criar conta grátis':'Entrar'; $('#authSubmit').textContent=mode==='signup'?'Criar conta':'Entrar'; }
function closeAuth(){toggle('authModal',false); if(!localStorage.getItem('pc_token'))toggle('preview',true)}
async function submitAuth(){
  const email=$('#authEmail').value.trim(), password=$('#authPassword').value, city=$('#signupCity').value;
  if(!email||!password)return toast('Preencha e-mail e senha.');
  loading(true,state.authMode==='signup'?'Criando sua conta...':'Entrando...');
  try{
    if(API_URL.includes('COLE_AQUI')){
      state.user={email,city:city||'Uruçuí',followed:[]}; localStorage.setItem('pc_token','demo'); localStorage.setItem('pc_city',state.user.city); toggle('authModal',false); fillCities(); renderAll(); welcome(); return;
    }
    const r=await api(state.authMode==='signup'?'signup':'login',{email,password,city});
    localStorage.setItem('pc_token',r.token); state.user=r.user; state.followed=r.user.followed||[]; localStorage.setItem('pc_city',r.user.city||'Todas');
    toggle('authModal',false); fillCities(); renderAll(); updateAccount(); welcome();
  }catch(e){toast(e.message)} finally{setTimeout(()=>loading(false),300)}
}
function welcome(){ toggle('preview',false); updateAccount(); setTimeout(()=>toast(`Bem-vindo${state.user?.city?' a '+state.user.city:''}!`),250); }

function openForgot(){
  const currentEmail=$('#authEmail')?.value?.trim()||'';
  toggle('authModal',false);
  toggle('forgotModal',true);
  $('#forgotEmail').value=currentEmail;
  $('#forgotStatus').textContent='';
  $('#resetStep').classList.add('hide');
  $('#resetCode').value='';
  $('#resetPassword').value='';
  $('#sendResetBtn').textContent='Enviar código';
  setTimeout(()=>$('#forgotEmail').focus(),120);
}
async function requestReset(){
  const email=$('#forgotEmail').value.trim().toLowerCase();
  const status=$('#forgotStatus');
  status.textContent='';
  $('#resetStep').classList.add('hide');

  if(!email){
    status.textContent='Informe seu e-mail.';
    return;
  }

  loading(true,'Verificando seu e-mail...');
  try{
    await api('forgotPassword',{email});
    status.textContent='Código enviado. Confira seu e-mail.';
    $('#resetStep').classList.remove('hide');
    $('#sendResetBtn').textContent='Reenviar código';
    setTimeout(()=>$('#resetCode').focus(),120);
  }catch(e){
    status.textContent=e.message||'Não foi possível enviar o código.';
    $('#resetStep').classList.add('hide');
  }finally{
    loading(false);
  }
}

async function confirmReset(){
  const email=$('#forgotEmail').value.trim().toLowerCase();
  const code=$('#resetCode').value.trim();
  const password=$('#resetPassword').value;
  const status=$('#forgotStatus');

  status.textContent='';

  if(!email || !code || !password){
    status.textContent='Preencha o código e a nova senha.';
    return;
  }
  if(!/^\d{6}$/.test(code)){
    status.textContent='Digite o código de 6 dígitos.';
    return;
  }
  if(password.length<6){
    status.textContent='A nova senha deve ter pelo menos 6 caracteres.';
    return;
  }

  loading(true,'Conferindo código e salvando sua nova senha...');
  try{
    await api('resetPassword',{email,code,password});

    $('#resetCode').value='';
    $('#resetPassword').value='';
    $('#resetStep').classList.add('hide');
    $('#forgotStatus').textContent='';
    $('#sendResetBtn').textContent='Enviar código';
    toggle('forgotModal',false);

    state.authMode='login';
    openAuth('login');
    $('#authEmail').value=email;
    $('#authPassword').value='';
    setTimeout(()=>$('#authPassword').focus(),150);

    toast('Senha alterada com sucesso. Entre com sua nova senha.');
  }catch(e){
    status.textContent=e.message||'Código inválido ou expirado.';
  }finally{
    setTimeout(()=>loading(false),250);
  }
}

function goPage(name,btn){
  // Antes de qualquer troca de tela, nenhum vídeo do feed pode continuar tocando.
  pauseAllFeedVideos();

  $$('.page').forEach(p=>p.classList.remove('active'));
  $('#page-'+name).classList.add('active');
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
  if(btn) btn.classList.add('active');

  if(name==='feed'){
    // O clique em Feed é o único momento em que o player do Feed é ativado.
    requestAnimationFrame(()=>{
      setupFeedVideoInteraction();
      setupVideoObserver();
      activateVisibleFeedVideo();
    });
  }
}
function openMenu(show=true){ $('#menuPanel').classList.toggle('open',show); updateAccount(); }
function updateAccount(){ $('#accountSummary').innerHTML=state.user?`<b>${safe(state.user.email)}</b><div class="muted">${safe(state.user.city||'Sem cidade')}</div><small class="muted">${state.followed.length} canal(is) seguido(s)</small>`:'<b>Visitante</b><div class="muted">Entre para personalizar sua experiência.</div>'; }
function openAccount(){ openMenu(false); toast('Sua cidade e canais favoritos ficam vinculados à sua conta.'); }
function logout(){ localStorage.removeItem('pc_token'); state.user=null;state.followed=[];openMenu(false);toggle('preview',true);renderAll();toast('Você saiu da conta.'); }
async function deleteAccount(){
  if(!confirm('Excluir sua conta permanentemente?'))return;
  loading(true,'Excluindo sua conta...');
  try{ if(!API_URL.includes('COLE_AQUI')) await api('deleteAccount'); localStorage.clear(); location.reload(); }catch(e){toast(e.message)}finally{loading(false)}
}
function doSearch(){
  const q=$('#searchInput').value.trim().toLowerCase(); const list=state.news.filter(n=>(n.title+' '+n.city+' '+n.category+' '+(n.summary||'')).toLowerCase().includes(q));
  $('#searchResults').innerHTML=list.map(n=>`<div style="margin-bottom:10px">${newsCard(n)}</div>`).join('')||'<div class="empty">Nenhum resultado.</div>';
}
function shareNews(id){
  const n=state.news.find(x=>x.id===id); if(!n)return;
  const text=`${n.title} — Portal dos Cerrados`;
  if(navigator.share)navigator.share({title:n.title,text}).catch(()=>{}); else navigator.clipboard.writeText(text).then(()=>toast('Título copiado.'));
}

async function heartbeat(){
  if(API_URL.includes('COLE_AQUI')){ state.online=1; updateOnline(); return; }
  let clientId=localStorage.getItem('pc_client_id');
  if(!clientId){ clientId='anon-'+crypto.randomUUID(); localStorage.setItem('pc_client_id',clientId); }
  try{
    const r=await api('heartbeat',{city:$('#cityFilter').value||state.user?.city||'Todas',clientId});
    state.online=r.online||0; updateOnline();
  }catch{}
}
function updateOnline(){ $$('.onlineCount').forEach(x=>x.textContent=state.online); const h=$('#heroOnline');if(h)h.textContent=state.online; }
function startHeartbeat(){ heartbeat(); setInterval(heartbeat,60000); }

document.addEventListener('visibilitychange',()=>{
  if(document.hidden) pauseAllFeedVideos();
  else if($('#page-feed')?.classList.contains('active')) requestAnimationFrame(activateVisibleFeedVideo);
});
window.addEventListener('pagehide',pauseAllFeedVideos);
window.addEventListener('blur',()=>{
  if(!$('#page-feed')?.classList.contains('active')) pauseAllFeedVideos();
});

// Segurança inicial: nenhum vídeo do feed toca durante Home/login/carregamento.
document.addEventListener('DOMContentLoaded',()=>setTimeout(pauseAllFeedVideos,0));

boot();
