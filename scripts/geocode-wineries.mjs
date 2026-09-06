import {readFile,writeFile} from 'node:fs/promises';

const file='src/data/wineries.json';
const wineries=JSON.parse(await readFile(file,'utf8'));
const csvEscape=value=>`"${String(value).replaceAll('"','""')}"`;
const parseCsv=text=>{
  const rows=[];let row=[];let value='';let quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'&&quoted&&text[i+1]==='"'){value+='"';i++;continue}
    if(char==='"'){quoted=!quoted;continue}
    if(char===','&&!quoted){row.push(value);value='';continue}
    if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push(row);row=[];value='';continue}
    value+=char;
  }
  if(value||row.length){row.push(value);rows.push(row)}
  return rows;
};

const input=wineries.map((winery,index)=>{
  const suffix=new RegExp(`,\\s*${winery.city.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*,\\s*NY.*$`,'i');
  const street=winery.address.replace(suffix,'').trim();
  return [index,street,winery.city,'NY',''].map(csvEscape).join(',');
}).join('\n');
const form=new FormData();
form.append('addressFile',new Blob([input],{type:'text/csv'}),'wineries.csv');
form.append('benchmark','Public_AR_Current');
const response=await fetch('https://geocoding.geo.census.gov/geocoder/locations/addressbatch',{method:'POST',body:form});
if(!response.ok)throw new Error(`Census geocoder returned ${response.status}`);
const rows=parseCsv(await response.text());
let matched=0;
for(const row of rows){
  const index=Number(row[0]);
  if(!Number.isInteger(index)||row[2]!=='Match'||!row[5])continue;
  const [longitude,latitude]=row[5].split(',').map(Number);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
  Object.assign(wineries[index],{latitude,longitude,coordinateAccuracy:'address',geocodeSource:'U.S. Census Geocoder'});
  matched++;
}
const pointsByCity=new Map();
for(const winery of wineries){
  if(!winery.latitude)continue;
  const points=pointsByCity.get(winery.city)||[];
  points.push([winery.latitude,winery.longitude]);
  pointsByCity.set(winery.city,points);
}
let approximated=0;
for(const winery of wineries){
  if(winery.latitude)continue;
  let points=pointsByCity.get(winery.city)||[];
  if(!points.length)points=wineries.filter(candidate=>candidate.lake===winery.lake&&candidate.latitude).map(candidate=>[candidate.latitude,candidate.longitude]);
  if(!points.length)continue;
  const [latitude,longitude]=points.reduce(([lat,lng],[nextLat,nextLng])=>[lat+nextLat,lng+nextLng],[0,0]).map(total=>total/points.length);
  Object.assign(winery,{latitude,longitude,coordinateAccuracy:'approximate',geocodeSource:'Nearby winery-license locations'});
  approximated++;
}
await writeFile(file,`${JSON.stringify(wineries,null,2)}\n`);
console.log(`Geocoded ${matched} addresses and approximated ${approximated} unmatched locations.`);
