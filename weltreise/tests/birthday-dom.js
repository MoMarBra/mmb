// The small DOM surface used by the party controller, shared with the app VM tests.
export class BirthdayElement {
 constructor(tagName='div'){
  Object.assign(this,{tagName,id:'',className:'',children:[],parentNode:null,style:{cssText:''},attrs:{},hidden:false});
  this.classList={
   contains:name=>this.className.split(/\s+/).includes(name),
   add:name=>{if(!this.classList.contains(name))this.className=[this.className,name].filter(Boolean).join(' ');},
   remove:name=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(' ');},
  };
 }
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 append(...nodes){
  for(const node of nodes){
   if(node.tagName==='#document-fragment'){this.append(...node.children.slice());continue;}
   node.remove();node.parentNode=this;this.children.push(node);
  }
 }
 replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this.append(...nodes);}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}}
 querySelectorAll(selector){
  const matches=node=>selector==='*'||(selector.startsWith('.')?node.classList.contains(selector.slice(1)):node.tagName===selector);
  return this.children.flatMap(node=>[...(matches(node)?[node]:[]),...node.querySelectorAll(selector)]);
 }
}

export function installBirthdayDom(document={},elements={}){
 document.body=new BirthdayElement('body');
 document.createElement=tag=>new BirthdayElement(tag);
 document.createDocumentFragment=()=>new BirthdayElement('#document-fragment');
 for(const [id,tag] of [['birthday-card','section'],['birthday-balloons','div'],['birthday-ship-pennants','span']]){
  const node=new BirthdayElement(tag);node.id=id;node.ownerDocument=document;elements[id]=node;
 }
 elements['birthday-card'].hidden=true;elements['birthday-ship-pennants'].hidden=true;
 elements['birthday-card'].append(elements['birthday-balloons']);
 document.body.append(elements['birthday-card'],elements['birthday-ship-pennants']);
 document.getElementById=id=>elements[id]??null;
 return {document,elements};
}
