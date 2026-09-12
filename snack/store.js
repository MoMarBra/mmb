export const ratingKey=(personId,snackId)=>JSON.stringify([String(personId),String(snackId)]);
export const normalizeAngle=a=>((a%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
export function spinTarget(start,index,count,turns=5){
  if(!Number.isInteger(count)||count<1||index<0||index>=count)throw new RangeError('Invalid segment');
  // Blender sector 0 points up. Indices run clockwise; rotate clockwise by a positive distance.
  const desired=normalizeAngle(-index*Math.PI*2/count);
  return start+Math.max(1,Math.floor(turns))*Math.PI*2+normalizeAngle(desired-normalizeAngle(start));
}
export function winnerAt(rotation,count){return Math.round(normalizeAngle(-rotation)*count/(Math.PI*2))%count;}
export const sampleWinner=(count,random=Math.random)=>Math.min(count-1,Math.max(0,Math.floor(random()*count)));
export const mean=values=>{const rated=values.filter(v=>Number.isInteger(v)&&v>0&&v<=5);return{count:rated.length,average:rated.length?rated.reduce((a,b)=>a+b,0)/rated.length:0}};

export class RatingStore{
  constructor(adapter){this.adapter=adapter;this.snacks=[];this.people=[];this.ratings=new Map();this.statuses=new Map();this.versions=new Map();this.tasks=new Map();this.listeners=new Set();this.loading=false;this.loaded=false;this.error=null;}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(){this.listeners.forEach(fn=>fn(this))}
  get(personId,snackId){return this.ratings.get(ratingKey(personId,snackId))||0}
  status(personId,snackId){return this.statuses.get(ratingKey(personId,snackId))||{state:'idle'}}
  get failures(){return [...this.statuses.values()].filter(s=>s.state==='error')}
  get pending(){return this.tasks.size>0}
  async drain(){while(this.tasks.size)await Promise.all([...this.tasks.values()])}
  async load(){
    if(this.loading)return this.loadPromise;
    this.loading=true;this.error=null;this.emit();
    this.loadPromise=(async()=>{
      try{
        await this.drain();
        if(this.failures.length)throw new Error('Bitte die ungespeicherten Bewertungen zuerst erneut speichern.');
        const data=await this.adapter.loadAll();
        const snacks=(data.snack||[]).map(s=>({...s,id:String(s.id),name:String(s.name)}));
        const people=(data.person||[]).map(p=>({...p,id:String(p.id),name:String(p.name)}));
        const snackIds=new Set(snacks.map(s=>s.id)),personIds=new Set(people.map(p=>p.id));
        const ratings=new Map();
        for(const r of data.snack_rating||[]){const stars=Number(r.stars);if(snackIds.has(String(r.snack_id))&&personIds.has(String(r.person_id))&&Number.isInteger(stars)&&stars>=1&&stars<=5)ratings.set(ratingKey(r.person_id,r.snack_id),stars);}
        this.snacks=snacks;this.people=people;this.ratings=ratings;this.statuses.clear();this.versions.clear();this.loaded=true;
      }catch(e){this.error=e instanceof Error?e.message:'Die Daten konnten nicht geladen werden.';throw e;}
      finally{this.loading=false;this.emit()}
    })();
    return this.loadPromise;
  }
  setRating(personId,snackId,stars){
    personId=String(personId);snackId=String(snackId);
    if(this.loading)throw new Error('Die Daten werden gerade neu geladen.');
    if(!this.people.some(p=>p.id===personId)||!this.snacks.some(s=>s.id===snackId))throw new Error('Person oder Restaurant nicht mehr verfügbar.');
    if(!Number.isInteger(stars)||stars<1||stars>5)throw new RangeError('Bitte 1 bis 5 Sterne wählen.');
    const key=ratingKey(personId,snackId),version=(this.versions.get(key)||0)+1;
    this.versions.set(key,version);this.ratings.set(key,stars);
    this.statuses.set(key,{state:'pending',personId,snackId,stars,version});
    // One in-flight request per rating; unrelated ratings remain independent.
    const previous=this.tasks.get(key)||Promise.resolve();
    const task=previous.then(async()=>{
      if(this.versions.get(key)!==version)return; // coalesce clicks not sent yet
      try{
        await this.adapter.saveRating(personId,snackId,stars);
        if(this.versions.get(key)===version)this.statuses.set(key,{state:'saved',personId,snackId,stars,version});
      }catch(e){
        if(this.versions.get(key)===version)this.statuses.set(key,{state:'error',personId,snackId,stars,version,message:e.message||'Speichern fehlgeschlagen'});
      }
    }).finally(()=>{if(this.tasks.get(key)===task)this.tasks.delete(key);this.emit()});
    this.tasks.set(key,task);this.emit();return task;
  }
  async retryFailed(){if(this.loading)return;await Promise.all(this.failures.map(r=>this.setRating(r.personId,r.snackId,this.get(r.personId,r.snackId))));if(!this.failures.length&&this.error?.startsWith('Bitte die ungespeicherten')){this.error=null;this.emit()}}
  restaurantStats(){
    const items=this.snacks.map(sn=>({...sn,...mean(this.people.map(p=>this.get(p.id,sn.id)))})).sort((a,b)=>b.average-a.average||a.name.localeCompare(b.name,'de'));
    let last=null,rank=0;items.forEach((s,i)=>{const rounded=Math.round(s.average*10000);if(rounded!==last){rank=i+1;last=rounded}s.rank=s.count?rank:null});return items;
  }
  personStats(personId){return mean(this.snacks.map(s=>this.get(personId,s.id)))}
}

export class SupabaseAdapter{
  constructor({url,key},fetcher=globalThis.fetch.bind(globalThis)){this.url=url;this.key=key;this.fetcher=fetcher;this.mode='supabase'}
  async request(path,options={}){
    const response=await this.fetcher(`${this.url}/rest/v1/${path}`,{...options,signal:options.signal||AbortSignal.timeout(20000),headers:{apikey:this.key,...options.headers}});
    if(!response.ok){let detail;try{detail=await response.json()}catch{}throw new Error(detail?.message||`Verbindung fehlgeschlagen (${response.status}).`)}
    return response;
  }
  async readPages(table,query){
    const all=[],pageSize=500;
    for(let offset=0;;offset+=pageSize){
      const response=await this.request(`${table}?${query}&limit=${pageSize}&offset=${offset}`);
      const rows=await response.json();if(!Array.isArray(rows))throw new Error('Unerwartete Datenantwort.');all.push(...rows);if(rows.length<pageSize)return all;
    }
  }
  async loadAll(){
    const [snack,person,snack_rating]=await Promise.all([
      this.readPages('snack','select=id,name,color&active=eq.true&order=name.asc,id.asc'),
      this.readPages('person','select=id,name&active=eq.true&order=id.asc'),
      this.readPages('snack_rating','select=person_id,snack_id,stars&order=person_id.asc,snack_id.asc')
    ]);return{snack,person,snack_rating};
  }
  async saveRating(person_id,snack_id,stars){await this.request('snack_rating',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({person_id,snack_id,stars})})}
}

// Explicit opt-in only. The delivered configuration uses the existing database.
export class LocalAdapter{
  constructor(storage=globalThis.localStorage,fetcher=globalThis.fetch.bind(globalThis)){this.storage=storage;this.fetcher=fetcher;this.mode='local';this.key='snack-preview-ratings-v2'}
  async loadAll(){const response=await this.fetcher('./data/snapshot.json');if(!response.ok)throw new Error('Lokale Beispieldaten fehlen.');const data=await response.json();let saved={};try{saved=JSON.parse(this.storage.getItem(this.key)||'{}')}catch{}const map=new Map(data.snack_rating.map(r=>[ratingKey(r.person_id,r.snack_id),r]));Object.entries(saved).forEach(([key,r])=>map.set(key,r));return{...data,snack_rating:[...map.values()]}}
  async saveRating(person_id,snack_id,stars){let saved=JSON.parse(this.storage.getItem(this.key)||'{}');saved[ratingKey(person_id,snack_id)]={person_id,snack_id,stars};this.storage.setItem(this.key,JSON.stringify(saved))}
}
