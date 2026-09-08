import {allowedMethod,appUrl,authenticatedUser,admin,json,stripe} from './_billing.js';

export default async function handler(request,response){
  if(!allowedMethod(request,response))return;
  try{
    const user=await authenticatedUser(request);
    if(!user)return json(response,401,{error:'Sign in to manage Sips Club'});
    const {data:membership,error}=await admin().from('memberships')
      .select('provider_customer_ref').eq('user_id',user.id)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    if(!membership?.provider_customer_ref)return json(response,404,{error:'No Stripe membership was found'});
    const portal=await stripe().billingPortal.sessions.create({
      customer:membership.provider_customer_ref,
      return_url:`${appUrl()}/my-wine-journal`
    });
    return json(response,200,{url:portal.url});
  }catch(error){
    console.error('Stripe portal error',error);
    return json(response,500,{error:error.message||'Billing settings could not be opened'});
  }
}
