import React,{useEffect,useRef,useState} from 'react';
import {Maximize2,Minimize2,Navigation,RotateCcw,Wine,ZoomIn,ZoomOut} from 'lucide-react';
import './interactive-map.css';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export default function InteractiveMap({activeLake,wineries,onOpen,children}){
 const [expanded,setExpanded]=useState(false);
 const [zoom,setZoom]=useState(1);
 const [position,setPosition]=useState({x:0,y:0});
 const viewport=useRef(null);
 const drag=useRef(null);
 const dragged=useRef(false);
 useEffect(()=>{if(!expanded)return;const close=event=>{if(event.key==='Escape')setExpanded(false)};addEventListener('keydown',close);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{removeEventListener('keydown',close);document.body.style.overflow=previous}},[expanded]);
 const changeZoom=(next,clientX,clientY)=>{const value=clamp(next,1,5);const rect=viewport.current?.getBoundingClientRect();if(!rect){setZoom(value);return}const pointX=(clientX??rect.left+rect.width/2)-rect.left;const pointY=(clientY??rect.top+rect.height/2)-rect.top;const mapX=(pointX-position.x)/zoom;const mapY=(pointY-position.y)/zoom;setPosition({x:pointX-mapX*value,y:pointY-mapY*value});setZoom(value)};
 const reset=()=>{setZoom(1);setPosition({x:0,y:0})};
 const pointerDown=event=>{if(event.button!==0||event.target.closest('button'))return;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,startX:position.x,startY:position.y};dragged.current=false;event.currentTarget.setPointerCapture(event.pointerId)};
 const pointerMove=event=>{if(!drag.current||drag.current.id!==event.pointerId)return;const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;if(Math.abs(dx)+Math.abs(dy)>5)dragged.current=true;setPosition({x:drag.current.startX+dx,y:drag.current.startY+dy})};
 const pointerUp=event=>{if(drag.current?.id===event.pointerId)drag.current=null};
 const openWinery=(event,winery)=>{if(dragged.current){event.preventDefault();return}onOpen(winery)};
 const toggleExpanded=()=>{setExpanded(value=>!value);reset()};
 return <div className={`interactiveMap${expanded?' expanded':''}`}>
  {expanded&&<div className="expandedMapHead"><div><small>EXPLORE THE FINGER LAKES</small><strong>{activeLake==='All lakes'?'All winery locations':activeLake}</strong></div><button onClick={toggleExpanded}><Minimize2/>Close map</button></div>}
  <div className="interactiveMapViewport" ref={viewport} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={event=>{event.preventDefault();changeZoom(zoom+(event.deltaY<0?.35:-.35),event.clientX,event.clientY)}}>
   <div className="interactiveMapLayer" style={{transform:`translate(${position.x}px,${position.y}px) scale(${zoom})`,'--pin-scale':1/zoom}}>
    {children}
    {wineries.map(winery=><button key={winery.id} title={`${winery.name} · ${winery.city}`} aria-label={`Open ${winery.name}`} className="pin directoryPin interactivePin" style={{left:winery.x+'%',top:winery.y+'%',background:winery.color}} onClick={event=>openWinery(event,winery)}><Wine size={12}/><span>{winery.name}</span></button>)}
   </div>
   <div className="mapControls" aria-label="Map controls"><button onClick={()=>changeZoom(zoom+.5)} disabled={zoom>=5} aria-label="Zoom in"><ZoomIn/></button><button onClick={()=>changeZoom(zoom-.5)} disabled={zoom<=1} aria-label="Zoom out"><ZoomOut/></button><button onClick={reset} aria-label="Reset map"><RotateCcw/></button><button onClick={toggleExpanded} aria-label={expanded?'Close expanded map':'Open full map'}>{expanded?<Minimize2/>:<Maximize2/>}</button></div>
   <div className="mapHint"><Navigation size={15}/> {wineries.length} wineries · drag and zoom</div>
   <div className="mapCredit">Sips illustrated map · locations based on winery directory coordinates</div>
  </div>
 </div>
}
