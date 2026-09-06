import {writeFile} from 'node:fs/promises';

const endpoint='https://data.ny.gov/resource/tyci-urth.json?$limit=50000';
const counties=new Set(['ONTARIO','YATES','SENECA','SCHUYLER','TOMPKINS','CAYUGA','STEUBEN']);
const ignored=/CIDER|DISTILL|BREW|WINE CENTER|WINE SHOP|LOCAL FARE|NEW YORK KITCHEN|VITICULTURE AND WINE TECHNOLOGY|VINEYARD VILLAS|BED & BREAKFAST/i;
const response=await fetch(endpoint);
if(!response.ok) throw new Error(`NYS Open Data returned ${response.status}`);
const rows=await response.json();

const cleanName=value=>value
  .replace(/;.*$/,'')
  .replace(/\b(INC|LLC|LTD|CORP|CORPORATION)\b\.?/gi,'')
  .replace(/\s+/g,' ')
  .replace(/\s+,/g,',')
  .trim()
  .toLowerCase()
  .replace(/\b\w/g,letter=>letter.toUpperCase())
  .replace(/\bAnd\b/g,'&')
  .replace(/Mcc/g,'McC')
  .replace(/J Wiemer/g,'J. Wiemer')
  .replace(/D Frank/g,'D. Frank');
const key=value=>value.toLowerCase().replace(/\b(the|winery|vineyards?|wine|cellars?|estate|company|co|farm|and)\b/g,'').replace(/[^a-z0-9]/g,'');
const lakeFor=({county,premise_city=''})=>{
  if(county==='ONTARIO') return 'Canandaigua Lake';
  if(county==='CAYUGA'||county==='TOMPKINS') return 'Cayuga Lake';
  if(county==='SENECA'||county==='SCHUYLER') return 'Seneca Lake';
  if(county==='STEUBEN') return 'Keuka Lake';
  return /DUNDEE|HIMROD|ROCK STREAM/i.test(premise_city)?'Seneca Lake':'Keuka Lake';
};
const records=new Map();
for(const row of rows){
  if(!counties.has(row.county)||!/WINERY/i.test(row.method_of_operation||'')) continue;
  const raw=row.dba||row.premise_name||'';
  if(!raw||ignored.test(raw)) continue;
  const normalized=key(raw);
  if(!normalized||records.has(normalized)) continue;
  records.set(normalized,{
    name:cleanName(raw),
    lake:lakeFor(row),
    city:cleanName(row.premise_city||''),
    county:cleanName(row.county||''),
    address:[cleanName(row.premise_address||''),cleanName(row.premise_address_2||''),cleanName(row.premise_city||''),'NY'].filter(Boolean).join(', '),
    source:'New York State Liquor Authority license directory',
    sourceUrl:'https://data.ny.gov/Economic-Development/new-york-wineries/tyci-urth',
    verification:'License directory — visitor details pending'
  });
}
const output=[...records.values()].sort((a,b)=>a.name.localeCompare(b.name));
await writeFile('src/data/wineries.json',`${JSON.stringify(output,null,2)}\n`);
console.log(`Wrote ${output.length} regional winery records.`);
