import {mkdir,readFile,writeFile} from 'node:fs/promises';

const origin='https://sipswinejourney.com';
const pages={
  'trip-planner':{
    title:'Finger Lakes Wine Trip Planner | Sips Wine Tasting Journey',
    description:'Build a Finger Lakes winery itinerary, organize stops, and share your wine trip with friends.'
  },
  'wine-tasting':{
    title:'Rate a Finger Lakes Wine Tasting | Sips Wine Tasting Journey',
    description:'Rate every wine with One Sip’s practical five-level scale and save the bottles you want to buy again.'
  },
  'shared-tastings':{
    title:'Shared Wine Tastings With Friends | Sips Wine Tasting Journey',
    description:'Compare wine ratings with friends, find group favorites, and create a shareable Finger Lakes trip recap.'
  },
  'my-wine-journal':{
    title:'Your Wine Journal & Tasting History | Sips Wine Tasting Journey',
    description:'Save wines, wineries, tasting notes, past routes, and personalized Finger Lakes wine recommendations.'
  },
  'for-wineries':{
    title:'Sips for Finger Lakes Wineries | Tasting Menus & Traveler Insights',
    description:'See how Sips helps Finger Lakes wineries publish tasting menus, reach trip planners, and connect favorite wines to future purchases.'
  },
  'winery-login':{
    title:'Claim Your Finger Lakes Winery | Sips',
    description:'Claim a Finger Lakes winery profile and request secure access to publish current tasting menus on Sips.'
  },
  'winery-dashboard':{
    title:'Winery Tasting Menu Dashboard | Sips',
    description:'Securely upload, edit, preview, and publish winery tasting menus on Sips.',
    robots:'noindex, nofollow'
  }
};
const base=await readFile('index.html','utf8');
for(const [path,page] of Object.entries(pages)){
  const html=base
    .replace(/<title>.*?<\/title>/,`<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\/>/,`<meta name="description" content="${page.description}"/>`)
    .replace(/<meta property="og:title" content="[^"]*"\/>/,`<meta property="og:title" content="${page.title}"/>`)
    .replace(/<meta property="og:description" content="[^"]*"\/>/,`<meta property="og:description" content="${page.description}"/>`)
    .replace(/<meta name="robots" content="[^"]*"\/>/,`<meta name="robots" content="${page.robots||'index, follow, max-image-preview:large'}"/>`)
    .replace(/<link rel="canonical" href="[^"]*"\/>/,`<link rel="canonical" href="${origin}/${path}"/>`);
  await mkdir(path,{recursive:true});
  await writeFile(`${path}/index.html`,html);
}
