<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

try {
    $cfg=academy_config();
    $origin=$_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed=$cfg['app']['cors_origins'] ?? [];
    if($origin && in_array($origin,$allowed,true)){
        header('Access-Control-Allow-Origin: '.$origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if(($_SERVER['REQUEST_METHOD'] ?? 'GET')==='OPTIONS'){http_response_code(204);exit;}

    $method=$_SERVER['REQUEST_METHOD'] ?? 'GET';
    $uri=parse_url($_SERVER['REQUEST_URI'] ?? '/',PHP_URL_PATH) ?: '/';
    $apiPos=strpos($uri,'/api');
    $route=$apiPos===false?$uri:substr($uri,$apiPos+4);
    $route='/' . trim($route,'/');

    if($route==='/health' && $method==='GET'){
        $pdo=academy_db();
        $dbVersion=$pdo->query('SELECT VERSION()')->fetchColumn();
        academy_json(['ok'=>true,'service'=>'academy-hostinger-api','version'=>ACADEMY_API_VERSION,'database'=>'connected','databaseVersion'=>$dbVersion,'time'=>gmdate('c')]);
    }

    if($route==='/auth/register' && $method==='POST'){
        academy_rate_limit('register',8,3600);$b=academy_body();
        $email=strtolower(trim((string)($b['email']??'')));$password=(string)($b['password']??'');$name=trim((string)($b['displayName']??''));
        $role=(string)($b['role']??'student');$appName=substr((string)($b['appName']??'[DEFAULT]'),0,64);
        if(!filter_var($email,FILTER_VALIDATE_EMAIL))academy_json(['ok'=>false,'error'=>'invalid_email'],422);
        if(strlen($password)<8)academy_json(['ok'=>false,'error'=>'weak_password'],422);
        if(!in_array($role,['student','teacher','parent'],true))$role='student';
        $id=academy_uuid();$pdo=academy_db();
        try{
            $st=$pdo->prepare('INSERT INTO academy_users(id,email,password_hash,display_name,primary_role,status) VALUES(?,?,?,?,?,?)');
            $status=$role==='teacher'?'pending':'active';
            $st->execute([$id,$email,password_hash($password,PASSWORD_DEFAULT),$name,$role,$status]);
        }catch(PDOException $e){
            if((string)$e->getCode()==='23000')academy_json(['ok'=>false,'error'=>'email_exists'],409);
            throw $e;
        }
        if($status!=='active'){academy_audit($id,'auth.register.pending');academy_json(['ok'=>true,'pending'=>true,'user'=>['uid'=>$id,'email'=>$email,'displayName'=>$name,'role'=>$role]],201);}
        $token=academy_token();$days=(int)($cfg['app']['session_days']??30);
        $pdo->prepare('INSERT INTO academy_sessions(user_id,app_name,token_hash,user_agent_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY))')
            ->execute([$id,$appName,academy_token_hash($token),academy_user_agent_hash(),$days]);
        academy_audit($id,'auth.register');
        academy_json(['ok'=>true,'token'=>$token,'user'=>['uid'=>$id,'email'=>$email,'displayName'=>$name,'role'=>$role]],201);
    }

    if($route==='/auth/login' && $method==='POST'){
        academy_rate_limit('login',20,900);$b=academy_body();
        $email=strtolower(trim((string)($b['email']??'')));$password=(string)($b['password']??'');$appName=substr((string)($b['appName']??'[DEFAULT]'),0,64);
        $st=academy_db()->prepare('SELECT * FROM academy_users WHERE email=? LIMIT 1');$st->execute([$email]);$u=$st->fetch();
        if(!$u || !password_verify($password,$u['password_hash']))academy_json(['ok'=>false,'error'=>'invalid_credentials'],401);
        if($u['status']!=='active')academy_json(['ok'=>false,'error'=>$u['status']==='pending'?'account_pending':'account_disabled'],403);
        $token=academy_token();$days=(int)($cfg['app']['session_days']??30);
        academy_db()->prepare('INSERT INTO academy_sessions(user_id,app_name,token_hash,user_agent_hash,expires_at) VALUES(?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY))')
            ->execute([$u['id'],$appName,academy_token_hash($token),academy_user_agent_hash(),$days]);
        academy_db()->prepare('UPDATE academy_users SET last_login_at=UTC_TIMESTAMP() WHERE id=?')->execute([$u['id']]);
        academy_audit($u['id'],'auth.login',null,['appName'=>$appName]);
        academy_json(['ok'=>true,'token'=>$token,'user'=>['uid'=>$u['id'],'email'=>$u['email'],'displayName'=>$u['display_name'],'role'=>$u['primary_role']]]);
    }

    if($route==='/auth/me' && $method==='GET'){
        $u=academy_current_user(true);
        academy_json(['ok'=>true,'user'=>['uid'=>$u['id'],'email'=>$u['email'],'displayName'=>$u['display_name'],'role'=>$u['primary_role'],'appName'=>$u['app_name']]]);
    }

    if($route==='/auth/logout' && $method==='POST'){
        $u=academy_current_user(false);$token=academy_bearer();
        if($token)academy_db()->prepare('UPDATE academy_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=?')->execute([academy_token_hash($token)]);
        if($u)academy_audit($u['id'],'auth.logout');
        academy_json(['ok'=>true]);
    }

    if($route==='/auth/profile' && $method==='PATCH'){
        $u=academy_current_user(true);$b=academy_body();$name=trim((string)($b['displayName']??''));
        if($name==='')academy_json(['ok'=>false,'error'=>'display_name_required'],422);
        academy_db()->prepare('UPDATE academy_users SET display_name=? WHERE id=?')->execute([$name,$u['id']]);
        academy_audit($u['id'],'auth.profile.update');
        academy_json(['ok'=>true,'user'=>['uid'=>$u['id'],'email'=>$u['email'],'displayName'=>$name,'role'=>$u['primary_role']]]);
    }

    if($route==='/auth/password' && $method==='PATCH'){
        academy_rate_limit('password',10,3600);$u=academy_current_user(true);$b=academy_body();
        $old=(string)($b['oldPassword']??'');$new=(string)($b['newPassword']??'');
        $st=academy_db()->prepare('SELECT password_hash FROM academy_users WHERE id=?');$st->execute([$u['id']]);$hash=(string)$st->fetchColumn();
        if(!password_verify($old,$hash))academy_json(['ok'=>false,'error'=>'wrong_password'],401);
        if(strlen($new)<8)academy_json(['ok'=>false,'error'=>'weak_password'],422);
        academy_db()->prepare('UPDATE academy_users SET password_hash=? WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$u['id']]);
        academy_db()->prepare('UPDATE academy_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND token_hash<>?')->execute([$u['id'],academy_token_hash(academy_bearer()??'')]);
        academy_audit($u['id'],'auth.password.change');academy_json(['ok'=>true]);
    }

    if($route==='/data'){
        $path=academy_path((string)($_GET['path']??(academy_body()['path']??'')));
        $u=academy_current_user(false);
        if(!academy_role_allows($u,$method,$path))academy_json(['ok'=>false,'error'=>$u?'forbidden':'auth_required'], $u?403:401);
        if($method==='GET')academy_json(['ok'=>true,'path'=>$path,'value'=>academy_read_node($path)]);
        $body=academy_body();$value=$body['value']??null;$uid=$u['id']??null;
        if($method==='PUT'){
            academy_write_node($path,$value,$uid);academy_audit($uid,'data.set',$path);academy_json(['ok'=>true,'path'=>$path,'value'=>$value]);
        }
        if($method==='PATCH'){
            if(!is_array($value))academy_json(['ok'=>false,'error'=>'object_required'],422);
            $current=academy_read_node($path);if(!is_array($current))$current=[];
            foreach($value as $k=>$v)$current[(string)$k]=$v;
            academy_write_node($path,$current,$uid);academy_audit($uid,'data.update',$path,['keys'=>array_keys($value)]);academy_json(['ok'=>true,'path'=>$path,'value'=>$current]);
        }
        if($method==='DELETE'){
            academy_write_node($path,null,$uid);academy_audit($uid,'data.remove',$path);academy_json(['ok'=>true,'path'=>$path]);
        }
    }

    if($route==='/data/push' && $method==='POST'){
        $u=academy_current_user(true);$b=academy_body();$path=academy_path((string)($b['path']??''));
        if(!academy_role_allows($u,'POST',$path))academy_json(['ok'=>false,'error'=>'forbidden'],403);
        $key='h'.base_convert((string)round(microtime(true)*1000),10,36).bin2hex(random_bytes(5));
        $child=$path===''?$key:$path.'/'.$key;academy_write_node($child,$b['value']??null,$u['id']);academy_audit($u['id'],'data.push',$child);
        academy_json(['ok'=>true,'key'=>$key,'path'=>$child,'value'=>$b['value']??null],201);
    }

    academy_json(['ok'=>false,'error'=>'not_found','route'=>$route],404);
} catch(Throwable $e) {
    error_log('[academy-api] '.$e->getMessage());
    $env='production';
    try{$env=academy_config()['app']['environment']??'production';}catch(Throwable){}
    academy_json(['ok'=>false,'error'=>'server_error'] + ($env==='development'?['detail'=>$e->getMessage()]:[]),500);
}
