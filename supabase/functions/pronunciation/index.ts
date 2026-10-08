import {createClient} from "npm:@supabase/supabase-js@2.117.3";
import {Redis} from "npm:@upstash/redis@1.39.0";
import {Ratelimit} from "npm:@upstash/ratelimit@2.2.0";
const max=5242880;
Deno.serve(async(request:Request)=>{
 const origin=Deno.env.get("SITE_URL");const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":origin||"","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
 const respond=(body:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return respond({error:"طلب غير مسموح"},405);
 try{
 const redisUrl=Deno.env.get("UPSTASH_REDIS_REST_URL"),redisToken=Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
 // TODO (manual): configure Redis and SITE_URL with supabase secrets set.
 if(!redisUrl||!redisToken||!origin)return respond({error:"الخدمة قيد الإعداد"},503);
 const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:request.headers.get("Authorization")||""}},auth:{persistSession:false}});
 const {data:{user},error}=await userClient.auth.getUser();
 const limiter=new Ratelimit({redis:new Redis({url:redisUrl,token:redisToken}),limiter:Ratelimit.slidingWindow(10,"1 m"),prefix:"lissan:edge:recording"});const key=user?.id||request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";const limited=await limiter.limit(key);
 if(!limited.success){const retry=Math.max(1,Math.ceil((limited.reset-Date.now())/1000));return respond({error:`محاولات كثيرة. حاول بعد ${retry} ثانية.`},429,{"Retry-After":String(retry)});}
 if(error||!user)return respond({error:"سجل الدخول أولاً"},401);
 if(Number(request.headers.get("content-length"))>5300000)return respond({error:"التسجيل أكبر من 5 MB"},413);
 const form=await request.formData();const audio=form.get("audio");if(!(audio instanceof File)||audio.size===0||audio.size>max)return respond({error:"تسجيل غير صالح"},400);
 const bytes=new Uint8Array(await audio.arrayBuffer());const mime=audio.type.split(";")[0];const webm=bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;const mp4=new TextDecoder().decode(bytes.slice(4,8))==="ftyp";const ogg=new TextDecoder().decode(bytes.slice(0,4))==="OggS";
 if(!((mime==="audio/webm"&&webm)||(mime==="audio/mp4"&&mp4)||(mime==="audio/ogg"&&ogg)))return respond({error:"صيغة الصوت غير مدعومة"},400);
 const ext=mime==="audio/mp4"?"m4a":mime==="audio/ogg"?"ogg":"webm";const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});const {error:uploadError}=await admin.storage.from("user-recordings").upload(path,bytes,{contentType:mime,upsert:false});if(uploadError)return respond({error:"تعذر حفظ التسجيل"},400);
 // This records audio only. No fabricated phonetic score is returned.
 return respond({path,saved:true});
 }catch{return respond({error:"تعذر إتمام الطلب. حاول لاحقاً."},503);}
});
