import React,{useEffect,useRef,useState} from 'react';
import * as L from 'leaflet';
import {LocateFixed,Maximize2,Minimize2,Navigation} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './interactive-map.css';

export default function InteractiveMap({activeLake,wineries,onOpen}){
 const [expanded,setExpanded]=useState(false);
 const [locationStatus,setLocationStatus]=useState('idle');
 const [mapReady,setMapReady]=useState(false);
 const container=useRef(null);
 const map=useRef(null);
 const markers=useRef(null);
 const userMarker=useRef(null);
 const onOpenRef=useRef(onOpen);
 onOpenRef.current=onOpen;

 useEffect(()=>{
  if(!container.current||map.current)return;
  const instance=L.map(container.current,{center:[42.69,-76.93],zoom:8,zoomSnap:.5,zoomDelta:.5,minZoom:7,maxZoom:18,preferCanvas:true,fadeAnimation:false});
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19,updateWhenIdle:false,keepBuffer:3});
  const ready=()=>setMapReady(true);tiles.once('load',ready).once('tileerror',ready).addTo(instance);
  markers.current=L.layerGroup().addTo(instance);
  map.current=instance;
  const resize=new ResizeObserver(()=>instance.invalidateSize({pan:false,debounceMoveend:true}));resize.observe(container.current);
  const frame=requestAnimationFrame(()=>instance.invalidateSize({pan:false}));const readyTimer=setTimeout(ready,2500);
  return()=>{cancelAnimationFrame(frame);clearTimeout(readyTimer);resize.disconnect();instance.remove();map.current=null;markers.current=null};
 },[]);

 useEffect(()=>{
  if(!map.current||!markers.current)return;
  markers.current.clearLayers();
  const valid=wineries.filter(winery=>Number.isFinite(Number(winery.latitude))&&Number.isFinite(Number(winery.longitude)));
  for(const winery of valid){
   const marker=L.circleMarker([Number(winery.latitude),Number(winery.longitude)],{radius:6,weight:2,color:'#fff',fillColor:winery.color||'#6e2942',fillOpacity:.95});
   marker.bindTooltip(`<strong>${winery.name}</strong><br>${winery.city} · ${winery.lake}`,{direction:'top',offset:[0,-5],opacity:.96});
   marker.on('click',()=>onOpenRef.current(winery));
   marker.addTo(markers.current);
  }
 },[wineries]);

 useEffect(()=>{if(!map.current)return;if(activeLake==='All lakes'){map.current.setView([42.69,-76.93],8);return}const points=wineries.filter(winery=>Number.isFinite(Number(winery.latitude))&&Number.isFinite(Number(winery.longitude))).map(winery=>[Number(winery.latitude),Number(winery.longitude)]);if(points.length)map.current.fitBounds(points,{padding:[35,35],maxZoom:11})},[activeLake]);

 useEffect(()=>{const timer=setTimeout(()=>map.current?.invalidateSize({pan:false}),100);return()=>clearTimeout(timer)},[expanded]);
 useEffect(()=>{if(!expanded)return;const close=event=>{if(event.key==='Escape')setExpanded(false)};addEventListener('keydown',close);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{removeEventListener('keydown',close);document.body.style.overflow=previous}},[expanded]);

 const useLocation=()=>{if(!navigator.geolocation){setLocationStatus('unavailable');return}setLocationStatus('locating');navigator.geolocation.getCurrentPosition(({coords})=>{const point=[coords.latitude,coords.longitude];if(userMarker.current)userMarker.current.setLatLng(point);else userMarker.current=L.circleMarker(point,{radius:9,weight:4,color:'#fff',fillColor:'#256d78',fillOpacity:1}).bindTooltip('Your location',{permanent:false,direction:'top'}).addTo(map.current);map.current.setView(point,12,{animate:true});setLocationStatus('found')},()=>setLocationStatus('denied'),{enableHighAccuracy:true,timeout:12000,maximumAge:300000})};

 return <div className={`interactiveMap${expanded?' expanded':''}`}>
  {expanded&&<div className="expandedMapHead"><div><small>EXPLORE THE FINGER LAKES</small><strong>{activeLake==='All lakes'?'All winery locations':activeLake}</strong></div><button type="button" onClick={()=>setExpanded(false)}><Minimize2/>Close map</button></div>}
  {!mapReady&&<div className="mapLoading"><i/><strong>Loading the Finger Lakes map…</strong></div>}
  <div className={`leafletMap${mapReady?' ready':''}`} ref={container} aria-label={`Interactive map showing ${wineries.length} Finger Lakes winery locations`}/>
  <button className="expandMapButton" type="button" onClick={()=>setExpanded(value=>!value)}>{expanded?<Minimize2/>:<Maximize2/>}<span>{expanded?'Close':'Full map'}</span></button>
  <button className={`locateMapButton ${locationStatus}`} type="button" onClick={useLocation} disabled={locationStatus==='locating'}><LocateFixed/><span>{locationStatus==='locating'?'Finding you…':locationStatus==='found'?'Location found':locationStatus==='denied'?'Location not allowed':locationStatus==='unavailable'?'Unavailable':'Use my location'}</span></button>
  <div className="mapHint"><Navigation size={15}/> {wineries.length} wineries · zoom for roads and towns</div>
 </div>
}
