import {allowedMethod,appUrl,authenticatedUser,admin,json,stripe} from './_billing.js';

export default async function handler(request,response){
  if(!allowedMethod(request,response))return;
  try{
    const user=await authenticatedUser(request);
    if(!user)return json(response,401,{error:'Sign in to join Sips Club'});

    const planCode=request.body?.planCode==='sips-club-monthly'
      ?'sips-club-monthly'
      :'sips-club-founding';
    const priceId=planCode==='sips-club-monthly'
      ?process.env.STRIPE_SIPS_CLUB_MONTHLY_PRICE_ID
      :process.env.STRIPE_SIPS_CLUB_FOUNDING_PRICE_ID;
    if(!priceId)throw new Error(`Stripe price is not configured for ${planCode}`);

    const database=admin();
    const {data:membership}=await database.from('memberships')
      .select('provider_customer_ref,status').eq('user_id',user.id)
      .order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(['active','trialing'].includes(membership?.status)){
      return json(response,409,{error:'Your Sips Club membership is already active'});
    }

    const checkout=await stripe().checkout.sessions.create({
      mode:'subscription',
      customer:membership?.provider_customer_ref||undefined,
      customer_email:membership?.provider_customer_ref?undefined:user.email,
      client_reference_id:user.id,
      line_items:[{price:priceId,quantity:1}],
      allow_promotion_codes:true,
      success_url:`${appUrl()}/my-wine-journal?checkout=success`,
      cancel_url:`${appUrl()}/my-wine-journal?checkout=cancelled`,
      metadata:{sips_user_id:user.id,sips_plan_code:planCode},
      subscription_data:{metadata:{sips_user_id:user.id,sips_plan_code:planCode}}
    });
    return json(response,200,{url:checkout.url});
  }catch(error){
    console.error('Stripe checkout error',error);
    return json(response,500,{error:error.message||'Checkout could not be started'});
  }
}
