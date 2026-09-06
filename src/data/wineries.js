import directory from './wineries.json';

const lakeX={'Canandaigua Lake':12,'Keuka Lake':31,'Seneca Lake':55,'Cayuga Lake':79};
const colors={'Canandaigua Lake':'#9b5c35','Keuka Lake':'#315c54','Seneca Lake':'#722f47','Cayuga Lake':'#2e6073'};
const popularByLake={
  'Canandaigua Lake':['Ravines Wine Cellars','Inspire Moore Winery & Vineyard','Billsboro Winery','Naples Valley Wine Cellars','Kettle Ridge Farm'],
  'Keuka Lake':['Konstantin D. Frank &Sons Vinifera Wine Cellars','Weis Vineyards','Heron Hill Winery','Keuka Spring Vineyards','Domaine Leseurre','Keuka Lake Vineyards','Point Of The Bluff Vineyard','Hunt Country Vineyards'],
  'Seneca Lake':['Hermann J. Wiemer Vineyard','Boundary Breaks','Red Newt Cellars','Wagner Vineyards','Glenora Wine Cellars','Damiani Wine Cellars','Lakewood Vineyards','Forge Cellars','Atwater Vineyards','Lamoreaux Landing Wine'],
  'Cayuga Lake':['Heart & Hands Wine Company','Treleaven','Long Point Winery','Bright Leaf Vineyard','Bet The Farm','Quarry Ridge Winery']
};
const discoveryTieBreak=name=>[...name].reduce((total,char)=>(total*31+char.charCodeAt(0))%997,0);
const counts={};
const regionalWineries=directory.map((record,index)=>{
  const position=counts[record.lake]||0;
  const curatedRank=(popularByLake[record.lake]||[]).indexOf(record.name);
  counts[record.lake]=position+1;
  return {...record,id:index+1,area:record.city?`${record.city}, ${record.county} County`:'Finger Lakes region',distance:'Route time available soon',score:null,ratings:0,popularityRank:curatedRank<0?1000+discoveryTieBreak(record.name):curatedRank,tags:[record.lake.replace(' Lake',''),record.city||'Regional listing'],x:lakeX[record.lake]+((position%5)-2)*1.25,y:9+(position%15)*5.5,color:colors[record.lake],desc:`Listed in the New York State winery-license directory at ${record.address}. Public tasting hours and current flight details still need verification.`,wines:[]};
});
const heartAndHands=regionalWineries.find(winery=>winery.name==='Heart & Hands Wine Company');
if(heartAndHands)Object.assign(heartAndHands,{
  tags:['Cayuga','Menu available','Two tasting flights'],
  desc:'A Cayuga Lake winery in Union Springs. Rate the wines from the uploaded tasting menu with the One Sip scale and save your favorites to your account.',
  verification:'Menu supplied by a Sips traveler — availability may change',
  menuNotice:'Menu photographed September 2026. Each signature flight was listed at $15; confirm current wines, prices and hours with the winery before visiting.',
  flightPrice:'$15',
  wines:[
    ['2021 Verve Chardonnay','Chardonnay','$26.99','White Wine Flight','Bright and lively, with fresh minerality and a crisp, refreshing character.'],
    ['2021 Chardonnay','Chardonnay','$26.99','White Wine Flight','A richer style with minerality, apricot and fresh cream, finishing dry and refreshing.'],
    ['2023 Esoterra','Auxerrois · Aligoté · Arvine','$19.99','White Wine Flight','An estate-grown blend of uncommon varieties from the winery’s limestone-rich vineyard.','93 points JS'],
    ['2024 Dry Riesling','Dry Riesling','$26.99','White Wine Flight','Chalky minerality and key lime lead to citrus, yuzu and ripe apricot with a brisk finish.'],
    ['2023 Riesling','Riesling','$18.99','White Wine Flight','Pear and orange blossom aromas with ripe peach, Cara Cara orange and a long finish.','93 points JS'],
    ['2024 Aligoté','Aligoté','$35.99','Pinot & Family Flight','A new release listed on the uploaded tasting menu.','New release'],
    ['2023 Pinot Auxerrois','Pinot Auxerrois','$35.99','Pinot & Family Flight','Part of the winery’s Pinot & Family signature flight.','92 points JS'],
    ['2023 Estate Chardonnay','Estate Chardonnay','$32.99','Pinot & Family Flight','An estate Chardonnay included in the Pinot & Family flight.','92 points JS'],
    ['2023 Pinot Noir','Pinot Noir','$27.99','Pinot & Family Flight','A Finger Lakes Pinot Noir included in the Pinot & Family flight.','93 points JS'],
    ['2024 Nutt Road Pinot Noir','Pinot Noir','$48.99','Pinot & Family Flight','A vineyard-designated Pinot Noir included in the Pinot & Family flight.']
  ]
});
export const wineries=heartAndHands?[heartAndHands,...regionalWineries.filter(winery=>winery!==heartAndHands)]:regionalWineries;
export const lakes=Object.keys(lakeX);
