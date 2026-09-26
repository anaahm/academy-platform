'use strict';
const functions=require('firebase-functions');
const admin=require('firebase-admin');

admin.initializeApp();

exports.adminSetUserPassword=functions.https.onCall(async(data,context)=>{
  if(!context.auth)throw new functions.https.HttpsError('unauthenticated','يجب تسجيل دخول المدير.');
  const adminFlag=await admin.database().ref('adminProfiles/'+context.auth.uid+'/isAdmin').once('value');
  if(adminFlag.val()!==true)throw new functions.https.HttpsError('permission-denied','هذه العملية متاحة للمدير فقط.');

  const uid=String(data?.uid||'').trim();
  const password=String(data?.password||'');
  if(!uid)throw new functions.https.HttpsError('invalid-argument','معرّف الحساب مطلوب.');
  if(password.length<6||password.length>72)throw new functions.https.HttpsError('invalid-argument','كلمة المرور يجب أن تكون بين 6 و72 حرفًا.');

  try{
    await admin.auth().updateUser(uid,{password});
    await admin.database().ref('auditLogV4').push().set({
      uid:context.auth.uid,
      action:'account.password_reset',
      entity:'authUser',
      entityId:uid,
      meta:{source:'admin-pro'},
      at:Date.now(),
      createdAt:Date.now()
    });
    return{ok:true};
  }catch(error){
    console.error('adminSetUserPassword failed',error);
    throw new functions.https.HttpsError('internal','تعذر تعيين كلمة المرور الجديدة.');
  }
});
