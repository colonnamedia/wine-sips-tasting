import directory from './wineries.json';

const lakeX={'Canandaigua Lake':12,'Keuka Lake':31,'Seneca Lake':55,'Cayuga Lake':79};
const colors={'Canandaigua Lake':'#9b5c35','Keuka Lake':'#315c54','Seneca Lake':'#722f47','Cayuga Lake':'#2e6073'};
const counts={};
const demoWinery={id:'demo',name:'Sips Demo Cellar',lake:'Seneca Lake',city:'Geneva',county:'Ontario',address:'Sample location — not a real winery',area:'Geneva · Sample experience',distance:'Demo tasting ready',score:null,ratings:0,tags:['Sample winery','Demo flight'],x:52,y:16,color:'#6e2942',desc:'This fictional winery and tasting flight are included only to demonstrate how the One Sip rating experience works. No wines, prices, or visitor details shown here are real.',verification:'Demo winery — sample menu',source:'Sips product demo',sourceUrl:null,wines:[['2024 Dry Riesling','White · Sample menu','$24 sample'],['2024 Grüner Veltliner','White · Sample menu','$27 sample'],['2023 Unoaked Chardonnay','White · Sample menu','$26 sample'],['2024 Cabernet Franc Rosé','Rosé · Sample menu','$25 sample'],['2022 Cabernet Franc','Red · Sample menu','$34 sample'],['2023 Vidal Ice Wine','Dessert · Sample menu','$38 sample']]};
const regionalWineries=directory.map((record,index)=>{
  const position=counts[record.lake]||0;
  counts[record.lake]=position+1;
  return {...record,id:index+1,area:record.city?`${record.city}, ${record.county} County`:'Finger Lakes region',distance:'Route time available soon',score:null,ratings:0,tags:[record.lake.replace(' Lake',''),record.city||'Regional listing'],x:lakeX[record.lake]+((position%5)-2)*1.25,y:9+(position%15)*5.5,color:colors[record.lake],desc:`Listed in the New York State winery-license directory at ${record.address}. Public tasting hours and current flight details still need verification.`,wines:[]};
});
export const wineries=[demoWinery,...regionalWineries];
export const lakes=Object.keys(lakeX);
