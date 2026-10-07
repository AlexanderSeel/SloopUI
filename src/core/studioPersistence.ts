import type { SessionState } from './SloopDeviceSession';

export interface StudioPreferences { theme:'dark'; compact:boolean; defaultMode:'hardware'|'virtual'; midiInputId?:string; midiOutputId?:string; }
export interface StudioAutosave { version:1; savedAt:string; mode:'hardware'|'virtual'; state:Pick<SessionState,'selectedTrack'|'tracks'|'values'|'steps'|'drumSteps'|'soloMask'>; }
const PREF_KEY='sloopui.preferences.v1'; const AUTO_KEY='sloopui.autosave.v1';
export const DEFAULT_PREFERENCES:StudioPreferences={theme:'dark',compact:true,defaultMode:'virtual'};
export function loadPreferences():StudioPreferences{try{return{...DEFAULT_PREFERENCES,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return DEFAULT_PREFERENCES;}}
export function savePreferences(value:StudioPreferences){localStorage.setItem(PREF_KEY,JSON.stringify(value));}
export function saveAutosave(mode:'hardware'|'virtual',state:SessionState){const data:StudioAutosave={version:1,savedAt:new Date().toISOString(),mode,state:{selectedTrack:state.selectedTrack,tracks:state.tracks,values:state.values,steps:state.steps,drumSteps:state.drumSteps,soloMask:state.soloMask}};localStorage.setItem(AUTO_KEY,JSON.stringify(data));return data;}
export function loadAutosave():StudioAutosave|undefined{try{const raw=localStorage.getItem(AUTO_KEY);if(!raw)return;const parsed=JSON.parse(raw) as StudioAutosave;return parsed.version===1?parsed:undefined;}catch{return undefined;}}
export function clearAutosave(){localStorage.removeItem(AUTO_KEY);}
