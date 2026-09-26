(function verifyCertificate(){
'use strict';
if(!window.firebase)return;
const app=firebase.apps[0]||firebase.initializeApp(window.ACADEMY_FIREBASE_CONFIG),db=app.database(),$=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function lookup(code){
 code=String(code||'').trim().toUpperCase();const box=$('verifyResult');box.classList.remove('pro-section-hidden');
 if(!code){box.innerHTML='<div class="pro-empty">أدخل رقم الشهادة أولًا.</div>';return}
 box.innerHTML='<div class="pro-empty">جاري الفحص...</div>';
 try{
  const snap=await db.ref('certificateRegistry/'+code).once('value'),x=snap.val();
  if(!x){box.innerHTML='<div class="pro-empty"><h2>لم نجد شهادة بهذا الرقم</h2><p>راجع الرقم المكتوب في الشهادة وحاول مرة أخرى.</p></div>';return}
  box.innerHTML='<div class="pro-panel-head"><div><span class="pro-badge approved">سجل موجود</span><h2>'+esc(x.studentName||'طالب الأكاديمية')+'</h2><p>شهادة إتمام مادة '+esc(x.subjectName||x.subject||'')+'</p></div><div class="pro-code">'+esc(code)+'</div></div><div class="pro-kpi-grid"><article class="pro-kpi"><strong>'+esc(x.gradeLabel||x.grade||'—')+'</strong><span>الصف</span></article><article class="pro-kpi"><strong>'+esc(x.typeLabel||x.type||'—')+'</strong><span>نوع التعليم</span></article><article class="pro-kpi"><strong>'+new Date(Number(x.completedAt||x.issuedAt||Date.now())).toLocaleDateString('ar-EG')+'</strong><span>تاريخ الإتمام</span></article><article class="pro-kpi"><strong>'+new Date(Number(x.issuedAt||Date.now())).toLocaleDateString('ar-EG')+'</strong><span>تاريخ التسجيل</span></article></div>';
 }catch(err){console.error(err);box.innerHTML='<div class="pro-empty">تعذر فحص السجل الآن. حاول مرة أخرى.</div>'}
}
$('verifyForm').onsubmit=e=>{e.preventDefault();lookup($('verifyCode').value)};
const q=new URLSearchParams(location.search).get('code');if(q){$('verifyCode').value=q;lookup(q)}
})();