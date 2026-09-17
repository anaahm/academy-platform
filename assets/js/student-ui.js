/* Academy Platform — student UI enhancements */
(function(){
  function safeCall(name){
    try{
      if(window.portal && typeof window.portal[name]==='function') window.portal[name]();
    }catch(e){console.warn('UI navigation error',e)}
  }

  function buildMobileNav(){
    if(document.getElementById('ap-mobile-nav')) return;
    const nav=document.createElement('div');
    nav.id='ap-mobile-nav';
    nav.setAttribute('aria-label','التنقل السريع');
    nav.innerHTML=`
      <button type="button" data-action="goHome"><i class="fas fa-house"></i><span>الرئيسية</span></button>
      <button type="button" data-action="openFilesHome"><i class="fas fa-book-open"></i><span>الملفات</span></button>
      <button type="button" data-action="openLeaderboard"><i class="fas fa-trophy"></i><span>الترتيب</span></button>
      <button type="button" data-action="openLiveSessions"><i class="fas fa-circle-play"></i><span>البث</span></button>
      <button type="button" data-action="openMyStats"><i class="fas fa-chart-line"></i><span>حسابي</span></button>`;
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-action]');
      if(!btn) return;
      safeCall(btn.dataset.action);
    });
    document.body.appendChild(nav);
  }

  function buildScrollTop(){
    if(document.getElementById('ap-scroll-top')) return;
    const btn=document.createElement('button');
    btn.id='ap-scroll-top';
    btn.type='button';
    btn.setAttribute('aria-label','العودة إلى أعلى الصفحة');
    btn.innerHTML='<i class="fas fa-arrow-up"></i>';
    btn.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    document.body.appendChild(btn);
    const sync=()=>btn.classList.toggle('show',window.scrollY>650);
    window.addEventListener('scroll',sync,{passive:true});sync();
  }

  function improveExternalLinks(){
    document.querySelectorAll('a[target="_blank"]').forEach(a=>a.setAttribute('rel','noopener noreferrer'));
  }

  function boot(){
    document.documentElement.classList.add('ap-ui-v2');
    buildMobileNav();
    buildScrollTop();
    improveExternalLinks();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
