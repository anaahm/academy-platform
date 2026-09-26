(function parentPortal(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0],auth=app.auth(),db=app.database(),$=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const stageNames={primary:'الابتدائية',prep:'الإعدادية',sec:'الثانوية'};
let user=null;
function toast(msg,type='success'){const el=$('toast');el.textContent=msg;el.className='toast show '+type;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2800)}
function fmt(ts){return ts?new Date(ts).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}):'—'}
function render(snapshot){
 if(!snapshot){$('parentReport').classList.add('pro-section-hidden');return toast('الكود غير صحيح أو لم يتم تحديثه بعد.','error')}
 $('parentReport').classList.remove('pro-section-hidden');$('parentStudentName').textContent='تقرير '+(snapshot.studentName||'الطالب');$('parentContext').textContent=(snapshot.educationType==='azhar'?'تعليم أزهري':'تعليم عام')+' • المرحلة '+(stageNames[snapshot.stage]||snapshot.stage||'')+' • الصف '+(snapshot.grade||'');$('parentUpdatedAt').textContent=fmt(snapshot.updatedAt);
 const s=snapshot.stats||{},w=snapshot.weekly||{};
 $('parentStats').innerHTML='<article class="pro-kpi"><strong>'+Number(s.completedLessons||0)+'</strong><span>درس مكتمل</span></article><article class="pro-kpi"><strong>'+Number(s.completedQuizzes||0)+'</strong><span>اختبار مكتمل</span></article><article class="pro-kpi"><strong>'+Number(s.totalXP||0)+'</strong><span>XP</span></article><article class="pro-kpi"><strong>'+Number(s.streak||0)+'</strong><span>أيام متتالية</span></article>';
 const subjects=Object.entries(snapshot.subjects||{}).sort((a,b)=>Number(b[1].mastery||0)-Number(a[1].mastery||0));
 $('parentSubjects').innerHTML=subjects.length?subjects.map(([name,x])=>'<div class="pro-list-item"><div><h4>'+esc(name)+'</h4><p>'+Number(x.mastered||0)+' متقن من '+Number(x.lessons||0)+' درس • '+Number(x.errors||0)+' خطأ معلق</p></div><span class="pro-mastery-pill '+(x.mastery>=85?'mastered':x.mastery>=60?'learning':'review')+'">'+Number(x.mastery||0)+'%</span></div>').join(''):'<div class="pro-empty">لا توجد بيانات مواد بعد.</div>';
 const alerts=Object.values(snapshot.alerts||{});
 $('parentAlerts').innerHTML=alerts.length?alerts.map(a=>'<div class="pro-list-item"><div><h4>'+(a.type==='inactive'?'متابعة النشاط':a.type==='weak'?'مادة تحتاج دعمًا':'مراجعة مستحقة')+'</h4><p>'+esc(a.text||'')+'</p></div><span class="pro-badge pending">تنبيه</span></div>').join(''):'<div class="pro-empty">لا توجد تنبيهات مهمة حاليًا ✅</div>';
 const delta=Number(w.delta||0);$('parentWeekly').innerHTML='<div class="pro-kpi-grid"><article class="pro-kpi"><strong>'+Number(w.current||0)+'%</strong><span>متوسط هذا الأسبوع</span></article><article class="pro-kpi"><strong>'+Number(w.previous||0)+'%</strong><span>الأسبوع السابق</span></article><article class="pro-kpi"><strong>'+(delta>0?'+':'')+delta+'%</strong><span>التغير</span></article><article class="pro-kpi"><strong>'+Number(w.count||0)+'</strong><span>اختبارات هذا الأسبوع</span></article></div>';
}
async function lookup(code){
 code=String(code||'').trim().toUpperCase();if(!/^[A-Z2-9]{8}$/.test(code))return toast('أدخل كود متابعة مكوّنًا من 8 رموز.','error');
 try{const snap=await db.ref('parentSnapshots/'+code).once('value');render(snap.val());if(snap.exists())localStorage.setItem('academyParentCode',code)}catch(err){console.error(err);toast('تعذر فتح التقرير الآن.','error')}
}
$('parentLookupForm').onsubmit=e=>{e.preventDefault();lookup($('parentCodeInput').value)};
$('generateParentCode').onclick=async()=>{
 if(!user)return toast('سجّل دخول الطالب أولًا لإنشاء كود.','error');
 try{
  const code=window.AcademyPro?await window.AcademyPro.ensureParentCode():'';
  if(!code)return toast('تعذر إنشاء الكود.','error');
  if(window.AcademyPro)await window.AcademyPro.syncDerived();
  $('parentCodeBox').innerHTML='<div><small>كود ولي الأمر</small><div class="pro-code">'+esc(code)+'</div><p>شارك هذا الكود فقط مع ولي الأمر.</p><button class="pro-btn secondary" id="copyParentCode">نسخ الكود</button></div>';
  document.getElementById('copyParentCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('تم نسخ الكود')}catch{toast('الكود: '+code)}};
 }catch(err){console.error(err);toast('تعذر إنشاء كود المتابعة.','error')}
};
auth.onAuthStateChanged(async u=>{
 user=u||null;
 const setup=new URLSearchParams(location.search).get('setup')==='1';
 if(u&&setup){
  $('studentParentSetup').classList.remove('pro-section-hidden');
  try{
   const p=await db.ref('studentProfilesV3/'+u.uid).once('value'),code=p.val()?.parentCode;
   if(code){
    $('parentCodeBox').innerHTML='<div><small>كود ولي الأمر</small><div class="pro-code">'+esc(code)+'</div><p>التقرير يتحدث تلقائيًا من تقدمك داخل الأكاديمية.</p><button class="pro-btn secondary" id="copyExistingCode">نسخ الكود</button></div>';
    document.getElementById('copyExistingCode').onclick=()=>navigator.clipboard?.writeText(code).then(()=>toast('تم نسخ الكود')).catch(()=>toast('الكود: '+code));
   }
  }catch(err){console.warn(err)}
 }
 const saved=localStorage.getItem('academyParentCode');if(saved&&!setup){$('parentCodeInput').value=saved;lookup(saved)}
});
})();