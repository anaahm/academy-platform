(() => {
'use strict';

const firebaseConfig = window.ACADEMY_FIREBASE_CONFIG || JSON.parse(localStorage.getItem('academyFirebaseConfig') || 'null');
if(!firebaseConfig){location.replace('./index.html');return}
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth(),db=firebase.database();
const $=id=>document.getElementById(id), $$=(s,r=document)=>[...r.querySelectorAll(s)];
let user=null,profile={};

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
  const el=$('toast');el.textContent=msg;el.className='toast show '+type;
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',3000);
}
function initials(n='طالب'){return(n.trim()[0]||'ط').toUpperCase()}
function educationLabel(t){return t==='azhar'?'التعليم الأزهري':'التعليم العام'}
function updateGradeOptions(){
  const stage=$('studyStage').value, max=stage==='primary'?6:3, current=Number(profile.grade||1);
  $('studyGrade').innerHTML=Array.from({length:max},(_,i)=>i+1).map(g=>`<option value="${g}">${gradeLabels[stage][g]}</option>`).join('');
  $('studyGrade').value=String(Math.min(current,max));
}
function render(){
  const s=profile.stats||{},name=profile.name||user.displayName||user.email.split('@')[0];
  $('profileAvatar').textContent=initials(name);$('profileNameTitle').textContent=name;
  $('profileStageTitle').textContent=(gradeLabels[profile.stage]?.[profile.grade]||'لم تحدد صفك بعد')+' • '+educationLabel(profile.educationType);
  $('profileLevel').textContent=s.level||1;$('profileXp').textContent=s.totalXP||0;
  $('profileLessons').textContent=s.completedLessons||0;$('profileQuizzes').textContent=s.completedQuizzes||0;$('profileStreak').textContent=s.streak||0;$('profileTotalXp').textContent=s.totalXP||0;
  $('profileNameInput').value=name;$('profileEmailInput').value=user.email||'';
  $('studyType').value=profile.educationType||'public';$('studyStage').value=profile.stage||'prep';updateGradeOptions();$('studyGrade').value=String(profile.grade||1);
  $('profileBadges').innerHTML=badges.map(b=>`<article class="badge-item ${b.check(profile)?'':'locked'}"><span>${b.emoji}</span><strong>${b.name}</strong><small>${b.desc}</small></article>`).join('');
  if(profile.lastLessonTitle){
    const q=new URLSearchParams({type:profile.educationType,stage:profile.stage,grade:String(profile.grade),subject:profile.lastSubjectId||'',id:profile.lastLessonId||''});
    $('lastActivity').innerHTML=`<article class="last-activity-card"><span class="section-kicker">آخر درس</span><h3>${profile.lastLessonTitle}</h3><p>${gradeLabels[profile.stage]?.[profile.grade]||''}</p><a class="btn btn-primary" href="./lesson.html?${q.toString()}">متابعة الدرس</a></article>`;
  }
}
function switchTab(tab){
  $$('[data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab===tab));
  $$('.profile-tab').forEach(s=>s.classList.add('hidden'));$('tab-'+tab).classList.remove('hidden');
}
$$('[data-profile-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.profileTab));
$('studyStage').addEventListener('change',updateGradeOptions);
$('accountForm').addEventListener('submit',async e=>{
  e.preventDefault();const name=$('profileNameInput').value.trim();if(name.length<2)return toast('اكتب اسمًا صحيحًا.','error');
  await user.updateProfile({displayName:name});await db.ref('studentProfilesV3/'+user.uid).update({name,updatedAt:Date.now()});profile.name=name;render();toast('تم تحديث الاسم بنجاح.');
});
$('studyForm').addEventListener('submit',async e=>{
  e.preventDefault();const patch={educationType:$('studyType').value,stage:$('studyStage').value,grade:Number($('studyGrade').value),updatedAt:Date.now()};
  await db.ref('studentProfilesV3/'+user.uid).update(patch);Object.assign(profile,patch);render();toast('تم تحديث مرحلتك الدراسية.');
});
$('sendResetBtn').onclick=async()=>{try{await auth.sendPasswordResetEmail(user.email);toast('تم إرسال رابط إعادة تعيين كلمة المرور.')}catch{toast('تعذر إرسال الرابط الآن.','error')}};
async function logout(){await auth.signOut();location.replace('./index.html')}
$('profileLogout').onclick=logout;$('securityLogout').onclick=logout;
$('avatarHint').onclick=()=>toast('رفع صورة شخصية هنضيفه في مرحلة التخزين لاحقًا.');
auth.onAuthStateChanged(async u=>{
  if(!u){location.replace('./index.html');return}
  user=u;const snap=await db.ref('studentProfilesV3/'+u.uid).once('value');profile=snap.val()||{};render();
});
})();