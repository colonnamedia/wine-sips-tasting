import directory from './wineries.json';

const lakeX={'Canandaigua Lake':12,'Keuka Lake':31,'Seneca Lake':55,'Cayuga Lake':79};
const colors={'Canandaigua Lake':'#9b5c35','Keuka Lake':'#315c54','Seneca Lake':'#722f47','Cayuga Lake':'#2e6073'};
const popularByLake={
  'Canandaigua Lake':['Ravines Wine Cellars','Inspire Moore Winery & Vineyard','Billsboro Winery','Naples Valley Wine Cellars','Kettle Ridge Farm'],
  'Keuka Lake':['Konstantin D. Frank &Sons Vinifera Wine Cellars','Weis Vineyards','Heron Hill Winery','Keuka Spring Vineyards','Domaine Leseurre','Keuka Lake Vineyards','Point Of The Bluff Vineyard','Hunt Country Vineyards'],
  'Seneca Lake':['Hermann J. Wiemer Vineyard','Boundary Breaks','Red Newt Cellars','Wagner Vineyards','Glenora Wine Cellars','Damiani Wine Cellars','Lakewood Vineyards','Forge Cellars','Atwater Vineyards','Lamoreaux Landing Wine'],
  'Cayuga Lake':['Heart & Hands Wine Company','Constantia Wine Company','Treleaven','Long Point Winery','Bright Leaf Vineyard','Bet The Farm','Quarry Ridge Winery']
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
const constantia=regionalWineries.find(winery=>winery.name==='Constantia Wine Company');
if(constantia)Object.assign(constantia,{
  tags:['Cayuga','Menu available','Choose-your-own tasting'],
  desc:'A Cayuga Lake winery in Scipio Center offering white, rosé and red Finger Lakes wines. Build a tasting from the uploaded menu and rate every selection with the One Sip scale.',
  verification:'Menu supplied by a Sips traveler — availability may change',
  menuNotice:'Menu photographed September 2026. Choose five 1 oz pours for $12 or four 2 oz pours served in carafes for $15. Confirm current wines, prices and hours before visiting.',
  flightPrice:'From $12',
  wines:[
    ['2025 Grüner Veltliner','Finger Lakes AVA · Cayuga Lake','$24','Whites','Aromatic and crisp, sustainably grown over shale and fermented and aged in stainless steel.'],
    ['2024 Chardonnay','Finger Lakes AVA · Cayuga Lake','$23','Whites','Easy-drinking Chardonnay blending stainless-steel and barrel-aged lots for complexity and texture.'],
    ['2024 Barrel Reserve Chardonnay','Finger Lakes AVA · Cayuga Lake','$26','Whites','East-side Cayuga fruit aged in French oak for rich texture while retaining vibrant fruit.'],
    ['2023 Dry Riesling','Finger Lakes AVA','$22','Whites','White peach and citrus with bright acidity and limestone minerality.'],
    ['2021 Semi-Dry Riesling','Finger Lakes AVA · Seneca Lake','$19','Whites','Pear, grapefruit and juicy apricot with floral hints, minerality and bright acidity.'],
    ['2020 Semi-Sweet Riesling','Finger Lakes AVA · Seneca Lake','$18','Whites','Tropical fruit and citrus with pink grapefruit, honeysuckle and melon.'],
    ['2024 Late Harvest Riesling','Finger Lakes AVA · Cayuga Lake','$28','Whites','A hand-harvested, botrytized Riesling with concentrated flavor and a cool-fermented finish.'],
    ['2025 Dry Rosé of Cabernet Franc','Finger Lakes AVA · Seneca Lake','$24','Dry Rosé & Reds','Crisp and fruity, made from sustainably grown Cabernet Franc and aged in stainless steel.'],
    ['2024 Pinot Noir','Finger Lakes AVA · Cayuga Lake','$16 / $26','Dry Rosé & Reds','Hand-picked Cayuga fruit fermented in small lots and aged in Burgundian French oak.'],
    ['2021 Merlot','Finger Lakes AVA · Cayuga Lake','$25','Dry Rosé & Reds','Bright cherry and plum with vanilla, soft tannins and a balanced, lingering finish.'],
    ['2024 Cabernet Franc','Finger Lakes AVA · Cayuga Lake','$28','Dry Rosé & Reds','Red and black fruit with ten months in French oak.','92 points JS'],
    ['2024 Uniquity Red Blend','Finger Lakes AVA · Cayuga Lake','$32','Dry Rosé & Reds','A structured Bordeaux-style blend with cherry, wild berry, integrated tannins and balanced acidity.']
  ]
});
const menuWineries=[heartAndHands,constantia].filter(Boolean);
export const wineries=[...menuWineries,...regionalWineries.filter(winery=>!menuWineries.includes(winery))];
export const lakes=Object.keys(lakeX);
