(() => {
'use strict';

const DAY=86400000;
const HOUR=3600000;

function ensureFirebase(){
  const cfg=window.ACADEMY_FIREBASE_CONFIG;
  if(!cfg)throw new Error('Firebase config missing');
  if(!firebase.apps.length)firebase.initializeApp(cfg);
  return{auth:firebase.auth(),db:firebase.database()};
}
function cleanKey(v=''){return String(v).replace(/[.#$\[\]\/]/g,'-').slice(0,180)}
function dateKey(ts){const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function matchesStudent(item,profile){
  return item?.isActive!==false && item?.isHidden!==true &&
    (!item.type||item.type===profile.educationType) &&
    (!item.stage||item.stage===profile.stage) &&
    (!item.grade||String(item.grade)===String(profile.grade));
}
function assignmentTargetMatches(item,profile,userId){
  const mode=item?.targetMode||'all';
  if(mode==='students'){
    const ids=Array.isArray(item.targetStudentIds)?item.targetStudentIds:Object.keys(item.targetStudentIds||{});
    return ids.includes(userId);
  }
  if(mode==='group'){
    const groups=Array.isArray(profile?.groupIds)?profile.groupIds:Object.keys(profile?.groupIds||{});
    return !!item.targetGroupId&&(profile?.classGroupId===item.targetGroupId||groups.includes(item.targetGroupId));
  }
  return true;
}
function nextRecurringTime(dayOfWeek,time='18:00'){
  const now=new Date(),target=new Date(now);target.setSeconds(0,0);
  const diff=(Number(dayOfWeek)-now.getDay()+7)%7;
  target.setDate(now.getDate()+diff);
  const parts=String(time||'18:00').split(':').map(Number);target.setHours(parts[0]||0,parts[1]||0,0,0);
  if(target.getTime()<now.getTime()-60000)target.setDate(target.getDate()+7);
  return target.getTime();
}
function hrefFor(kind){
  if(kind==='assignment')return'./assignments.html';
  if(kind==='live')return'./live.html';
  if(kind==='schedule')return'./schedule.html';
  if(kind==='planner')return'./planner.html';
  return'./index.html';
}
function priorityWeight(p){return p==='urgent'?3:p==='high'?2:1}

async function loadNotifications(user,profileInput){
  const {db}=ensureFirebase();
  const profile=profileInput||((await db.ref('studentProfilesV3/'+user.uid).once('value')).val()||{});
  const reads=profile.notificationReads||{};
  const [assignSnap,liveSnap,scheduleSnap,annSnap,broadcastSnap]=await Promise.all([
    db.ref('assignments').orderByChild('stage').equalTo(profile.stage).once('value'),
    db.ref('liveSessions').once('value'),
    db.ref('scheduleEvents').once('value'),
    db.ref('announcements').once('value'),
    db.ref('notificationBroadcasts').once('value')
  ]);

  const assignments=Object.entries(assignSnap.val()||{}).map(([id,v])=>({id,...(v||{})})).filter(a=>matchesStudent(a,profile)&&assignmentTargetMatches(a,profile,user.uid)&&!a.isHidden);
  const submissionSnaps=await Promise.all(assignments.map(a=>db.ref('assignmentSubmissions/'+a.id+'/'+user.uid).once('value')));
  const submissions={};assignments.forEach((a,i)=>{if(submissionSnaps[i].exists())submissions[a.id]=submissionSnaps[i].val()});

  const now=Date.now(),items=[];
  assignments.forEach(a=>{
    const s=submissions[a.id],due=Number(a.dueAt||0);
    if(s?.status==='graded'){
      const stamp=Number(s.gradedAt||s.submittedAt||a.createdAt||0);
      const key=cleanKey('assignment-graded-'+a.id+'-'+stamp);
      items.push({key,kind:'assignment',category:'academic',icon:'fa-star',tone:'green',title:'تم تصحيح واجبك',text:(a.title||'واجب')+' • '+Number(s.score||0)+' / '+Number(s.maxScore||a.maxScore||100)+(s.feedback?' • '+s.feedback:''),createdAt:stamp||now,href:hrefFor('assignment'),priority:'high',read:!!reads[key]});
      return;
    }
    if(!s&&due){
      const diff=due-now;
      if(diff<0&&diff>-7*DAY){
        const key=cleanKey('assignment-overdue-'+a.id+'-'+due);
        items.push({key,kind:'assignment',category:'academic',icon:'fa-triangle-exclamation',tone:'red',title:'موعد واجب فات',text:(a.title||'واجب')+' كان موعده '+new Date(due).toLocaleString('ar-EG'),createdAt:due,href:hrefFor('assignment'),priority:'urgent',read:!!reads[key]});
      }else if(diff>=0&&diff<=48*HOUR){
        const key=cleanKey('assignment-due-'+a.id+'-'+due);
        items.push({key,kind:'assignment',category:'academic',icon:'fa-clock',tone:'amber',title:'واجب قرب موعده',text:(a.title||'واجب')+' • متبقي '+Math.max(1,Math.ceil(diff/HOUR))+' ساعة تقريبًا',createdAt:due-48*HOUR,href:hrefFor('assignment'),priority:diff<=12*HOUR?'urgent':'high',read:!!reads[key]});
      }
    }
  });

  const live=Object.entries(liveSnap.val()||{}).map(([id,v])=>({id,...(v||{})})).filter(s=>matchesStudent(s,profile)&&s.status!=='ended');
  live.forEach(s=>{
    const at=Number(s.scheduledTime||0),isLive=s.status==='live',diff=at-now;
    if(isLive||(at&&diff>=0&&diff<=24*HOUR)){
      const key=cleanKey('live-'+s.id+'-'+(at||s.updatedAt||s.createdAt||0));
      items.push({key,kind:'live',category:'schedule',icon:'fa-tower-broadcast',tone:'violet',title:isLive?'البث مباشر الآن':'بث مباشر قريب',text:(s.title||'جلسة مباشرة')+(s.teacher?' • '+s.teacher:''),createdAt:isLive?now:at,href:hrefFor('live'),priority:isLive?'urgent':'high',read:!!reads[key]});
    }
  });

  const schedule=Object.entries(scheduleSnap.val()||{}).map(([id,v])=>({id,...(v||{})})).filter(x=>matchesStudent(x,profile));
  schedule.forEach(e=>{
    const at=nextRecurringTime(e.dayOfWeek,e.time||'18:00'),diff=at-now;
    if(diff>=0&&diff<=18*HOUR){
      const key=cleanKey('schedule-'+e.id+'-'+dateKey(at));
      items.push({key,kind:'schedule',category:'schedule',icon:'fa-calendar-day',tone:'blue',title:'عندك حصة قريبة',text:(e.title||'حصة')+' • '+new Date(at).toLocaleString('ar-EG',{weekday:'long',hour:'numeric',minute:'2-digit'}),createdAt:at,href:hrefFor('schedule'),priority:diff<=2*HOUR?'urgent':'normal',read:!!reads[key]});
    }
  });

  Object.entries(profile.studyPlanner||{}).forEach(([id,t])=>{
    if(t?.done||!t?.date)return;
    const taskDay=new Date(t.date+'T00:00:00');
    const today=new Date();today.setHours(0,0,0,0);
    if(taskDay.getTime()===today.getTime()){
      const key=cleanKey('planner-'+id+'-'+t.date);
      items.push({key,kind:'planner',category:'academic',icon:'fa-list-check',tone:'orange',title:'مهمة مذاكرة اليوم',text:t.title||'مهمة مذاكرة',createdAt:taskDay.getTime()+12*HOUR,href:hrefFor('planner'),priority:t.priority==='urgent'?'urgent':t.priority==='high'?'high':'normal',read:!!reads[key]});
    }
  });

  const ann=annSnap.val()||{};
  if(ann.isActive&&ann.text&&(!ann.expiry||now<Number(ann.expiry))){
    const stamp=Number(ann.updatedAt||ann.expiry||0);
    const key=cleanKey('announcement-'+stamp);
    items.push({key,kind:'announcement',category:'system',icon:'fa-bullhorn',tone:'blue',title:'إعلان من الأكاديمية',text:ann.text,createdAt:stamp||now,href:'./index.html',priority:'normal',read:!!reads[key]});
  }

  Object.entries(broadcastSnap.val()||{}).forEach(([id,n])=>{
    if(!n||n.isActive===false)return;
    if(n.expiresAt&&now>Number(n.expiresAt))return;
    if(n.type&&n.type!==profile.educationType)return;
    if(n.stage&&n.stage!==profile.stage)return;
    if(n.grade&&String(n.grade)!==String(profile.grade))return;
    const stamp=Number(n.createdAt||0),key=cleanKey('broadcast-'+id+'-'+stamp);
    let href='./notifications.html';
    if(n.href){
      const raw=String(n.href).trim();
      if(raw.startsWith('./')||raw.startsWith('/')||/^https?:\/\//i.test(raw))href=raw;
    }
    items.push({key,kind:'broadcast',category:'system',icon:n.priority==='urgent'?'fa-circle-exclamation':'fa-bell',tone:n.priority==='urgent'?'red':n.priority==='high'?'amber':'blue',title:n.title||'إشعار من الأكاديمية',text:n.text||'',createdAt:stamp||now,href,priority:n.priority||'normal',read:!!reads[key]});
  });

  items.sort((a,b)=>{
    const unread=(a.read?1:0)-(b.read?1:0);if(unread!==0)return unread;
    const pri=priorityWeight(b.priority)-priorityWeight(a.priority);if(pri!==0)return pri;
    return Number(b.createdAt||0)-Number(a.createdAt||0);
  });
  return{profile,items,unread:items.filter(x=>!x.read).length};
}

async function markRead(uid,key){
  const {db}=ensureFirebase();await db.ref('studentProfilesV3/'+uid+'/notificationReads/'+cleanKey(key)).set(Date.now());
}
async function markUnread(uid,key){
  const {db}=ensureFirebase();await db.ref('studentProfilesV3/'+uid+'/notificationReads/'+cleanKey(key)).remove();
}
async function markAllRead(uid,items){
  const {db}=ensureFirebase(),patch={};items.forEach(x=>{if(!x.read)patch[cleanKey(x.key)]=Date.now()});
  if(Object.keys(patch).length)await db.ref('studentProfilesV3/'+uid+'/notificationReads').update(patch);
}
window.AcademyNotifications={loadNotifications,markRead,markUnread,markAllRead};
})();
