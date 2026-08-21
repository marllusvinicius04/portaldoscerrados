/* COLE A URL DO WEB APP DO APPS SCRIPT */
const API_URL='https://script.google.com/macros/s/AKfycbw3rB2obc8IV7Cy0FJkxj_S5ZH5c6F0ysANc1H3ygYZbPLCffhNzoDd5kyWsCtl5DiUZw/exec';

/* MÍDIA: configure estes 2 dados do Cloudinary.
   Cloud name: Dashboard > Product Environment
   Upload preset: Settings > Upload > Upload presets > crie um preset UNSIGNED */
const CLOUDINARY_CLOUD_NAME='kcvpeyb6';
const CLOUDINARY_UPLOAD_PRESET='portal_cerrados';

let ADMIN_TOKEN=sessionStorage.getItem('pc_admin_token')||'';
let ADMIN_CLIENT_ID=localStorage.getItem('pc_admin_client_id')||'';
if(!ADMIN_CLIENT_ID){
  ADMIN_CLIENT_ID=(crypto.randomUUID?crypto.randomUUID():('adm-'+Date.now()+'-'+Math.random()));
  localStorage.setItem('pc_admin_client_id',ADMIN_CLIENT_ID);
}

const $=s=>document.querySelector(s);
let data={cities:[],news:[],ads:[],users:[]};
function loading(v){$('#loading').classList.toggle('hide',!v)}
function toast(t){$('#toast').textContent=t;$('#toast').classList.remove('hide');setTimeout(()=>$('#toast').classList.add('hide'),2200)}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function api(action,p={}){
  if(API_URL.includes('COLE_AQUI')) throw new Error('Configure a URL do Apps Script.');
  const payload={action,...p};
  if(action!=='adminLogin') payload.adminToken=ADMIN_TOKEN;

  const r=await fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  });
  const j=await r.json();
  if(!j.ok){
    if(/Sessão administrativa/.test(j.error||'')){
      ADMIN_TOKEN='';
      sessionStorage.removeItem('pc_admin_token');
      $('#shell').classList.add('hide');
      $('#login').classList.remove('hide');
    }
    throw new Error(j.error||'Erro');
  }
  return j;
}

async function login(){
  const password=$('#adminPass').value;
  if(!password) return toast('Digite a senha.');

  loading(true);
  try{
    const r=await api('adminLogin',{password,clientId:ADMIN_CLIENT_ID});
    ADMIN_TOKEN=r.adminToken;
    sessionStorage.setItem('pc_admin_token',ADMIN_TOKEN);
    $('#adminPass').value='';
    $('#login').classList.add('hide');
    $('#shell').classList.remove('hide');
    await refresh();
  }catch(e){
    toast(e.message);
  }finally{
    loading(false);
  }
}
function go(name){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$('#page-'+name).classList.add('active');$('#pageTitle').textContent={dashboard:'Dashboard',news:'Publicar pauta',control:'Notícias',cities:'Cidades',users:'Usuários',notifications:'Disparar notificação',ads:'Criar ADS',adcontrol:'Ver ADS'}[name];}
async function adminLogout(){
  try{ if(ADMIN_TOKEN) await api('adminLogout'); }catch{}
  ADMIN_TOKEN='';
  sessionStorage.removeItem('pc_admin_token');
  $('#shell').classList.add('hide');
  $('#login').classList.remove('hide');
  toast('Sessão encerrada.');
}
async function refresh(){
  loading(true);try{const r=await api('adminList');data=r;render();}catch(e){toast(e.message)}finally{loading(false)}
}
function render(){
  $('#kUsers').textContent=data.users.length;$('#kNews').textContent=data.news.length;$('#kAds').textContent=data.ads.filter(a=>a.status==='active').length;
  $('#dashLatest').innerHTML=data.news.slice(0,6).map(n=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><b>${esc(n.title)}</b><div class="muted">${esc(n.city)} • ${esc(n.category)}</div></div>`).join('');
  const cityOpts=data.cities.filter(c=>String(c.active)!=='false').map(c=>`<option>${esc(c.name)}</option>`).join('');
  $('#newsCity').innerHTML=cityOpts;$('#adCity').innerHTML='<option>Todas</option>'+cityOpts;$('#notifyCity').innerHTML=cityOpts;
  $('#citiesList').innerHTML=data.cities.map(c=>`<div class="card" style="padding:10px;margin:8px 0"><b>${esc(c.name)}</b></div>`).join('');
  $('#usersTable').innerHTML=data.users.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.city)}</td><td>${esc((u.followed||[]).join(', '))}</td><td>${esc(String(u.createdAt).slice(0,10))}</td></tr>`).join('');
  $('#newsTable').innerHTML=data.news.map(n=>`<tr><td>${esc(n.city)}</td><td>${esc(n.category)}</td><td><b>${esc(n.title)}</b></td><td><span class="pill">${esc(n.status)}</span></td><td>
    <button class="btn" onclick="editNews('${n.id}')"><i class="fa-solid fa-pen"></i>Editar</button>
    <button class="btn" onclick="statusNews('${n.id}','${n.status==='published'?'offline':'published'}')">${n.status==='published'?'<i class="fa-solid fa-eye-slash"></i> Tirar do ar':'<i class="fa-solid fa-eye"></i> Publicar'}</button>
    <button class="btn danger" onclick="deleteNews('${n.id}')"><i class="fa-solid fa-trash-can"></i>Excluir</button></td></tr>`).join('');
  $('#adsList').innerHTML='<p class="muted">Use esta tela apenas para criar novos anúncios. Para controlar anúncios publicados, abra <b>Ver ADS</b>.</p>';
  updateNotifyEstimate();
  $('#adsTable').innerHTML=data.ads.map(a=>`<tr><td><b>${esc(a.company)}</b><div class="muted">${esc(a.title||'')}</div></td><td>${esc(a.city)}</td><td><span class="pill">${esc(a.status)}</span></td><td>${esc(String(a.expiresAt).slice(0,10))}</td><td>a cada ${esc(a.frequency||3)} pauta(s)</td><td>
    ${a.status==='active'?`<button class="btn" onclick="statusAd('${a.id}','offline')"><i class="fa-solid fa-eye-slash"></i> Tirar do ar</button>`:`<button class="btn primary" onclick="statusAd('${a.id}','active')"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`}
    <button class="btn danger" onclick="deleteAd('${a.id}')"><i class="fa-solid fa-trash-can"></i>Excluir</button></td></tr>`).join('');
}

function toggleNotifyCity(){
  const isCity=$('#notifyAudience').value==='city';
  $('#notifyCityWrap').classList.toggle('hide',!isCity);
  updateNotifyEstimate();
}

function updateNotifyEstimate(){
  const audience=$('#notifyAudience')?.value||'all';
  const city=$('#notifyCity')?.value||'';
  const total=(data.users||[]).filter(u=>audience==='all'||u.city===city).length;
  const el=$('#notifyEstimate');
  if(el) el.textContent=`${total} destinatário${total===1?'':'s'}`;
}

function previewNotification(){
  const title=$('#notifyTitle').value.trim()||'Sua notificação aparecerá aqui';
  const body=$('#notifyBody').value.trim()||'Escreva uma mensagem para visualizar a prévia.';
  const btn=$('#notifyButtonText').value.trim()||'Acessar Portal dos Cerrados';
  $('#previewNotifyTitle').textContent=title;
  $('#previewNotifyBody').textContent=body;
  $('#previewNotifyButton').textContent=btn;
  updateNotifyEstimate();
}

async function sendNotification(){
  const audience=$('#notifyAudience').value;
  const city=audience==='city'?$('#notifyCity').value:'';
  const title=$('#notifyTitle').value.trim();
  const message=$('#notifyBody').value.trim();
  const buttonText=$('#notifyButtonText').value.trim()||'Acessar Portal dos Cerrados';

  if(!title) return toast('Informe o título da notificação.');
  if(!message) return toast('Informe a mensagem.');
  if(audience==='city' && !city) return toast('Escolha a cidade.');

  updateNotifyEstimate();
  const total=(data.users||[]).filter(u=>audience==='all'||u.city===city).length;
  if(total===0) return toast('Nenhum usuário encontrado para esse público.');

  if(!confirm(`Enviar esta notificação para ${total} usuário${total===1?'':'s'}?`)) return;

  loading(true);
  try{
    const r=await api('adminSendNotification',{
      audience,
      city,
      title,
      message,
      buttonText
    });

    toast(`Notificação enviada para ${r.sent} usuário${r.sent===1?'':'s'}.`);
    $('#notifyTitle').value='';
    $('#notifyBody').value='';
    $('#notifyButtonText').value='Acessar Portal dos Cerrados';
    previewNotification();
  }catch(e){
    toast(e.message);
  }finally{
    loading(false);
  }
}

async function saveCity(){const name=$('#cityName').value.trim();if(!name)return;loading(true);try{await api('adminSaveCity',{name});$('#cityName').value='';await refresh();toast('Cidade adicionada.')}catch(e){toast(e.message)}finally{loading(false)}}
function cmd(c,v=null){document.execCommand(c,false,v)}
function insertLink(){const u=prompt('Cole o link:');if(u)document.execCommand('createLink',false,u)}
async function uploadNewsMedia(){
  const f=$('#newsMediaFile').files[0]; if(!f)return toast('Selecione uma imagem ou vídeo.');
  $('#newsMediaType').value=f.type.startsWith('video/')?'video':'image';
  await uploadTo('newsMediaFile','newsMedia');
}
function cloudinaryConfigured(){
  return !CLOUDINARY_CLOUD_NAME.includes('COLE_') && !CLOUDINARY_UPLOAD_PRESET.includes('COLE_');
}

function uploadCloudinary(file){
  return new Promise((resolve,reject)=>{
    if(!cloudinaryConfigured()){
      reject(new Error('Configure CLOUDINARY_CLOUD_NAME e CLOUDINARY_UPLOAD_PRESET no painel gerente.'));
      return;
    }

    const resourceType=file.type.startsWith('video/')?'video':'image';
    const endpoint=`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`;
    const form=new FormData();
    form.append('file',file);
    form.append('upload_preset',CLOUDINARY_UPLOAD_PRESET);
    form.append('folder','portal-dos-cerrados');

    const xhr=new XMLHttpRequest();
    xhr.open('POST',endpoint,true);

    $('#uploadProgressBox').classList.remove('hide');
    $('#uploadPct').textContent='0%';
    $('#uploadBar').style.width='0%';

    xhr.upload.onprogress=e=>{
      if(!e.lengthComputable) return;
      const pct=Math.round((e.loaded/e.total)*100);
      $('#uploadPct').textContent=pct+'%';
      $('#uploadBar').style.width=pct+'%';
    };

    xhr.onerror=()=>reject(new Error('Falha de conexão durante o upload da mídia.'));
    xhr.onload=()=>{
      try{
        const j=JSON.parse(xhr.responseText||'{}');
        if(xhr.status<200 || xhr.status>=300 || !j.secure_url){
          throw new Error(j?.error?.message||'Cloudinary não aceitou o arquivo.');
        }
        resolve({
          url:j.secure_url,
          publicId:j.public_id||'',
          resourceType:j.resource_type||resourceType,
          format:j.format||'',
          bytes:j.bytes||file.size
        });
      }catch(e){ reject(e); }
    };
    xhr.send(form);
  }).finally(()=>{
    setTimeout(()=>$('#uploadProgressBox').classList.add('hide'),400);
  });
}

async function uploadTo(fileId,targetId){
  const f=document.getElementById(fileId).files[0];
  if(!f) return toast('Selecione um arquivo.');

  // Para o Portal, priorize MP4/H.264 para máxima compatibilidade em navegadores.
  if(f.type.startsWith('video/') && !['video/mp4','video/webm','video/quicktime'].includes(f.type)){
    return toast('Formato de vídeo não recomendado. Prefira MP4.');
  }

  loading(true);
  try{
    const res=await uploadCloudinary(f);
    document.getElementById(targetId).value=res.url;

    if(targetId==='newsMedia'){
      document.getElementById('newsMediaFileId').value='';
      $('#newsMediaType').value=f.type.startsWith('video/')?'video':'image';
    }

    if(targetId==='adMedia'){
      document.getElementById('adMediaFileId').value='';
      $('#adMediaType').value=f.type.startsWith('video/')?'video':'image';
    }

    toast(f.type.startsWith('video/')?'Vídeo enviado e pronto para o feed.':'Imagem enviada.');
  }catch(e){
    toast(e.message);
  }finally{
    loading(false);
  }
}

async function saveNews(){
  const media=$('#newsMedia').value.trim(), mediaType=$('#newsMediaType').value;
  const fileId=$('#newsMediaFileId').value.trim(); const d={id:$('#newsId').value||'',city:$('#newsCity').value,category:$('#newsCategory').value,title:$('#newsTitle').value.trim(),summary:$('#newsSummary').value.trim(),cover:mediaType==='image'?media:'',coverFileId:mediaType==='image'?fileId:'',video:mediaType==='video'?media:'',videoFileId:mediaType==='video'?fileId:'',body:$('#newsBody').innerHTML,status:'published'};
  if(!d.title)return toast('Informe o título.');
  loading(true);try{await api('adminSaveNews',{data:d});clearNews();await refresh();go('control');toast('Pauta publicada.')}catch(e){toast(e.message)}finally{loading(false)}
}
function clearNews(){['newsId','newsTitle','newsSummary','newsMedia','newsMediaFileId'].forEach(id=>$('#'+id).value='');$('#newsMediaType').value='video';$('#newsBody').innerHTML='<h2>Subtítulo da pauta</h2><p>Escreva ou cole aqui todo o conteúdo da matéria.</p>'}
function editNews(id){const n=data.news.find(x=>x.id===id);if(!n)return;go('news');$('#newsId').value=n.id;$('#newsCity').value=n.city;$('#newsCategory').value=n.category;$('#newsTitle').value=n.title;$('#newsSummary').value=n.summary||'';$('#newsMediaType').value=n.video?'video':'image';$('#newsMedia').value=n.video||n.cover||'';$('#newsMediaFileId').value=n.videoFileId||n.coverFileId||'';$('#newsBody').innerHTML=n.body||''}
async function statusNews(id,status){loading(true);try{await api('adminUpdateNewsStatus',{id,status});await refresh();toast(status==='published'?'Pauta publicada.':'Pauta tirada do ar.')}catch(e){toast(e.message)}finally{loading(false)}}
async function deleteNews(id){if(!confirm('Excluir esta pauta definitivamente?'))return;loading(true);try{await api('adminDeleteNews',{id});await refresh();toast('Pauta excluída.')}catch(e){toast(e.message)}finally{loading(false)}}
async function saveAd(){
  const d={id:$('#adId').value||'',city:$('#adCity').value,company:$('#adCompany').value.trim(),title:$('#adTitle').value.trim(),media:$('#adMedia').value.trim(),mediaFileId:$('#adMediaFileId').value.trim(),mediaType:$('#adMediaType').value,buttonText:$('#adButtonText').value,link:$('#adLink').value.trim(),frequency:Number($('#adFrequency').value||3),days:Number($('#adDays').value||7)};
  if(!d.company||!d.media||!d.link)return toast('Preencha empresa, mídia e link.');
  loading(true);try{await api('adminSaveAd',{data:d});await refresh();toast('Anúncio ativado.')}catch(e){toast(e.message)}finally{loading(false)}
}
async function statusAd(id,status){loading(true);try{await api('adminUpdateAdStatus',{id,status});await refresh();toast(status==='active'?'Anúncio reativado.':'Anúncio tirado do ar.')}catch(e){toast(e.message)}finally{loading(false)}}
async function deleteAd(id){if(!confirm('Excluir este anúncio?'))return;loading(true);try{await api('adminDeleteAd',{id});await refresh();toast('Anúncio excluído.')}catch(e){toast(e.message)}finally{loading(false)}}
window.addEventListener('DOMContentLoaded',async()=>{
  if(ADMIN_TOKEN){
    $('#login').classList.add('hide');
    $('#shell').classList.remove('hide');
    try{ await refresh(); }
    catch{ $('#shell').classList.add('hide'); $('#login').classList.remove('hide'); }
  }
});
