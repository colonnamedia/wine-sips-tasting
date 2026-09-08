import {admin,json,readRawBody,stripe,syncSubscription} from './_billing.js';

export const config={api:{bodyParser:false}};

export default async function handler(request,response){
  if(request.method!=='POST'){
    response.setHeader('Allow','POST');
    return json(response,405,{error:'Method not allowed'});
  }
  try{
    const signature=request.headers['stripe-signature'];
    const payload=await readRawBody(request);
    const event=stripe().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if(event.type==='checkout.session.completed'){
      const session=event.data.object;
      if(typeof session.subscription==='string'){
        const subscription=await stripe().subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription,session.customer_details?.email);
      }
    }

    if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
      await syncSubscription(event.data.object);
    }

    return json(response,200,{received:true});
  }catch(error){
    console.error('Stripe webhook error',error);
    return json(response,400,{error:'Webhook signature or payload was invalid'});
  }
}
