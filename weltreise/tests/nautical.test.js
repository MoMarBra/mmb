import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {portData} from '../ports.js';
import {chartCatalog,chartKey} from '../nautical-data.js';
import {deriveState,routeForTime,routeLines,distanceKm} from '../engine.js';
const base=new URL('../',import.meta.url);
class Node{
 constructor(){this.children=[];this.listeners={};this.dataset={};this.attrs={};this.hidden=false;this.classList={add(){},remove(){},toggle(){}};}
 append(n){this.children.push(n)}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,v){(this.listeners[k]??=[]).push(v)}
 fire(k,e={}){for(const f of this.listeners[k]??[])f({target:this,stopImmediatePropagation(){},...e})}
}
async function boot({failLand=false}={}){
 const ids=[...readFileSync(new URL('index.html',base),'utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);const nodes=Object.fromEntries(ids.map(k=>[k,new Node()]));const listeners={};let creations=0;
 class Layer{
  constructor(data,opts){this.data=data;this.options=opts;this.events={};this.svg=new Node();}
  addTo(m){m.layers.add(this);return this}on(n,f){this.events[n]=f;return this}bindTooltip(){return this}setLatLng(v){this.data=v;return this}setLatLngs(v){this.data=v;return this}setZIndex(){return this}getElement(){return {querySelector:()=>this.svg}}
 }
 const m={createPane:()=>({style:{}}),layers:new Set(),zoom:1,center:[0,0],events:{},attributionControl:{setPrefix(){}},setView(c,z){this.center=c;this.zoom=z;this.events.moveend?.();return this},getCenter(){return {lat:this.center[0],lng:this.center[1]}},getZoom(){return this.zoom},fitBounds(){this.center=[5,0];this.zoom=1;this.events.moveend?.();return this},on(n,f){for(const key of n.split(' '))this.events[key]=f;return this},distance(a,b){return distanceKm([a.lng,a.lat],[b[1],b[0]])*1000},removeLayer(l){this.layers.delete(l)},hasLayer(l){return this.layers.has(l)},invalidateSize(){},zoomIn(){return this.setView(this.center,this.zoom+1)},zoomOut(){return this.setView(this.center,this.zoom-1)},remove(){}};
 const layer=(d,o)=>new Layer(d,o);const L={map:()=>{creations++;return m},polygon:layer,polyline:layer,circleMarker:layer,marker:layer,divIcon:x=>x,imageOverlay:layer,tileLayer:Object.assign(layer,{wms:layer}),control:{scale:()=>({addTo(){}})}};
 const sandbox={portData,chartCatalog,chartKey,deriveState,routeForTime,routeLines,drawShipSvg(){},document:{getElementById:k=>nodes[k],createElement:()=>new Node(),head:new Node()},L,fetch:async()=>({ok:!failLand,json:async()=>[]}),ResizeObserver:class{observe(){}},setTimeout(){},addEventListener:(k,f)=>listeners[k]=f,console,Date};
 vm.createContext(sandbox);const source=readFileSync(new URL('nautical.js',base),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(source+'\nglobalThis.qa={ready:()=>initializing,get:()=>({enabled,map,activeLayer,activeKey,selected,state}),goToPort,toggle,updateOverlay};',sandbox);try{await sandbox.qa.ready()}catch{}
 return {qa:sandbox.qa,nodes,m,listeners,creations:()=>creations};
}
test('catalogue covers every real stop exactly once, Hamburg reused',()=>{
 assert.equal(Object.keys(chartCatalog).length,43);for(const p of portData){const c=chartCatalog[chartKey(p.id)];assert.ok(c,p.id);for(const f of ['provider','number','coverage','scale','edition','source','license'])assert.ok(c[f],`${p.id}: ${f}`);assert.match(c.source,/^https:\/\//);}
 assert.equal(chartKey('hamburg-start'),chartKey('hamburg-end'));
});
test('only explicitly licensed geographic chart imagery is configured',()=>{
 for(const c of Object.values(chartCatalog)){if(!c.layer)continue;assert.ok(c.licenseUrl);assert.ok(c.attribution);assert.equal(c.layer.bounds.length,4);const [w,s,e,n]=c.layer.bounds;assert.ok(w<e&&s<n&&w>=-180&&e<=180);assert.notEqual(c.layer.crs,'Simple');if(c.layer.type==='wms'){assert.equal(c.layer.layers,'ENC');assert.match(c.layer.url,/^https:\/\//);}}
});
test('toggle keeps the exact same viewport and map instance, makes no jump',async()=>{
 const h=await boot();h.qa.goToPort(portData.find(x=>x.id==='a-coruna'));const original=JSON.stringify([h.m.center,h.m.zoom]);
 assert.equal(h.qa.get().activeLayer,null);for(let i=0;i<4;i++){h.qa.toggle();assert.equal(JSON.stringify([h.m.center,h.m.zoom]),original);assert.equal(h.qa.get().map,h.m);}
 assert.equal(h.creations(),1);assert.equal(h.qa.get().enabled,false);
});
test('only enabling Seekarte adds official layer and disabling removes it',async()=>{
 const h=await boot();h.qa.goToPort(portData.find(x=>x.id==='a-coruna'));h.qa.toggle();const original=h.qa.get().activeLayer;assert.ok(original);original.events.tileload();assert.equal(h.nodes['chart-state'].dataset.kind,'ok');h.qa.toggle();assert.equal(h.qa.get().activeLayer,null);assert.ok(!h.m.layers.has(original));
});
test('unlicensed port and off-chart panning cannot be labelled as an original',async()=>{
 const h=await boot();h.qa.toggle();h.qa.goToPort(portData.find(x=>x.id==='hamburg-start'));assert.equal(h.qa.get().activeLayer,null);assert.match(h.nodes['chart-map-badge'].textContent,/keine Seekarte/);
 h.qa.goToPort(portData.find(x=>x.id==='a-coruna'));assert.ok(h.qa.get().activeLayer);h.m.setView([43.365,-8.6],13);assert.equal(h.qa.get().activeLayer,null);assert.match(h.nodes['chart-map-badge'].textContent,/Außerhalb/);
});
test('partial tile error remains explicit and stale responses cannot relabel another port',async()=>{
 const h=await boot();h.qa.toggle();h.qa.goToPort(portData.find(x=>x.id==='a-coruna'));const layer=h.qa.get().activeLayer;layer.events.tileerror();layer.events.tileload();assert.equal(h.nodes['chart-state'].dataset.kind,'error');h.qa.goToPort(portData[0]);layer.events.tileload();assert.match(h.nodes['chart-map-badge'].textContent,/Hamburg/);
});
test('timeline state updates ship and route without recentering chart',async()=>{
 const h=await boot();h.qa.goToPort(portData.find(x=>x.id==='a-coruna'));const v=JSON.stringify([h.m.center,h.m.zoom]);const next=deriveState(Date.parse('2026-12-24T12:00:00Z'));h.listeners['journey:state']({detail:next});assert.equal(h.qa.get().state.now,next.now);assert.equal(JSON.stringify([h.m.center,h.m.zoom]),v);
});
test('map initialization failure keeps original SVG map as fallback',async()=>{const h=await boot({failLand:true});assert.equal(h.qa.get().map,null);assert.equal(h.nodes['nautical-map'].hidden,true);assert.equal(h.nodes['chart-state'].dataset.kind,'error');});
test('mobile raster overview upgrades to full detail without moving the viewport',async()=>{
 const h=await boot();h.qa.toggle();h.qa.goToPort(portData.find(x=>x.id==='nukualofa'));assert.match(h.qa.get().activeLayer.data,/preview\.png$/);const center=JSON.stringify(h.m.center);h.m.setView(h.m.center,16);assert.match(h.qa.get().activeLayer.data,/to504-overlay\.png$/);assert.equal(JSON.stringify(h.m.center),center);
});
test('Aitutaki changes to the correctly registered Arutanga inset only inside its bounds',async()=>{
 const h=await boot();h.qa.toggle();h.qa.goToPort(portData.find(x=>x.id==='aitutaki'));assert.match(h.qa.get().activeLayer.data,/ck142-overlay-preview/);h.m.setView(h.m.center,15);assert.match(h.qa.get().activeLayer.data,/arutanga-overlay/);h.m.setView([-18.91,-159.8],15);assert.match(h.qa.get().activeLayer.data,/ck142-overlay\.png$/);
});
