import React,{useEffect,useState} from 'react';
import {CalendarDays,Check,ChevronRight,Gift,LockKeyhole,Sparkles,Wine} from 'lucide-react';
import {supabase} from './lib/supabase';
import './sips-club.css';

const apiRequest=async(path,session,body={})=>{
  const response=await fetch(path,{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Billing request failed');
  return data;
};

export default function SipsClubCard({session,openAuth,flash}){
  const [membership,setMembership]=useState(null);
  const [corks,setCorks]=useState(0);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(!session){setMembership(null);setCorks(0);return}
    let current=true;
    Promise.all([
      supabase.from('memberships').select('status,current_period_end,cancel_at_period_end,plan:membership_plans(name,code,price_cents)').eq('user_id',session.user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.rpc('my_corks_balance')
    ]).then(([membershipResult,corksResult])=>{
      if(!current)return;
      if(!membershipResult.error)setMembership(membershipResult.data);
      if(!corksResult.error)setCorks(corksResult.data||0);
    });
    return()=>{current=false};
  },[session?.user?.id]);

  const active=['active','trialing'].includes(membership?.status);
  const openBilling=async(mode)=>{
    if(!session){openAuth();flash('Create your free Sips account first');return}
    setBusy(true);
    try{
      const data=await apiRequest(
        mode==='portal'?'/api/create-portal-session':'/api/create-checkout-session',
        session,
        {planCode:'sips-club-founding'}
      );
      location.assign(data.url);
    }catch(error){flash(error.message)}finally{setBusy(false)}
  };

  return <section className={`clubCard ${active?'clubActive':''}`}>
    <div className="clubCardTop"><span><Sparkles/></span><div><small>{active?'YOUR MEMBERSHIP':'SIPS CLUB'}</small><h2>{active?'Your wine journey, upgraded.':'Remember every bottle worth another sip.'}</h2></div></div>
    {active?<>
      <div className="clubBalance"><div><strong>{corks}</strong><span>Corks earned</span></div><div><strong>{membership.plan?.name||'Sips Club'}</strong><span>{membership.cancel_at_period_end?'Ends after this billing period':'Active membership'}</span></div></div>
      <div className="clubBenefits"><span><Wine/>5-Sip Cellar</span><span><CalendarDays/>Purchase reminders</span><span><Gift/>Verified-visit rewards</span></div>
      <button onClick={()=>openBilling('portal')} disabled={busy}>{busy?'Opening…':'Manage membership'}<ChevronRight/></button>
    </>:<>
      <p>Start free, then unlock your private 5-Sip Cellar, bottle reminders, direct winery links and Corks from verified visits.</p>
      <div className="clubBenefits"><span><Check/>Keep every 5-Sip favorite</span><span><Check/>Set buy-again reminders</span><span><Check/>Earn Corks without changing honest ratings</span></div>
      <div className="clubPrice"><strong>$4.99</strong><span>/ month<br/><small>founding-member rate</small></span></div>
      <button onClick={()=>openBilling('checkout')} disabled={busy}>{busy?'Opening secure checkout…':'Join Sips Club'}<ChevronRight/></button>
      <em><LockKeyhole/>Secure checkout and subscription management are provided by Stripe.</em>
    </>}
  </section>;
}
