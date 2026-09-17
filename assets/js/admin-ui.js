/* Academy Platform — admin UI enhancements */
(function(){
  function buildOverlay(){
    if(document.getElementById('ap-admin-overlay')) return;
    const overlay=document.createElement('div');
    overlay.id='ap-admin-overlay';
    overlay.addEventListener('click',()=>{
      const sidebar=document.getElementById('sidebar');
      if(sidebar) sidebar.classList.remove('open');
    });
    document.body.appendChild(overlay);

    const sidebar=document.getElementById('sidebar');
    if(sidebar){
      const sync=()=>overlay.classList.toggle('show',sidebar.classList.contains('open') && window.innerWidth<768);
      new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
      window.addEventListener('resize',sync);sync();
    }
  }

  function buildScrollTop(){
    if(document.getElementById('ap-admin-scroll-top')) return;
    const btn=document.createElement('button');
    btn.id='ap-admin-scroll-top';btn.type='button';btn.setAttribute('aria-label','العودة إلى أعلى الصفحة');
    btn.innerHTML='<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(btn);
    const main=document.querySelector('.main-content');
    const target=main||window;
    const getY=()=>main?main.scrollTop:window.scrollY;
    const sync=()=>btn.classList.toggle('show',getY()>500);
    btn.onclick=()=>main?main.scrollTo({top:0,behavior:'smooth'}):window.scrollTo({top:0,behavior:'smooth'});
    target.addEventListener('scroll',sync,{passive:true});sync();
  }

  function fixStudentLink(){
    document.querySelectorAll('a[href="student.html"]').forEach(a=>a.setAttribute('href','index.html'));
  }

  function addMobileLabel(){
    const headerTitle=document.getElementById('top-title');
    if(!headerTitle||document.getElementById('ap-admin-mobile-label')) return;
    const label=document.createElement('span');
    label.id='ap-admin-mobile-label';
    label.innerHTML='<i class="fas fa-shield-halved"></i> إدارة';
    headerTitle.parentElement?.appendChild(label);
  }

  function improveExternalLinks(){
    document.querySelectorAll('a[target="_blank"]').forEach(a=>a.setAttribute('rel','noopener noreferrer'));
  }

  function boot(){
    document.documentElement.classList.add('ap-admin-ui-v2');
    buildOverlay();buildScrollTop();fixStudentLink();addMobileLabel();improveExternalLinks();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
