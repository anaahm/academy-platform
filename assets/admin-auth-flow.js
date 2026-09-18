(() => {
'use strict';
if(!window.firebase || !firebase.auth || !firebase.database)return;
const cfg=window.ACADEMY_FIREBASE_CONFIG;
if(cfg && !firebase.apps.length)firebase.initializeApp(cfg);
const auth=firebase.auth(),db=firebase.database();
const form=document.getElementById('adminLoginForm');
const email=document.getElementById('adminEmail');
const password=document.getElementById('adminPassword');
const button=document.getElementById('adminLoginBtn');
const login=document.getElementById('adminLogin');
const app=document.getElementById('adminApp');
const toastEl=document.getElementById('toast');

function notify(msg,type='success'){
  if(!toastEl){alert(msg);return}
  toastEl.textContent=msg;toastEl.className='toast show '+type;
  clearTimeout(notify.t);notify.t=setTimeout(()=>toastEl.className='toast',3500);
}
function messageFor(error){
  const code=error?.code||'';
  const map={
    'auth/invalid-email':'صيغة البريد الإلكتروني غير صحيحة.',
    'auth/user-not-found':'لا يوجد حساب بهذا البريد.',
    'auth/wrong-password':'كلمة المرور غير صحيحة.',
    'auth/invalid-login-credentials':'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    'auth/too-many-requests':'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
    'auth/network-request-failed':'تعذر الاتصال بالإنترنت.'
  };
  return map[code]||error?.message||'تعذر تسجيل الدخول.';
}
async function isAdmin(user){
  const snap=await db.ref('adminProfiles/'+user.uid).once('value');
  return snap.val()?.isAdmin===true;
}
async function showForUser(user){
  if(!user){app?.classList.add('hidden');login?.classList.remove('hidden');return false}
  try{
    const ok=await isAdmin(user);
    if(!ok){
      notify('هذا الحساب ليس له صلاحية مدير.','error');
      await auth.signOut();
      return false;
    }
    login?.classList.add('hidden');app?.classList.remove('hidden');
    return true;
  }catch(err){
    console.error('Admin permission check failed',err);
    notify('تعذر التحقق من صلاحية الإدارة. راجع اتصال Firebase وقواعد قاعدة البيانات.','error');
    return false;
  }
}
if(form && form.dataset.adminAuthBound!=='true'){
  form.dataset.adminAuthBound='true';
  form.setAttribute('novalidate','novalidate');
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopPropagation();
    const mail=(email?.value||'').trim(),pass=password?.value||'';
    if(!mail){notify('اكتب البريد الإلكتروني.','error');email?.focus();return}
    if(!pass){notify('اكتب كلمة المرور.','error');password?.focus();return}
    if(button){button.disabled=true;button.textContent='جاري التحقق...'}
    try{
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const cred=await auth.signInWithEmailAndPassword(mail,pass);
      const ok=await showForUser(cred.user);
      if(ok)notify('تم تسجيل دخول الإدارة بنجاح ✅');
    }catch(err){
      console.error('Admin login failed',err);
      notify(messageFor(err),'error');
    }finally{
      if(button){button.disabled=false;button.textContent='دخول لوحة الإدارة'}
    }
  },true);
}
auth.onAuthStateChanged(user=>{showForUser(user)});
})();