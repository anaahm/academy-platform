(() => {
'use strict';
const cfg=window.ACADEMY_FIREBASE_CONFIG;if(!firebase.apps.length)firebase.initializeApp(cfg);
const db=firebase.database(),$=id=>document.getElementById(id);
let items=[];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeUrl=u=>{try{const x=new URL(u);return['http:','https:'].includes(x.protocol)?x.href:''}catch{return''}};
function render(){
 const q=$('newsSearch').value.trim().toLowerCase(),list=items.filter(x=>!q||(x.title||'').toLowerCase().includes(q)||(x.content||'').toLowerCase().includes(q));
 $('newsCount').textContent=list.length+' خبر';
 $('newsGrid').innerHTML=list.length?list.map(n=>{
   const img=safeUrl(n.image||'');
   return '<article class="news-card">'+(img?'<img src="'+esc(img)+'" alt="" loading="lazy">':'<div class="news-placeholder">📰</div>')+'<div class="news-card-body"><span class="news-date">'+(n.date?new Date(n.date).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'}):'')+'</span><h2>'+esc(n.title||'تحديث جديد')+'</h2><p>'+esc(n.content||'')+'</p></div></article>';
 }).join(''):'<div class="news-empty"><span>📰</span><h3>لا توجد أخبار مطابقة</h3><p>جرّب كلمة بحث مختلفة.</p></div>';
}
$('newsSearch').oninput=render;
db.ref('posts').once('value').then(s=>{items=Object.entries(s.val()||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.date||0)-(a.date||0));render()}).catch(()=>{$('newsGrid').innerHTML='<div class="news-empty"><span>⚠️</span><h3>تعذر تحميل الأخبار</h3></div>'});
})();