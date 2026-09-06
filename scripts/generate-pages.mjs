import {mkdir,readFile,writeFile} from 'node:fs/promises';

const origin='https://wine-sips-tasting.vercel.app';
const pages={
  'trip-planner':{
    title:'Finger Lakes Wine Trip Planner | One Sip',
    description:'Build a Finger Lakes winery itinerary, organize stops, and share your wine trip with friends.'
  },
  'wine-tasting':{
    title:'Rate a Finger Lakes Wine Tasting | One Sip',
    description:'Rate every wine with One Sip’s practical five-level scale and save the bottles you want to buy again.'
  },
  'shared-tastings':{
    title:'Shared Wine Tastings With Friends | One Sip',
    description:'Compare wine ratings with friends, find group favorites, and create a shareable Finger Lakes trip recap.'
  },
  'my-wine-journal':{
    title:'Your Wine Journal & Tasting History | One Sip',
    description:'Save wines, wineries, tasting notes, past routes, and personalized Finger Lakes wine recommendations.'
  }
};
const base=await readFile('index.html','utf8');
for(const [path,page] of Object.entries(pages)){
  const html=base
    .replace(/<title>.*?<\/title>/,`<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*"\/>/,`<meta name="description" content="${page.description}"/>`)
    .replace(/<meta property="og:title" content="[^"]*"\/>/,`<meta property="og:title" content="${page.title}"/>`)
    .replace(/<meta property="og:description" content="[^"]*"\/>/,`<meta property="og:description" content="${page.description}"/>`)
    .replace(/<link rel="canonical" href="[^"]*"\/>/,`<link rel="canonical" href="${origin}/${path}"/>`);
  await mkdir(path,{recursive:true});
  await writeFile(`${path}/index.html`,html);
}
