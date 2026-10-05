// Independent rendered-DOM oracle. Names come from canonical game records, not the production linker.
export function auditUIReferences(root,names){
  const unique=[...new Set(names.filter(n=>typeof n==='string'&&n.length>2))].sort((a,b)=>b.length-a.length),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=unique.length?new RegExp('(?<![\\p{L}\\p{N}_])('+unique.map(escape).join('|')+')(?![\\p{L}\\p{N}_])','gu'):null;
  const missing=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,visibleTextNodes=0;
  while(node=walker.nextNode()){
    const parent=node.parentElement;if(!parent||!node.nodeValue.trim()||parent.closest('[hidden],[inert],script,style,pre,code,textarea,select,input'))continue;
    if(!parent.getClientRects().length||getComputedStyle(parent).visibility==='hidden')continue;
    visibleTextNodes++;
    if(parent.closest('a[href],button,summary,[data-cmd],[data-pk],[data-detail-building],[data-detail-settlement]'))continue;
    if(!re)continue;re.lastIndex=0;for(const m of node.nodeValue.matchAll(re))missing.push({name:m[0],element:parent.id||parent.closest('[id]')?.id||parent.tagName.toLowerCase(),text:node.nodeValue.trim().slice(0,180)});
  }
  const deadLinks=[...root.querySelectorAll('a.nm,a.pp,a.tr')].filter(a=>a.getClientRects().length&&!a.closest('[hidden],[inert]')&&(!a.hasAttribute('href')||!a.dataset.nm&&!a.dataset.pid&&!a.dataset.tree)).map(a=>a.textContent);
  return{visibleTextNodes,missing,deadLinks,valid:visibleTextNodes>0&&!missing.length&&!deadLinks.length};
}
