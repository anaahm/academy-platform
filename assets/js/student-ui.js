/* Academy Platform — student UI enhancements */
(function(){
  function getPortal(){
    try{return typeof portal!=='undefined'?portal:(window.portal||null)}catch(_){return window.portal||null}
  }
  function safeCall(name){
    try{const p=getPortal();if(p&&typeof p[name]==='function')p[name]()}catch(e){console.warn('UI navigation error',e)}
  }
  function buildMobileNav(){
    if(document.getElementById('ap-mobile-nav')) return;
    const nav=document.createElement('div');nav.id='ap-mobile-nav';nav.setAttribute('aria-label','التنقل السريع');
    nav.innerHTML=`<button type="button" data-action="goHome"><i class="fas fa-house"></i><span>الرئيسية</span></button><button type="button" data-action="openFilesHome"><i class="fas fa-book-open"></i><span>الملفات</span></button><button type="button" data-action="openLeaderboard"><i class="fas fa-trophy"></i><span>الترتيب</span></button><button type="button" data-action="openLiveSessions"><i class="fas fa-circle-play"></i><span>البث</span></button><button type="button" data-action="openMyStats"><i class="fas fa-chart-line"></i><span>حسابي</span></button>`;
    nav.addEventListener('click',e=>{const btn=e.target.closest('button[data-action]');if(btn)safeCall(btn.dataset.action)});document.body.appendChild(nav);
  }
  function buildScrollTop(){
    if(document.getElementById('ap-scroll-top')) return;const btn=document.createElement('button');btn.id='ap-scroll-top';btn.type='button';btn.setAttribute('aria-label','العودة إلى أعلى الصفحة');btn.innerHTML='<i class="fas fa-arrow-up"></i>';btn.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});document.body.appendChild(btn);const sync=()=>btn.classList.toggle('show',window.scrollY>650);window.addEventListener('scroll',sync,{passive:true});sync();
  }
  function decorateHome(){
    const p=getPortal(),types=document.getElementById('types-container');if(!p||!types)return;document.getElementById('ap-student-dashboard')?.remove();if(!p.session)return;
    const username=p.session.username||'طالبنا',profile=(p.dbData?.studentProfiles||{})[username]||{},level=profile.level||1,xp=profile.totalXP||0,streak=profile.streak||0,avg=Math.round(profile.averageScore||0);
    const box=document.createElement('section');box.id='ap-student-dashboard';box.innerHTML=`<div class="ap-dash-main"><div class="ap-dash-copy"><span class="ap-eyebrow">لوحتك التعليمية</span><h2>أهلًا ${escapeHtml(username)} 👋</h2><p>تابع تقدمك وابدأ مذاكرتك من مكان واحد.</p></div><div class="ap-dash-actions"><button data-action="openMyStats"><i class="fas fa-chart-line"></i> تقدمي</button><button data-action="openFilesHome"><i class="fas fa-book-open"></i> مكتبتي</button></div></div><div class="ap-dash-stats"><div><span>المستوى</span><strong>${level}</strong></div><div><span>نقاط XP</span><strong>${xp}</strong></div><div><span>سلسلة الأيام</span><strong>${streak} 🔥</strong></div><div><span>متوسط النتائج</span><strong>${avg}%</strong></div></div>`;
    box.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)safeCall(b.dataset.action)});types.parentNode.insertBefore(box,types);
  }
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function patchPortal(){
    const p=getPortal();if(!p||p.__apUiPatched)return;p.__apUiPatched=true;if(typeof p.renderHome==='function'){const original=p.renderHome.bind(p);p.renderHome=function(){const r=original();setTimeout(decorateHome,0);return r}}setTimeout(decorateHome,0);
  }
  function improveExternalLinks(){document.querySelectorAll('a[target="_blank"]').forEach(a=>a.setAttribute('rel','noopener noreferrer'))}
  function boot(){document.documentElement.classList.add('ap-ui-v2');buildMobileNav();buildScrollTop();patchPortal();improveExternalLinks();setTimeout(patchPortal,500)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
