import {BirthdayElement,installBirthdayDom} from './birthday-dom.js';

export function installHolidayDom(document={},elements={}){
 if(!document.body)installBirthdayDom(document,elements);
 for(const [id,tag] of [
  ['holiday-card','section'],['holiday-eyebrow','p'],['holiday-title','h2'],
  ['holiday-message','p'],['holiday-date','p'],['holiday-art','div'],['holiday-ship-decoration','span'],
 ]){
  const node=new BirthdayElement(tag);node.id=id;node.ownerDocument=document;elements[id]=node;
 }
 const card=elements['holiday-card'];card.hidden=true;card.setAttribute('aria-labelledby','holiday-title');
 elements['holiday-ship-decoration'].hidden=true;
 elements['holiday-art'].setAttribute('aria-hidden','true');
 elements['holiday-ship-decoration'].setAttribute('aria-hidden','true');
 card.append(...['holiday-eyebrow','holiday-title','holiday-message','holiday-date','holiday-art'].map(id=>elements[id]));
 document.body.append(card,elements['holiday-ship-decoration']);
 document.getElementById=id=>elements[id]??null;
 return {document,elements};
}
