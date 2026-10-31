const selector='a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),summary,iframe,[tabindex]:not([tabindex="-1"])';
/** Visible sequential tab stops, including the browser's single stop per radio group. */
export function tabStops(root: ParentNode): HTMLElement[] {
  const elements=[...root.querySelectorAll<HTMLElement>(selector)].filter(el=>{
    if(el.tabIndex<0||el.matches(':disabled')||el.closest('[hidden],[inert]'))return false;
    const bounds=el.getBoundingClientRect(),style=el.ownerDocument.defaultView!.getComputedStyle(el);
    return bounds.width>0&&bounds.height>0&&style.visibility!=='hidden'&&style.visibility!=='collapse';
  });
  return elements.filter(el=>{
    if(!el.matches('input[type="radio"]'))return true;
    const radio=el as HTMLInputElement;if(!radio.name)return true;
    const group=elements.filter(other=>other.matches('input[type="radio"]')&&(other as HTMLInputElement).name===radio.name&&(other as HTMLInputElement).form===radio.form) as HTMLInputElement[];
    return radio.checked||(!group.some(other=>other.checked)&&group[0]===radio);
  }).sort((a,b)=>(a.tabIndex>0?a.tabIndex:Infinity)-(b.tabIndex>0?b.tabIndex:Infinity));
}
