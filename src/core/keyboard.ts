export type StudioShortcut='play'|'stop'|'undo'|'save'|'open'|'device'|'sequence'|'samples'|'effects'|'library'|'system'|'track1'|'track2'|'track3'|'track4';
export function shortcutFromKeyboard(event:KeyboardEvent):StudioShortcut|undefined{
 const target=event.target as HTMLElement|null;if(target&&['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
 const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
 if(event.code==='Space')return'play';if(key==='escape')return'stop';
 if(mod&&key==='z')return'undo';if(mod&&key==='s')return'save';if(mod&&key==='o')return'open';
 if(event.altKey&&event.shiftKey&&['1','2','3','4'].includes(key))return(`track${key}` as StudioShortcut);
 if(event.altKey&&key==='1')return'device';if(event.altKey&&key==='2')return'sequence';if(event.altKey&&key==='3')return'samples';if(event.altKey&&key==='4')return'effects';if(event.altKey&&key==='5')return'library';if(event.altKey&&key==='6')return'system';
}
