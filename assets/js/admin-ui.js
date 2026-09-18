/* Academy Platform — admin UI enhancements + teacher management */
(function(){
  const teacherDefaults={
    primary:[{id:'arabic',name:'لغة عربية'},{id:'math',name:'رياضيات'},{id:'science',name:'علوم'},{id:'english',name:'إنجليزي'},{id:'social',name:'دراسات'},{id:'religion',name:'دين'}],
    prep:[{id:'arabic',name:'لغة عربية'},{id:'math',name:'رياضيات'},{id:'science',name:'علوم'},{id:'english',name:'إنجليزي'},{id:'social',name:'دراسات'},{id:'computer',name:'حاسب'}],
    sec:[{id:'arabic',name:'عربي'},{id:'english',name:'إنجليزي'},{id:'math',name:'رياضيات'},{id:'physics',name:'فيزياء'},{id:'chemistry',name:'كيمياء'},{id:'biology',name:'أحياء'},{id:'history',name:'تاريخ'},{id:'geography',name:'جغرافيا'}]
  };

  function notify(msg,type='success'){
    try{if(typeof app!=='undefined'&&app.notify)return app.notify(msg,type)}catch(e){}
    alert(msg);
  }

  function buildOverlay(){
    if(document.getElementById('ap-admin-overlay'))return;
    const overlay=document.createElement('div');overlay.id='ap-admin-overlay';
    overlay.addEventListener('click',()=>{const sidebar=document.getElementById('sidebar');if(sidebar)sidebar.classList.remove('open')});
    document.body.appendChild(overlay);
    const sidebar=document.getElementById('sidebar');
    if(sidebar){const sync=()=>overlay.classList.toggle('show',sidebar.classList.contains('open')&&window.innerWidth<768);new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',sync);sync()}
  }
  function buildScrollTop(){
    if(document.getElementById('ap-admin-scroll-top'))return;
    const btn=document.createElement('button');btn.id='ap-admin-scroll-top';btn.type='button';btn.setAttribute('aria-label','العودة إلى أعلى الصفحة');btn.innerHTML='<i class="fas fa-arrow-up"></i>';document.body.appendChild(btn);
    const main=document.querySelector('.main-content'),target=main||window,getY=()=>main?main.scrollTop:window.scrollY,sync=()=>btn.classList.toggle('show',getY()>500);
    btn.onclick=()=>main?main.scrollTo({top:0,behavior:'smooth'}):window.scrollTo({top:0,behavior:'smooth'});
    target.addEventListener('scroll',sync,{passive:true});sync();
  }
  function fixStudentLink(){document.querySelectorAll('a[href="student.html"]').forEach(a=>a.setAttribute('href','index.html'))}
  function addMobileLabel(){const title=document.getElementById('top-title');if(!title||document.getElementById('ap-admin-mobile-label'))return;const label=document.createElement('span');label.id='ap-admin-mobile-label';label.innerHTML='<i class="fas fa-shield-halved"></i> إدارة';title.parentElement?.appendChild(label)}
  function improveExternalLinks(){document.querySelectorAll('a[target="_blank"]').forEach(a=>a.setAttribute('rel','noopener noreferrer'))}

  function getMainContainer(){
    const content=document.querySelector('.main-content');
    if(!content)return null;
    return content.querySelector('.p-4.md\\:p-8')||content.querySelector('.p-4')||content;
  }
  function switchToTeacherAdmin(btn){
    document.querySelectorAll('.adm-tab').forEach(x=>x.classList.remove('active'));
    const tab=document.getElementById('tab-teachers-v3');if(tab)tab.classList.add('active');
    document.querySelectorAll('.side-btn').forEach(x=>x.classList.remove('active'));btn?.classList.add('active');
    const title=document.getElementById('top-title');if(title)title.innerText='إدارة المدرسين والمراجعات';
    if(window.innerWidth<768)document.getElementById('sidebar')?.classList.remove('open');
    renderTeacherAdmin();
  }
  function buildTeacherAdmin(){
    if(document.getElementById('tab-teachers-v3'))return;
    const nav=document.querySelector('#sidebar nav'),container=getMainContainer();
    if(!nav||!container)return;

    const heading=document.createElement('p');
    heading.className='text-xs font-black text-slate-500 mb-4 mt-8 px-4';
    heading.textContent='👨‍🏫 فريق التدريس';
    const btn=document.createElement('button');
    btn.className='side-btn w-full text-right';btn.innerHTML='<i class="fas fa-chalkboard-teacher w-6 text-center text-sky-400"></i> المدرسون والمراجعات';
    btn.addEventListener('click',()=>switchToTeacherAdmin(btn));
    nav.append(heading,btn);

    const tab=document.createElement('div');tab.id='tab-teachers-v3';tab.className='adm-tab space-y-8';
    tab.innerHTML=`
      <section class="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-7 md:p-9 rounded-[2rem] shadow-xl">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div><span class="text-xs font-black text-blue-300">نظام المدرسين V3</span><h3 class="text-3xl font-black mt-2">إدارة المدرسين والمحتوى المرسل</h3><p class="text-slate-300 text-sm mt-2">فعّل المدرسين، حدد موادهم وصفوفهم، وراجع المحتوى قبل نشره.</p></div>
          <a href="v3/teacher.html" target="_blank" class="bg-white text-slate-900 px-5 py-3 rounded-xl font-black text-sm"><i class="fas fa-external-link-alt ml-2"></i> معاينة بوابة المدرس</a>
        </div>
      </section>

      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="teacher-admin-stats"></section>

      <section class="grid xl:grid-cols-[1.15fr_.85fr] gap-6">
        <div class="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm">
          <div class="flex items-center justify-between gap-3 mb-5"><div><span class="text-xs font-black text-blue-600">الحسابات</span><h3 class="text-2xl font-black">المدرسون الحاليون</h3></div><button id="refresh-teachers-v3" class="bg-slate-100 px-4 py-2 rounded-xl font-bold text-sm"><i class="fas fa-sync-alt ml-1"></i> تحديث</button></div>
          <div id="teachers-v3-list" class="space-y-3"></div>
        </div>

        <div class="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm">
          <span class="text-xs font-black text-emerald-600">حسابات جاهزة</span><h3 class="text-2xl font-black mb-2">تحويل حساب إلى مدرس</h3>
          <p class="text-xs text-slate-400 mb-5">الحساب لازم يكون أنشأ نفسه أولًا من منصة الطالب. بعدها تقدر ترقيه لمدرس من هنا.</p>
          <div id="teacher-candidates-v3" class="space-y-3 max-h-[520px] overflow-auto"></div>
        </div>
      </section>

      <section class="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm">
        <span class="text-xs font-black text-violet-600">الصلاحيات</span><h3 class="text-2xl font-black mb-5">إسناد مادة وصف لمدرس</h3>
        <div class="grid md:grid-cols-6 gap-3">
          <select id="ta-teacher" class="border-2 border-slate-200 p-3 rounded-xl font-bold"></select>
          <select id="ta-type" class="border-2 border-slate-200 p-3 rounded-xl font-bold"><option value="public">تعليم عام</option><option value="azhar">أزهر</option></select>
          <select id="ta-stage" class="border-2 border-slate-200 p-3 rounded-xl font-bold"><option value="primary">ابتدائي</option><option value="prep">إعدادي</option><option value="sec">ثانوي</option></select>
          <select id="ta-grade" class="border-2 border-slate-200 p-3 rounded-xl font-bold"></select>
          <select id="ta-subject" class="border-2 border-slate-200 p-3 rounded-xl font-bold"></select>
          <button id="ta-add" class="bg-violet-600 text-white rounded-xl font-black px-4"><i class="fas fa-plus ml-1"></i> إسناد</button>
        </div>
      </section>

      <section class="bg-white p-6 md:p-8 rounded-[2rem] border shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><span class="text-xs font-black text-amber-600">المراجعة قبل النشر</span><h3 class="text-2xl font-black">المحتوى المرسل من المدرسين</h3></div><span id="pending-count-v3" class="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-sm font-black">0 قيد المراجعة</span></div>
        <div id="teacher-submissions-v3" class="space-y-3"></div>
      </section>`;
    container.appendChild(tab);

    tab.querySelector('#refresh-teachers-v3').onclick=renderTeacherAdmin;
    ['ta-type','ta-stage','ta-grade'].forEach(id=>tab.querySelector('#'+id)?.addEventListener('change',refreshAssignmentForm));
    tab.querySelector('#ta-add').onclick=addTeacherAssignment;
  }

  function subjectOptions(stage,grade,type){
    const list=[...(teacherDefaults[stage]||[])];
    try{
      const custom=admin.dbData.customSubjects?.[stage]?.[grade];
      if(Array.isArray(custom))custom.forEach(s=>{
        if(!s?.id||!s?.name||(s.type&&s.type!==type))return;
        if(!list.some(x=>x.id===s.id))list.push({id:s.id,name:s.name});
      });
    }catch(e){}
    return list;
  }
  function refreshAssignmentForm(){
    const stage=document.getElementById('ta-stage')?.value||'primary',type=document.getElementById('ta-type')?.value||'public';
    const gradeSel=document.getElementById('ta-grade');if(!gradeSel)return;
    const max=stage==='primary'?6:3,current=gradeSel.value||'1';
    gradeSel.innerHTML=Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'">الصف '+(i+1)+'</option>').join('');
    if(Number(current)<=max)gradeSel.value=current;
    const subs=subjectOptions(stage,gradeSel.value,type),subSel=document.getElementById('ta-subject');
    if(subSel)subSel.innerHTML=subs.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  }
  function safe(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function allSubmissions(root){
    const arr=[];
    Object.entries(root||{}).forEach(([uid,items])=>Object.entries(items||{}).forEach(([id,v])=>arr.push({uid,id,...v})));
    return arr.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  }
  async function renderTeacherAdmin(){
    if(!document.getElementById('tab-teachers-v3'))return;
    try{
      const snap=await database.ref('/').once('value'),root=snap.val()||{},teachers=root.teacherProfiles||{},students=root.studentProfilesV3||{},subs=allSubmissions(root.teacherSubmissions);
      const teacherEntries=Object.entries(teachers),active=teacherEntries.filter(([,t])=>t.isActive!==false).length,pending=subs.filter(s=>(s.status||'pending')==='pending').length,approved=subs.filter(s=>s.status==='approved').length;
      document.getElementById('teacher-admin-stats').innerHTML=[
        ['👨‍🏫',teacherEntries.length,'إجمالي المدرسين'],['✅',active,'مدرس نشط'],['⏳',pending,'قيد المراجعة'],['📚',approved,'محتوى معتمد']
      ].map(x=>'<article class="bg-white border rounded-2xl p-5 shadow-sm"><span class="text-2xl">'+x[0]+'</span><strong class="text-2xl block mt-2">'+x[1]+'</strong><small class="text-slate-400 font-bold">'+x[2]+'</small></article>').join('');

      document.getElementById('teachers-v3-list').innerHTML=teacherEntries.length?teacherEntries.map(([uid,t])=>{
        const assignments=Array.isArray(t.assignments)?t.assignments:Object.values(t.assignments||{});
        return `<article class="border rounded-2xl p-4">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div><div class="flex items-center gap-2"><span class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">${safe((t.name||'م')[0])}</span><div><h4 class="font-black">${safe(t.name||t.email||'مدرس')}</h4><p class="text-[10px] text-slate-400">${safe(t.email||uid)}</p></div></div><div class="flex flex-wrap gap-1 mt-3">${assignments.slice(0,5).map(a=>'<span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-[9px] font-bold">'+safe(a.subjectName||a.subject||'مادة')+' • صف '+safe(a.grade||'-')+'</span>').join('')||'<span class="text-[10px] text-slate-400">لا توجد صلاحيات بعد</span>'}</div></div>
            <div class="flex gap-2"><button data-toggle-teacher="${uid}" data-active="${t.isActive!==false}" class="${t.isActive!==false?'bg-amber-50 text-amber-700':'bg-emerald-50 text-emerald-700'} px-3 py-2 rounded-xl font-bold text-xs">${t.isActive!==false?'إيقاف':'تفعيل'}</button><button data-delete-teacher="${uid}" class="bg-red-50 text-red-600 px-3 py-2 rounded-xl font-bold text-xs">حذف الصفة</button></div>
          </div>
        </article>`;
      }).join(''):'<p class="text-slate-400 text-center py-8">لا يوجد مدرسون بعد.</p>';

      document.querySelectorAll('[data-toggle-teacher]').forEach(b=>b.onclick=async()=>{await database.ref('teacherProfiles/'+b.dataset.toggleTeacher+'/isActive').set(b.dataset.active!=='true');notify('تم تحديث حالة المدرس');renderTeacherAdmin()});
      document.querySelectorAll('[data-delete-teacher]').forEach(b=>b.onclick=async()=>{if(!confirm('إزالة صفة المدرس من هذا الحساب؟'))return;await database.ref('teacherProfiles/'+b.dataset.deleteTeacher).remove();notify('تمت إزالة صفة المدرس');renderTeacherAdmin()});

      const candidates=Object.entries(students).filter(([uid])=>!teachers[uid]);
      document.getElementById('teacher-candidates-v3').innerHTML=candidates.length?candidates.map(([uid,s])=>`<article class="border rounded-2xl p-3 flex items-center justify-between gap-3"><div><strong class="text-sm block">${safe(s.name||s.email||'حساب طالب')}</strong><small class="text-[9px] text-slate-400">${safe(s.email||uid)}</small></div><button data-promote-teacher="${uid}" class="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-black">تحويل لمدرس</button></article>`).join(''):'<p class="text-slate-400 text-center py-6 text-sm">لا توجد حسابات جديدة للترقية.</p>';
      document.querySelectorAll('[data-promote-teacher]').forEach(b=>b.onclick=async()=>{const s=students[b.dataset.promoteTeacher]||{};await database.ref('teacherProfiles/'+b.dataset.promoteTeacher).set({name:s.name||'',email:s.email||'',isActive:true,createdAt:Date.now(),assignments:[]});notify('تم إنشاء ملف المدرس');renderTeacherAdmin()});

      const teacherSel=document.getElementById('ta-teacher');teacherSel.innerHTML=teacherEntries.map(([uid,t])=>'<option value="'+uid+'">'+safe(t.name||t.email||uid)+'</option>').join('');refreshAssignmentForm();

      document.getElementById('pending-count-v3').textContent=pending+' قيد المراجعة';
      document.getElementById('teacher-submissions-v3').innerHTML=subs.length?subs.map(s=>`<article class="border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div class="flex flex-wrap gap-2 mb-2"><span class="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[9px] font-black">${safe(s.type==='azhar'?'أزهر':'عام')}</span><span class="bg-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold">${safe(s.stage||'')} • صف ${safe(s.grade||'')}</span><span class="bg-slate-100 px-2 py-1 rounded-lg text-[9px] font-bold">${safe(s.subjectName||s.subject||'')}</span></div><h4 class="font-black text-lg">${safe(s.title||'بدون عنوان')}</h4><p class="text-xs text-slate-400">المدرس: ${safe(s.teacherName||teachers[s.uid]?.name||'غير معروف')} • الحالة: ${safe(s.status||'pending')}</p>${s.videoUrl?'<a href="'+safe(s.videoUrl)+'" target="_blank" rel="noopener" class="text-blue-600 text-xs font-bold">فتح الفيديو <i class="fas fa-external-link-alt"></i></a>':''}</div><div class="flex gap-2">${(s.status||'pending')==='pending'?'<button data-approve-sub="'+s.uid+'|'+s.id+'" class="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black text-xs">اعتماد ونشر</button><button data-reject-sub="'+s.uid+'|'+s.id+'" class="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-black text-xs">رفض</button>':'<span class="'+(s.status==='approved'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700')+' px-3 py-2 rounded-xl text-xs font-black">'+(s.status==='approved'?'معتمد':'مرفوض')+'</span>'}</div></article>`).join(''):'<p class="text-slate-400 text-center py-8">لا توجد طلبات محتوى.</p>';

      document.querySelectorAll('[data-approve-sub]').forEach(b=>b.onclick=async()=>{const [uid,id]=b.dataset.approveSub.split('|'),sub=root.teacherSubmissions?.[uid]?.[id];if(!sub)return;const lessonRef=database.ref('lessons').push();await lessonRef.set({title:sub.title||'درس',content:'',type:sub.type||'public',stage:sub.stage||'prep',grade:String(sub.grade||1),subject:sub.subject||'',unit:Number(sub.unit||1),videos:[{name:sub.teacherName||teachers[uid]?.name||'المدرس',url:sub.videoUrl||'',teacherId:uid}],questions:[],isLocked:false,isHidden:false,teacherId:uid,teacherSubmissionId:id,createdAt:Date.now()});await database.ref('teacherSubmissions/'+uid+'/'+id).update({status:'approved',lessonId:lessonRef.key,reviewedAt:Date.now()});notify('تم اعتماد المحتوى ونشره');renderTeacherAdmin()});
      document.querySelectorAll('[data-reject-sub]').forEach(b=>b.onclick=async()=>{const [uid,id]=b.dataset.rejectSub.split('|');await database.ref('teacherSubmissions/'+uid+'/'+id).update({status:'rejected',reviewedAt:Date.now()});notify('تم رفض المحتوى');renderTeacherAdmin()});
    }catch(e){console.error(e);notify('تعذر تحميل إدارة المدرسين','error')}
  }

  async function addTeacherAssignment(){
    const uid=document.getElementById('ta-teacher')?.value;if(!uid)return notify('اختر مدرسًا','error');
    const type=document.getElementById('ta-type').value,stage=document.getElementById('ta-stage').value,grade=document.getElementById('ta-grade').value,subject=document.getElementById('ta-subject').value,subjectName=document.getElementById('ta-subject').selectedOptions[0]?.textContent||subject;
    const ref=database.ref('teacherProfiles/'+uid+'/assignments').push();
    await ref.set({type,stage,grade,subject,subjectName,createdAt:Date.now()});notify('تم إسناد المادة للمدرس');renderTeacherAdmin();
  }

  function boot(){
    document.documentElement.classList.add('ap-admin-ui-v2');
    buildOverlay();buildScrollTop();fixStudentLink();addMobileLabel();improveExternalLinks();buildTeacherAdmin();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();