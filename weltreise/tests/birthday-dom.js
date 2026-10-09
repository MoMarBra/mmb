// The small DOM surface used by seasonal controllers, shared with the app VM tests.
export class BirthdayElement {
 constructor(tagName='div'){
  Object.assign(this,{tagName,id:'',className:'',children:[],parentNode:null,style:{cssText:''},attrs:{},dataset:{},textContent:'',hidden:false});
  this.classList={
   contains:name=>this.className.split(/\s+/).includes(name),
   add:(...names)=>{for(const name of names)if(!this.classList.contains(name))this.className=[this.className,name].filter(Boolean).join(' ');},
   remove:(...names)=>{this.className=this.className.split(/\s+/).filter(x=>!names.includes(x)).join(' ');},
   toggle:(name,force)=>{const on=force??!this.classList.contains(name);this.classList[on?'add':'remove'](name);return on;},
  };
 }
 setAttribute(key,value){this.attrs[key]=String(value);}
 getAttribute(key){return this.attrs[key]??null;}
 get textContent(){return this._textContent??'';}
 set textContent(value){this.replaceChildren();this._textContent=String(value);}
 get innerHTML(){return this._innerHTML??'';}
 set innerHTML(markup){
  // Parse the controller's fixed decorative SVG into stable node identities.
  // This deliberately models only its trusted markup, not a general HTML parser.
  this.replaceChildren();const stack=[this];
  for(const match of String(markup).matchAll(/<(\/?)([\w-]+)([^>]*?)(\/?)>/g)){
   if(match[1]){stack.pop();continue;}
   const child=new BirthdayElement(match[2]);child.ownerDocument=this.ownerDocument;
   for(const attr of match[3].matchAll(/([\w-]+)="([^"]*)"/g)){
    child.setAttribute(attr[1],attr[2]);if(attr[1]==='class')child.className=attr[2];if(attr[1]==='id')child.id=attr[2];
   }
   stack.at(-1).append(child);if(!match[4])stack.push(child);
  }
  this._innerHTML=String(markup);
 }
 append(...nodes){
  for(const node of nodes){
   if(node.tagName==='#document-fragment'){this.append(...node.children.slice());continue;}
   node.remove();node.parentNode=this;this.children.push(node);
  }
 }
 replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this._innerHTML='';this._textContent='';this.append(...nodes);}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}}
 querySelectorAll(selector){
  const matches=node=>selector==='*'||(selector.startsWith('.')?node.classList.contains(selector.slice(1)):selector.startsWith('#')?node.id===selector.slice(1):node.tagName===selector);
  return this.children.flatMap(node=>[...(matches(node)?[node]:[]),...node.querySelectorAll(selector)]);
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}

export function installBirthdayDom(document={},elements={}){
 document.body=new BirthdayElement('body');
 document.createElement=tag=>{const node=new BirthdayElement(tag);node.ownerDocument=document;return node;};
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

