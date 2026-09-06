import directory from './wineries.json';

const lakeX={'Canandaigua Lake':12,'Keuka Lake':31,'Seneca Lake':55,'Cayuga Lake':79};
const colors={'Canandaigua Lake':'#9b5c35','Keuka Lake':'#315c54','Seneca Lake':'#722f47','Cayuga Lake':'#2e6073'};
const counts={};
export const wineries=directory.map((record,index)=>{
  const position=counts[record.lake]||0;
  counts[record.lake]=position+1;
  return {...record,id:index+1,area:record.city?`${record.city}, ${record.county} County`:'Finger Lakes region',distance:'Route time available soon',score:null,ratings:0,tags:[record.lake.replace(' Lake',''),record.city||'Regional listing'],x:lakeX[record.lake]+((position%5)-2)*1.25,y:9+(position%15)*5.5,color:colors[record.lake],desc:`Listed in the New York State winery-license directory at ${record.address}. Public tasting hours and current flight details still need verification.`,wines:[]};
});
export const lakes=Object.keys(lakeX);
