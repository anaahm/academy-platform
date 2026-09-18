(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),params=new URLSearchParams(location.search);
(async()=>{
 try{
  const {user,profile}=await C.requireStudent();
  const type=params.get('type')||profile.educationType,stage=params.get('stage')||profile.stage,grade=params.get('grade')||String(profile.grade),subject=params.get('subject');
  if(!subject)throw new Error('missing');
  const pct=Number(profile.subjectProgress?.[subject]||0);
  if(pct<100){$('certificateLoading').classList.add('hidden');$('certificateDenied').classList.remove('hidden');return}
  const s=await C.db.ref('customSubjects').once('value'),data={customSubjects:s.val()||{}};
  const subjectName=C.subjectName(data,subject,stage,String(grade),type);
  const completedDates=Object.values(profile.learningProgress||{}).filter(x=>x?.subject===subject&&x.completedAt).map(x=>Number(x.completedAt));
  const completedAt=completedDates.length?Math.max(...completedDates):Date.now();
  $('certificateStudent').textContent=profile.name||user.displayName||'طالب الأكاديمية';
  $('certificateSubject').textContent=subjectName;
  $('certificateGrade').textContent=C.gradeLabel(stage,grade)||C.stageLabel(stage);
  $('certificateType').textContent=C.typeLabel(type);
  $('certificateDate').textContent=new Date(completedAt).toLocaleDateString('ar-EG',{day:'numeric',month:'long',year:'numeric'});
  $('certificateCode').textContent='ACA-'+user.uid.slice(0,6).toUpperCase()+'-'+subject.toUpperCase()+'-'+String(completedAt).slice(-6);
  $('certificateLoading').classList.add('hidden');$('certificateApp').classList.remove('hidden');
  $('printCertificate').onclick=()=>window.print();
 }catch(e){
  $('certificateLoading').classList.add('hidden');$('certificateDenied').classList.remove('hidden');
 }
})();
})();