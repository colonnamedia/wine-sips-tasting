import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';

const required=name=>{
  const value=process.env[name];
  if(!value)throw new Error(`${name} is not configured`);
  return value;
};

export const stripe=()=>new Stripe(required('STRIPE_SECRET_KEY'));
export const admin=()=>createClient(
  required('SUPABASE_URL'),
  process.env.SUPABASE_SECRET_KEY||required('SUPABASE_SERVICE_ROLE_KEY'),
  {auth:{persistSession:false,autoRefreshToken:false}}
);

export const appUrl=()=>process.env.APP_URL||'https://sipswinejourney.com';

export async function authenticatedUser(request){
  const token=request.headers.authorization?.replace(/^Bearer\s+/i,'');
  if(!token)return null;
  const {data,error}=await admin().auth.getUser(token);
  if(error)return null;
  return data.user;
}

export function json(response,status,payload){
  response.status(status).setHeader('Content-Type','application/json');
  response.setHeader('Cache-Control','no-store');
  response.end(JSON.stringify(payload));
}

export function allowedMethod(request,response,method='POST'){
  if(request.method===method)return true;
  response.setHeader('Allow',method);
  json(response,405,{error:'Method not allowed'});
  return false;
}

export async function readRawBody(request){
  const chunks=[];
  for await (const chunk of request)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export const membershipStatus=status=>({
  trialing:'trialing',active:'active',past_due:'past_due',canceled:'cancelled',unpaid:'past_due'
}[status]||'inactive');

export async function syncSubscription(subscription,customerEmail){
  const database=admin();
  const userId=subscription.metadata?.sips_user_id;
  const planCode=subscription.metadata?.sips_plan_code||'sips-club-founding';
  const billingItem=subscription.items?.data?.[0];
  if(!userId)return;

  const {data:plan,error:planError}=await database
    .from('membership_plans').select('id').eq('code',planCode).single();
  if(planError)throw planError;

  const values={
    user_id:userId,
    plan_id:plan.id,
    status:membershipStatus(subscription.status),
    provider:'stripe',
    provider_customer_ref:String(subscription.customer),
    provider_subscription_ref:subscription.id,
    current_period_start:billingItem?.current_period_start?new Date(billingItem.current_period_start*1000).toISOString():null,
    current_period_end:billingItem?.current_period_end?new Date(billingItem.current_period_end*1000).toISOString():null,
    cancel_at_period_end:Boolean(subscription.cancel_at_period_end),
    updated_at:new Date().toISOString()
  };

  const {data:existing}=await database.from('memberships').select('id')
    .eq('user_id',userId).order('updated_at',{ascending:false}).limit(1).maybeSingle();
  const result=existing
    ?await database.from('memberships').update(values).eq('id',existing.id)
    :await database.from('memberships').insert(values);
  if(result.error)throw result.error;

  if(customerEmail){
    await database.from('profiles').update({updated_at:new Date().toISOString()}).eq('id',userId);
  }
}
