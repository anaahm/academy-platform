(() => {
'use strict';
const C=window.AcademyCore,$=id=>document.getElementById(id),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let user,profile,community={forums:{},studyGroups:{}},tab='forums';

function posts(){return Object.entries(community.forums||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function groups(){return Object.entries(community.studyGroups||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
function likeCount(p){return Object.keys(p.likesBy||{}).length}
function memberCount(g){return Object.keys(g.members||{}).length}
function isMember(g){return !!g.members?.[user.uid]}

function render(){
 const ps=posts(),gs=groups();$('postCount').textContent=ps.length;$('groupCount').textContent=gs.length;$('myGroupCount').textContent=gs.filter(isMember).length;
 $('forumFeed').classList.toggle('hidden',tab!=='forums');$('groupsFeed').classList.toggle('hidden',tab!=='groups');$('togglePostForm').classList.toggle('hidden',tab!=='forums');
 if(tab==='forums'){
  $('forumFeed').innerHTML=ps.length?ps.map(p=>{
   const liked=!!p.likesBy?.[user.uid],reported=!!p.reports?.[user.uid];
   return '<article class="community-post"><div class="community-author"><span class="community-avatar">'+C.esc(C.initials(p.author||'طالب'))+'</span><div><strong>'+C.esc(p.author||'طالب')+'</strong><small>'+(p.createdAt?new Date(p.createdAt).toLocaleDateString('ar-EG'):'')+'</small></div></div><h3>'+C.esc(p.title||'')+'</h3><p>'+C.esc(p.content||'')+'</p><div class="community-actions"><button class="'+(liked?'liked':'')+'" data-like-post="'+p.id+'"><i class="'+(liked?'fa-solid':'fa-regular')+' fa-heart"></i> '+likeCount(p)+'</button><button data-report-post="'+p.id+'" '+(reported?'disabled':'')+'><i class="fa-regular fa-flag"></i> '+(reported?'تم الإبلاغ':'إبلاغ')+'</button></div></article>';
  }).join(''):'<div class="feature-empty"><span>💬</span><h3>لسه مفيش منشورات</h3><p>ابدأ بسؤال تعليمي أو فكرة مفيدة.</p></div>';
  $$('[data-like-post]').forEach(b=>b.onclick=()=>toggleLike(b.dataset.likePost));
  $$('[data-report-post]').forEach(b=>b.onclick=()=>reportPost(b.dataset.reportPost));
 }else{
  $('groupsFeed').innerHTML=gs.length?gs.map(g=>'<article class="community-post"><div class="feature-card-head"><div><span class="section-kicker">مجموعة دراسة</span><h3>'+C.esc(g.name||'مجموعة')+'</h3><p>'+memberCount(g)+' عضو</p></div><span class="feature-card-icon violet"><i class="fa-solid fa-users"></i></span></div><div class="feature-meta"><span>'+C.esc(g.subjectName||'كل المواد')+'</span><span>'+C.esc(g.stage?C.stageLabel(g.stage):'كل المراحل')+'</span></div><button class="btn '+(isMember(g)?'btn-soft':'btn-primary')+'" data-group-action="'+g.id+'">'+(isMember(g)?'مغادرة المجموعة':'انضم للمجموعة')+'</button></article>').join(''):'<div class="feature-empty"><span>👥</span><h3>لا توجد مجموعات بعد</h3><p>الإدارة تقدر تنشئ مجموعات دراسة منظمة.</p></div>';
  $$('[data-group-action]').forEach(b=>b.onclick=()=>toggleGroup(b.dataset.groupAction));
 }
}
async function toggleLike(id){
 const ref=C.db.ref('community/forums/'+id+'/likesBy/'+user.uid),snap=await ref.once('value');
 if(snap.exists())await ref.remove();else await ref.set(true);
}
async function reportPost(id){
 if(!(await window.AcademyUI.confirm({title:'إرسال بلاغ؟',message:'سيصل البلاغ إلى إدارة المنصة لمراجعة هذا المنشور.',tone:'warning',acceptText:'إرسال البلاغ'})))return;
 await C.db.ref('community/forums/'+id+'/reports/'+user.uid).set({createdAt:Date.now()});C.toast('تم إرسال البلاغ للإدارة.');
}
async function toggleGroup(id){
 const g=community.studyGroups?.[id]||{},ref=C.db.ref('community/studyGroups/'+id+'/members/'+user.uid);
 if(g.members?.[user.uid])await ref.remove();else await ref.set({name:profile.name||user.displayName||'طالب',joinedAt:Date.now()});
}
$('togglePostForm').onclick=()=>$('newPostForm').classList.toggle('hidden');$('cancelPost').onclick=()=>$('newPostForm').classList.add('hidden');
$('newPostForm').onsubmit=async e=>{
 e.preventDefault();const title=$('postTitle').value.trim(),content=$('postContent').value.trim();if(!title||!content)return;
 await C.db.ref('community/forums').push({title,content,author:profile.name||user.displayName||'طالب',authorId:user.uid,createdAt:Date.now(),likesBy:{}});
 e.target.reset();e.target.classList.add('hidden');C.toast('تم نشر منشورك ✨');
};
$$('[data-community-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.communityTab;$$('[data-community-tab]').forEach(x=>x.classList.toggle('active',x===b));render()});

(async()=>{
 ({user,profile}=await C.requireStudent());$('pageAvatar').textContent=C.initials(profile.name||user.displayName||'طالب');
 C.db.ref('community').on('value',s=>{community=s.val()||{forums:{},studyGroups:{}};render()});
})();
})();