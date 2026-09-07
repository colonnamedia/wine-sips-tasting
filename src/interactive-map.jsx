import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Maximize2,Minimize2,Navigation,RotateCcw,Wine,ZoomIn,ZoomOut} from 'lucide-react';
import './interactive-map.css';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export default function InteractiveMap({activeLake,wineries,onOpen,children}){
 const [expanded,setExpanded]=useState(false);
 const [zoom,setZoom]=useState(1);
 const [position,setPosition]=useState({x:0,y:0});
 const viewport=useRef(null);
 const view=useRef({zoom:1,position:{x:0,y:0}});
 const drag=useRef(null);
 const pinch=useRef(null);
 const pointers=useRef(new Map());
 const dragged=useRef(false);
 useEffect(()=>{if(!expanded)return;const close=event=>{if(event.key==='Escape')setExpanded(false)};addEventListener('keydown',close);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{removeEventListener('keydown',close);document.body.style.overflow=previous}},[expanded]);
 const applyView=(nextPosition,nextZoom)=>{view.current={position:nextPosition,zoom:nextZoom};setPosition(nextPosition);setZoom(nextZoom)};
 const changeZoom=(next,clientX,clientY)=>{const current=view.current;const value=clamp(next,1,5);const rect=viewport.current?.getBoundingClientRect();if(!rect){applyView(current.position,value);return}const pointX=(clientX??rect.left+rect.width/2)-rect.left;const pointY=(clientY??rect.top+rect.height/2)-rect.top;const mapX=(pointX-current.position.x)/current.zoom;const mapY=(pointY-current.position.y)/current.zoom;applyView({x:pointX-mapX*value,y:pointY-mapY*value},value)};
 const reset=()=>applyView({x:0,y:0},1);
 const startPinch=()=>{const points=[...pointers.current.values()];if(points.length<2)return;const [a,b]=points;const rect=viewport.current.getBoundingClientRect();const point={x:(a.x+b.x)/2-rect.left,y:(a.y+b.y)/2-rect.top};const current=view.current;pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:current.zoom,mapX:(point.x-current.position.x)/current.zoom,mapY:(point.y-current.position.y)/current.zoom}};
 const pointerDown=event=>{if(event.button!==0)return;if(event.target.closest('button')){dragged.current=false;return}pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});dragged.current=false;event.currentTarget.setPointerCapture(event.pointerId);if(pointers.current.size===1){const current=view.current;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,startX:current.position.x,startY:current.position.y}}else{drag.current=null;startPinch()}};
 const pointerMove=event=>{if(!pointers.current.has(event.pointerId))return;pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.current.size>1&&pinch.current){const [a,b]=[...pointers.current.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);const nextZoom=clamp(pinch.current.zoom*(distance/pinch.current.distance),1,5);const rect=viewport.current.getBoundingClientRect();const point={x:(a.x+b.x)/2-rect.left,y:(a.y+b.y)/2-rect.top};dragged.current=true;applyView({x:point.x-pinch.current.mapX*nextZoom,y:point.y-pinch.current.mapY*nextZoom},nextZoom);return}if(!drag.current||drag.current.id!==event.pointerId)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>5)dragged.current=true;applyView({x:drag.current.startX+dx,y:drag.current.startY+dy},view.current.zoom)};
 const pointerUp=event=>{pointers.current.delete(event.pointerId);pinch.current=null;if(!pointers.current.size){drag.current=null;return}const [id,point]=pointers.current.entries().next().value;const current=view.current;drag.current={id,x:point.x,y:point.y,startX:current.position.x,startY:current.position.y}};
 const markers=useMemo(()=>{
  if(zoom<1.75){const groups=new Map();for(const winery of wineries){const group=groups.get(winery.lake)||[];group.push(winery);groups.set(winery.lake,group)}return [...groups.entries()].map(([label,items])=>({key:label,label,items,x:items.reduce((sum,item)=>sum+item.x,0)/items.length,y:items.reduce((sum,item)=>sum+item.y,0)/items.length,color:items[0].color}))}
  if(zoom>=4)return wineries.map(winery=>({key:winery.id,label:winery.name,items:[winery],x:winery.x,y:winery.y,color:winery.color}));
  const cell=zoom<2.7?16:9;const groups=new Map();for(const winery of wineries){const key=`${Math.floor(winery.x/cell)}-${Math.floor(winery.y/cell)}`;const group=groups.get(key)||[];group.push(winery);groups.set(key,group)}return [...groups.entries()].map(([key,items])=>({key,label:items.length===1?items[0].name:`${items[0].city} area`,items,x:items.reduce((sum,item)=>sum+item.x,0)/items.length,y:items.reduce((sum,item)=>sum+item.y,0)/items.length,color:items[0].color}))
 },[wineries,zoom]);
 const selectMarker=(event,marker)=>{event.stopPropagation();if(dragged.current){event.preventDefault();return}if(marker.items.length===1){onOpen(marker.items[0]);return}changeZoom(view.current.zoom+1.35,event.clientX,event.clientY)};
 const toggleExpanded=()=>{setExpanded(value=>!value);reset()};
 return <div className={`interactiveMap${expanded?' expanded':''}`}>
  {expanded&&<div className="expandedMapHead"><div><small>EXPLORE THE FINGER LAKES</small><strong>{activeLake==='All lakes'?'All winery locations':activeLake}</strong></div><button type="button" onClick={toggleExpanded}><Minimize2/>Close map</button></div>}
  <div className="interactiveMapViewport" ref={viewport} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDoubleClick={event=>changeZoom(view.current.zoom+1,event.clientX,event.clientY)} onWheel={event=>{event.preventDefault();changeZoom(view.current.zoom+(event.deltaY<0?.35:-.35),event.clientX,event.clientY)}}>
   <div className="interactiveMapLayer" style={{transform:`translate(${position.x}px,${position.y}px) scale(${zoom})`,'--pin-scale':1/zoom}}>
    {children}
    {markers.map(marker=><button type="button" key={marker.key} title={marker.items.length===1?`${marker.label} · ${marker.items[0].city}`:`Zoom into ${marker.label}`} aria-label={marker.items.length===1?`Open ${marker.label}`:`Zoom into ${marker.label}, ${marker.items.length} wineries`} className={`interactivePin ${marker.items.length>1?'clusterPin':'singlePin'}`} style={{left:marker.x+'%',top:marker.y+'%',background:marker.color}} onClick={event=>selectMarker(event,marker)}>{marker.items.length>1?<strong>{marker.items.length}</strong>:<Wine/>}<span>{marker.label}</span></button>)}
   </div>
   <div className="mapControls" aria-label="Map controls" onPointerDown={event=>event.stopPropagation()}><button type="button" onClick={()=>changeZoom(view.current.zoom+.75)} disabled={zoom>=5} aria-label="Zoom in"><ZoomIn/></button><output aria-live="polite">{Math.round(zoom*100)}%</output><button type="button" onClick={()=>changeZoom(view.current.zoom-.75)} disabled={zoom<=1} aria-label="Zoom out"><ZoomOut/></button><button type="button" onClick={reset} aria-label="Reset map"><RotateCcw/></button><button type="button" onClick={toggleExpanded} aria-label={expanded?'Close expanded map':'Open full map'}>{expanded?<Minimize2/>:<Maximize2/>}</button></div>
   <div className="mapHint"><Navigation size={15}/> {markers.length} map {markers.length===1?'marker':'markers'} · {wineries.length} wineries</div>
   <div className="mapCredit">Sips illustrated map · locations based on winery directory coordinates</div>
  </div>
 </div>
}
