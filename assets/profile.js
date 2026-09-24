(() => {
'use strict';

let firebaseConfig=null;
try{
  firebaseConfig=window.ACADEMY_FIREBASE_CONFIG||JSON.parse(localStorage.getItem('academyFirebaseConfig')||'null');
}catch(err){console.warn('Invalid Firebase config',err)}
if(!firebaseConfig){location.replace('./index.html');return}
if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let user=null,profile={},baseline={account:{},study:{}};

const gradeLabels={
  primary:{1:'الصف الأول الابتدائي',2:'الصف الثاني الابتدائي',3:'الصف الثالث الابتدائي',4:'الصف الرابع الابتدائي',5:'الصف الخامس الابتدائي',6:'الصف السادس الابتدائي'},
  prep:{1:'الصف الأول الإعدادي',2:'الصف الثاني الإعدادي',3:'الصف الثالث الإعدادي'},
  sec:{1:'الصف الأول الثانوي',2:'الصف الثاني الثانوي',3:'الصف الثالث الثانوي'}
};
const badges=[
  {id:'first_lesson',emoji:'🚀',name:'البداية',desc:'أكمل أول درس',check:p=>(p.stats?.completedLessons||0)>=1},
  {id:'five_lessons',emoji:'📚',name:'مستمر',desc:'أكمل 5 دروس',check:p=>(p.stats?.completedLessons||0)>=5},
  {id:'first_quiz',emoji:'🎯',name:'أول اختبار',desc:'أنهِ أول اختبار',check:p=>(p.stats?.completedQuizzes||0)>=1},
  {id:'xp_500',emoji:'⭐',name:'500 XP',desc:'اجمع 500 نقطة',check:p=>(p.stats?.totalXP||0)>=500},
  {id:'streak_3',emoji:'🔥',name:'3 أيام',desc:'حافظ على 3 أيام متتالية',check:p=>(p.stats?.streak||0)>=3},
  {id:'level_3',emoji:'🏅',name:'المستوى 3',desc:'وصل للمستوى الثالث',check:p=>(p.stats?.level||1)>=3}
];

function toast(msg,type='success'){
  const el=$('toast');
  if(!el)return;
  el.textContent=msg;el.className='toast show '+type;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3000);
}
function initials(n='طالب'){return(n.trim()[0]||'ط').toUpperCase()}
function educationLabel(t){return t==='azhar'?'التعليم الأزهري':'التعليم العام'}
function accountSnapshot(){return{name:$('profileNameInput')?.value.trim()||''}}
function studySnapshot(){return{educationType:$('studyType')?.value||'public',stage:$('studyStage')?.value||'prep',grade:Number($('studyGrade')?.value||1)}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function setBaselines(){
  baseline.account=accountSnapshot();
  baseline.study=studySnapshot();
  updateDirtyStates();
}
function updateDirtyStates(){
  const accountDirty=!same(accountSnapshot(),baseline.account);
  const studyDirty=!same(studySnapshot(),baseline.study);
  if($('accountSaveStatus'))$('accountSaveStatus').textContent=accountDirty?'لديك تغييرات غير محفوظة.':'كل التغييرات محفوظة.';
  if($('studySaveStatus'))$('studySaveStatus').textContent=studyDirty?'سيتم تغيير المواد الظاهرة بعد الحفظ.':'المواد المعروضة تعتمد على المرحلة والصف.';
  if($('accountSaveBtn'))$('accountSaveBtn').disabled=!accountDirty;
  if($('studySaveBtn'))$('studySaveBtn').disabled=!studyDirty;
}
function updateGradeOptions(preserve=true){
  const stage=$('studyStage').value,max=stage==='primary'?6:3;
  const desired=preserve?Number($('studyGrade').value||profile.grade||1):Number(profile.grade||1);
  $('studyGrade').innerHTML=Array.from({length:max},(_,i)=>i+1).map(g=>'<option value="'+g+'">'+gradeLabels[stage][g]+'</option>').join('');
  $('studyGrade').value=String(Math.min(Math.max(1,desired),max));
  updateDirtyStates();
}
function savedLessonHref(b){
  const q=new URLSearchParams({
    type:b.type||profile.educationType||'public',
    stage:b.stage||profile.stage||'prep',
    grade:String(b.grade||profile.grade||1),
    subject:b.subject||'',
    id:b.lessonId||b.id
  });
  return './lesson.html?'+q.toString();
}
function lastActivityHref(){
  if(profile.lastLessonId){
    const q=new URLSearchParams({
      type:profile.educationType||'public',
      stage:profile.stage||'prep',
      grade:String(profile.grade||1),
      subject:profile.lastSubjectId||'',
      id:profile.lastLessonId
    });
    return './lesson.html?'+q.toString();
  }
  if(profile.lastSubjectId){
    const q=new URLSearchParams({
      type:profile.educationType||'public',
      stage:profile.stage||'prep',
      grade:String(profile.grade||1),
      subject:profile.lastSubjectId
    });
    return './subject.html?'+q.toString();
  }
  return './index.html';
}
function render(){
  const s=profile.stats||{},name=profile.name||user.displayName||(user.email||'طالب').split('@')[0];
  const totalXP=Number(s.totalXP||0),level=Number(s.level||Math.floor(totalXP/1000)+1),levelXp=totalXP%1000,remaining=1000-levelXp;

  $('profileAvatar').textContent=initials(name);
  $('profileNameTitle').textContent=name;
  $('profileStageTitle').textContent=(gradeLabels[profile.stage]?.[profile.grade]||'لم تحدد صفك بعد')+' • '+educationLabel(profile.educationType);
  $('profileLevel').textContent=level;
  $('profileXp').textContent=totalXP;
  $('profileLevelProgress').style.width=(levelXp/10)+'%';
  $('profileLevelProgressTrack').setAttribute('aria-valuenow',String(levelXp));
  $('profileNextLevelText').textContent=remaining+' XP للمستوى التالي';

  $('profileLessons').textContent=s.completedLessons||0;
  $('profileQuizzes').textContent=s.completedQuizzes||0;
  $('profileStreak').textContent=s.streak||0;
  $('profileTotalXp').textContent=totalXP;
  $('profileNameInput').value=name;
  $('profileEmailInput').value=user.email||'';
  if($('securityEmail'))$('securityEmail').textContent=user.email||'لا يوجد بريد';

  $('studyType').value=profile.educationType||'public';
  $('studyStage').value=profile.stage||'prep';
  updateGradeOptions(false);
  $('studyGrade').value=String(profile.grade||1);

  $('profileBadges').innerHTML=badges.map(b=>{
    const unlocked=b.check(profile);
    return '<article class="badge-item '+(unlocked?'unlocked':'locked')+'" aria-label="'+esc(b.name)+'، '+(unlocked?'مفتوحة':'مقفولة')+'"><span>'+b.emoji+'</span><strong>'+esc(b.name)+'</strong><small>'+esc(b.desc)+'</small>'+(unlocked?'<i class="fa-solid fa-circle-check badge-check"></i>':'<i class="fa-solid fa-lock badge-lock"></i>')+'</article>';
  }).join('');

  const bookmarks=Object.entries(profile.bookmarks||{}).map(([id,b])=>({id,...(b||{})})).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
  if($('profileSavedCount'))$('profileSavedCount').textContent=bookmarks.length;
  const savedGrid=$('savedLessonsGrid');
  if(savedGrid){
    savedGrid.innerHTML=bookmarks.length?bookmarks.map(b=>
      '<article class="saved-lesson-card">'+
        '<a class="saved-lesson-main" href="'+savedLessonHref(b)+'"><span class="saved-lesson-icon"><i class="fa-solid fa-bookmark"></i></span><div><strong>'+esc(b.title||'درس محفوظ')+'</strong><small>العودة إلى الدرس</small></div><i class="fa-solid fa-arrow-left saved-open-arrow"></i></a>'+
        '<button class="saved-remove-btn" data-remove-bookmark="'+esc(b.id)+'" title="إزالة من المحفوظات" aria-label="إزالة '+esc(b.title||'الدرس')+' من المحفوظات"><i class="fa-solid fa-trash"></i></button>'+
      '</article>'
    ).join(''):'<div class="profile-empty-saved"><span>🔖</span><h3>لسه مفيش دروس محفوظة</h3><p>احفظ أي درس من علامة الحفظ داخل صفحة الدرس.</p><a class="btn btn-primary" href="./index.html">استكشف موادك</a></div>';

    $$('[data-remove-bookmark]').forEach(btn=>btn.onclick=async()=>{
      const ok=await window.AcademyUI.confirm({
        title:'إزالة الدرس من المحفوظات؟',
        message:'سيظل تقدمك في الدرس محفوظًا، وسيتم فقط إزالته من قائمة المراجعة.',
        tone:'warning',
        acceptText:'إزالة'
      });
      if(!ok)return;
      btn.disabled=true;
      try{
        await db.ref('studentProfilesV3/'+user.uid+'/bookmarks/'+btn.dataset.removeBookmark).remove();
        if(profile.bookmarks)delete profile.bookmarks[btn.dataset.removeBookmark];
        render();toast('تمت إزالة الدرس من المحفوظات.');
      }catch(err){
        console.error(err);btn.disabled=false;toast('تعذر إزالة الدرس الآن.','error');
      }
    });
  }

  if(profile.lastLessonTitle||profile.lastSubjectId){
    $('lastActivity').innerHTML=
      '<article class="last-activity-card">'+
        '<div class="last-activity-icon"><i class="fa-solid fa-play"></i></div>'+
        '<div><span class="section-kicker">آخر نشاط</span><h3>'+esc(profile.lastLessonTitle||'متابعة المادة')+'</h3><p>'+esc(gradeLabels[profile.stage]?.[profile.grade]||'')+'</p></div>'+
        '<a class="btn btn-primary" href="'+lastActivityHref()+'">متابعة <i class="fa-solid fa-arrow-left"></i></a>'+
      '</article>';
  }else{
    $('lastActivity').innerHTML='<div class="profile-empty-activity"><span>▶️</span><h3>ابدأ أول درس</h3><p>أول ما تبدأ التعلم هنحفظ مكانك هنا تلقائيًا.</p><a class="btn btn-primary" href="./index.html">ابدأ الآن</a></div>';
  }

  setBaselines();
}
function switchTab(tab,updateUrl=true){
  const allowed=['overview','account','study','saved','security'];
  if(!allowed.includes(tab))tab='overview';
  $$('[data-profile-tab]').forEach(b=>{
    const active=b.dataset.profileTab===tab;
    b.classList.toggle('active',active);
    b.setAttribute('aria-selected',active?'true':'false');
    b.tabIndex=active?0:-1;
  });
  $$('.profile-tab').forEach(s=>s.classList.add('hidden'));
  $('tab-'+tab)?.classList.remove('hidden');
  if(updateUrl){
    const url=new URL(location.href);
    if(tab==='overview')url.searchParams.delete('tab');else url.searchParams.set('tab',tab);
    history.replaceState({},'',url);
  }
}
const profileTabs=$$('[data-profile-tab]');
profileTabs.forEach((b,i)=>{
  b.onclick=()=>switchTab(b.dataset.profileTab);
  b.onkeydown=e=>{
    if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
    e.preventDefault();
    let next=i;
    if(e.key==='ArrowRight')next=(i-1+profileTabs.length)%profileTabs.length;
    if(e.key==='ArrowLeft')next=(i+1)%profileTabs.length;
    if(e.key==='Home')next=0;
    if(e.key==='End')next=profileTabs.length-1;
    profileTabs[next].focus();
    switchTab(profileTabs[next].dataset.profileTab);
  };
});

$('profileNameInput').addEventListener('input',updateDirtyStates);
$('studyType').addEventListener('change',updateDirtyStates);
$('studyStage').addEventListener('change',()=>updateGradeOptions(false));
$('studyGrade').addEventListener('change',updateDirtyStates);

$('accountForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('profileNameInput').value.trim(),btn=$('accountSaveBtn');
  if(name.length<2)return toast('اكتب اسمًا صحيحًا من حرفين على الأقل.','error');
  if(same(accountSnapshot(),baseline.account))return toast('لا توجد تغييرات جديدة للحفظ.','info');
  window.AcademyUI?.setButtonLoading(btn,true,'حفظ');
  try{
    await Promise.all([
      user.updateProfile({displayName:name}),
      db.ref('studentProfilesV3/'+user.uid).update({name,updatedAt:Date.now()})
    ]);
    profile.name=name;
    render();
    toast('تم تحديث اسمك بنجاح.');
  }catch(err){
    console.error(err);toast('تعذر حفظ بيانات الحساب الآن.','error');
  }finally{
    window.AcademyUI?.setButtonLoading(btn,false);
    updateDirtyStates();
  }
});

$('studyForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const btn=$('studySaveBtn'),next=studySnapshot();
  if(same(next,baseline.study))return toast('لم تغيّر المرحلة أو الصف.','info');
  const label=(gradeLabels[next.stage]?.[next.grade]||'الصف المحدد')+' • '+educationLabel(next.educationType);
  const ok=await window.AcademyUI.confirm({
    title:'تغيير المرحلة الدراسية؟',
    message:'سيتم عرض مواد '+label+' في لوحة الطالب. تقدمك القديم سيظل محفوظًا ولن يتم حذفه.',
    tone:'warning',
    acceptText:'تحديث المرحلة'
  });
  if(!ok)return;
  window.AcademyUI?.setButtonLoading(btn,true,'تحديث');
  try{
    const patch={...next,updatedAt:Date.now()};
    await db.ref('studentProfilesV3/'+user.uid).update(patch);
    Object.assign(profile,patch);
    render();
    toast('تم تحديث مرحلتك الدراسية.');
  }catch(err){
    console.error(err);toast('تعذر تحديث المرحلة الآن.','error');
  }finally{
    window.AcademyUI?.setButtonLoading(btn,false);
    updateDirtyStates();
  }
});

$('sendResetBtn').onclick=async()=>{
  const btn=$('sendResetBtn');
  if(!user?.email)return toast('لا يوجد بريد إلكتروني مرتبط بهذا الحساب.','error');
  const ok=await window.AcademyUI.confirm({
    title:'إرسال رابط إعادة التعيين؟',
    message:'سنرسل رابطًا آمنًا إلى '+user.email+' لتغيير كلمة المرور.',
    tone:'warning',
    acceptText:'إرسال الرابط'
  });
  if(!ok)return;
  window.AcademyUI?.setButtonLoading(btn,true,'إرسال');
  try{
    await auth.sendPasswordResetEmail(user.email);
    toast('تم إرسال رابط إعادة تعيين كلمة المرور.');
  }catch(err){
    console.error(err);toast('تعذر إرسال الرابط الآن. تأكد من البريد وحاول مرة أخرى.','error');
  }finally{
    window.AcademyUI?.setButtonLoading(btn,false);
  }
};

async function logout(){
  const ok=await window.AcademyUI.confirm({
    title:'تسجيل الخروج؟',
    message:'سيظل تقدمك محفوظًا في حسابك ويمكنك العودة في أي وقت.',
    tone:'warning',
    acceptText:'تسجيل الخروج'
  });
  if(!ok)return;
  try{
    await auth.signOut();
    location.replace('./index.html');
  }catch(err){
    console.error(err);toast('تعذر تسجيل الخروج الآن.','error');
  }
}
$('profileLogout').onclick=logout;
$('securityLogout').onclick=logout;

window.AcademyUI?.showPageLoading('جاري تحميل ملفك الشخصي...');
auth.onAuthStateChanged(async u=>{
  if(!u){window.AcademyUI?.hidePageLoading();location.replace('./index.html');return}
  user=u;
  try{
    const snap=await db.ref('studentProfilesV3/'+u.uid).once('value');
    profile=snap.val()||{};
    render();
    const requested=new URLSearchParams(location.search).get('tab')||'overview';
    switchTab(requested,false);
  }catch(err){
    console.error(err);
    toast('تعذر تحميل بيانات حسابك الآن.','error');
  }finally{
    window.AcademyUI?.hidePageLoading();
  }
});
})();