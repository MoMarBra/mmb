import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {snackColor,snackLabelColor} from './colors.js';
import {WHEEL} from './wheel-geometry.js';

const TAU=Math.PI*2;
export function makeSegment(index,count){
  const center=Math.PI/2-index*TAU/count,half=TAU/count/2-.003,inner=WHEEL.innerRadius,outer=WHEEL.segmentRadius,shape=new THREE.Shape();
  shape.absarc(0,0,outer,center-half,center+half,false);shape.lineTo(Math.cos(center+half)*inner,Math.sin(center+half)*inner);shape.absarc(0,0,inner,center+half,center-half,true);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.054,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2,curveSegments:16});geometry.translate(0,0,.142);return geometry;
}
function createLabel(snack,index,count){
  const c=document.createElement('canvas');c.width=512;c.height=160;const ctx=c.getContext('2d');
  ctx.fillStyle=snackLabelColor(snack);ctx.font='600 64px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const words=snack.name.split(/\s+/),lines=[''];for(const word of words){const i=lines.length-1;if(ctx.measureText((lines[i]+' '+word).trim()).width>480&&lines[i])lines.push(word);else lines[i]=(lines[i]+' '+word).trim()}
  if(lines.length>3){lines.splice(2,lines.length-2,lines.slice(2).join(' '))}lines.forEach((line,i)=>ctx.fillText(line,256,80+(i-(lines.length-1)/2)*64,480));
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(WHEEL.labelWidth,WHEEL.labelWidth*160/512),material),theta=Math.PI/2-index*TAU/count;
  mesh.position.set(Math.cos(theta)*WHEEL.labelRadius,Math.sin(theta)*WHEEL.labelRadius,.237);mesh.rotation.z=theta;mesh.userData.snackId=snack.id;return mesh;
}
export async function createWheel(container,initialSnacks,onSelect){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2.75,-2.75,.1,50);camera.position.set(0,0,12);camera.lookAt(0,0,0);
  const environment=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(environment,.04);scene.environment=env.texture;scene.environmentIntensity=.35;environment.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf4f7ff,0x253657,1.1));const key=new THREE.DirectionalLight(0xffffff,1.9);key.position.set(-4,6,9);scene.add(key);const fill=new THREE.DirectionalLight(0xe8f2ff,.8);fill.position.set(4,1,5);scene.add(fill);
  let gltf;try{gltf=await new GLTFLoader().loadAsync('./assets/wheel.glb')}catch(e){renderer.dispose();env.dispose();throw e}
  const model=gltf.scene;scene.add(model);
  const wheel=model.getObjectByName('Wheel');if(!wheel){renderer.dispose();throw new Error('Rad-Modell unvollständig')}
  const originalSegments=[];model.traverse(o=>{if(/^Segment_\d+$/.test(o.name)&&o.isMesh)originalSegments.push(o)});originalSegments.sort((a,b)=>a.name.localeCompare(b.name));
  const labels=new THREE.Group();wheel.add(labels);let snacks=[],segments=[],generated=[],selectedId=null,hoverId=null,interactive=true;
  function render(){renderer.render(scene,camera)}
  function resize(){const r=container.getBoundingClientRect();if(r.width<1||r.height<1)return;const half=WHEEL.half,aspect=r.width/r.height;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);render()}
  function highlight(){for(const mesh of segments){const active=mesh.userData.snackId===selectedId,hover=mesh.userData.snackId===hoverId;mesh.material.emissive.set(active?0x6aa5ff:hover?0x365b91:0x000000);mesh.material.emissiveIntensity=active?.18:hover?.13:0;}render()}
  function setSnacks(next){
    snacks=next;for(const child of [...labels.children]){child.geometry.dispose();child.material.map.dispose();child.material.dispose();labels.remove(child)}for(const m of generated){m.geometry.dispose();m.material.dispose();wheel.remove(m)}generated=[];
    originalSegments.forEach(s=>{s.visible=snacks.length===18});
    if(snacks.length===18)segments=originalSegments;else{segments=snacks.map((s,i)=>{const mesh=new THREE.Mesh(makeSegment(i,snacks.length),new THREE.MeshStandardMaterial({roughness:.36,metalness:.1}));wheel.add(mesh);generated.push(mesh);return mesh})}
    segments.forEach((mesh,i)=>{if(!mesh.userData.clonedMaterial){mesh.material=mesh.material.clone();mesh.userData.clonedMaterial=true}mesh.userData.snackId=snacks[i].id;mesh.material.color.set(snackColor(snacks[i]));mesh.material.roughness=.55;mesh.material.metalness=0;labels.add(createLabel(snacks[i],i,snacks.length))});highlight();
  }
  let fragments=null,hiddenParts=[];
  function explode(progress){
    if(progress<=0){
      if(fragments)for(const f of fragments){f.mesh.position.copy(f.position);f.mesh.rotation.copy(f.rotation);f.mesh.scale.copy(f.scale);f.mesh.material.opacity=f.opacity;f.mesh.material.transparent=f.transparent}
      for(const part of hiddenParts)part.visible=true;
      fragments=null;hiddenParts=[];model.visible=true;render();return;
    }
    if(!fragments){
      fragments=[...segments,...labels.children].map((mesh,i)=>({mesh,index:i%snacks.length,position:mesh.position.clone(),rotation:mesh.rotation.clone(),scale:mesh.scale.clone(),opacity:mesh.material.opacity,transparent:mesh.material.transparent}));
      hiddenParts=['Body','Hub','Pointer','Frame'].map(name=>model.getObjectByName(name)).filter(part=>part?.visible);hiddenParts.forEach(part=>part.visible=false);
    }
    const spread=1-(1-progress)**2;
    for(const f of fragments){
      const theta=Math.PI/2-f.index*TAU/snacks.length,distance=spread*(3.8+(f.index%3)*.45);
      f.mesh.position.copy(f.position).add(new THREE.Vector3(Math.cos(theta)*distance,Math.sin(theta)*distance,Math.sin(f.index*2.3)*spread));
      f.mesh.rotation.set(f.rotation.x+spread*.45*Math.sin(f.index),f.rotation.y+spread*.5*Math.cos(f.index),f.rotation.z+spread*(f.index%2?-.4:.4));
      f.mesh.scale.copy(f.scale).multiplyScalar(1-spread*.25);f.mesh.material.transparent=true;f.mesh.material.opacity=Math.max(0,1-progress);
    }
    model.visible=progress<1;render();
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const occluders=['Frame','Pointer','Hub'].map(name=>model.getObjectByName(name)).filter(Boolean);
  function pick(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects([...segments,...occluders],true)[0]?.object.userData.snackId??null}
  renderer.domElement.addEventListener('pointermove',event=>{if(!interactive)return;const id=pick(event);if(id!==hoverId){hoverId=id;renderer.domElement.style.cursor=id?'pointer':'default';renderer.domElement.title=snacks.find(s=>s.id===id)?.name||'';highlight()}});
  renderer.domElement.addEventListener('pointerleave',()=>{hoverId=null;highlight()});
  // A touch scroll must not accidentally choose a restaurant.
  let down=null;renderer.domElement.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY}});
  renderer.domElement.addEventListener('click',event=>{if(!interactive||!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>8)return;const id=pick(event);if(id)onSelect(id);down=null});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();container.hidden=true;const fallback=document.getElementById('wheel-fallback');if(fallback)fallback.hidden=false;container.dispatchEvent(new CustomEvent('wheel-context-lost'))});
  container.append(renderer.domElement);setSnacks(initialSnacks);const observer=new ResizeObserver(resize);observer.observe(container);resize();
  return{setSnacks,resize,explode,snapshot(){render();const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;canvas.getContext('2d')?.drawImage(renderer.domElement,0,0);return canvas},rotate(angle){wheel.rotation.z=-angle;render()},select(id){selectedId=id;highlight()},setInteractive(value){interactive=value;if(!value){hoverId=null;renderer.domElement.style.cursor='default';highlight()}},dispose(){observer.disconnect();renderer.dispose();env.dispose()}};
}
