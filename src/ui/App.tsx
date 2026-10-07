import { useEffect, useMemo, useRef, useState } from 'react';
import { CirclePower, Cpu, Waves } from 'lucide-react';
import { SloopDeviceSession, type SessionState } from '../core/SloopDeviceSession';
import { WebMidiSloopTransport } from '../core/WebMidiSloopTransport';
import { VirtualSloopTransport } from '../core/VirtualSloopTransport';
import type { MidiPortDescriptor, MidiPortSelection } from '../core/portTypes';
import { loadPreferences, saveAutosave, savePreferences, type StudioWorkspace } from '../core/studioPersistence';
import { shortcutFromKeyboard } from '../core/keyboard';
import { logDiagnostic } from '../core/diagnostics';
import { getAutomationKeys, getAutomationValue } from '../features/effects/automationStore';
import { getTrackSequenceLength, shouldPlayStep } from '../features/sequencer/sequenceRuntime';
import { captureStudioProject, parseProjectFile, restoreStudioProject, type ProjectTrackFile } from '../features/projects/projectFile';
import { ConnectionSetup } from './components/ConnectionSetup';
import { DevicePanel } from './components/DevicePanel';
import { SampleEditor } from './components/SampleEditor';
import { Sequencer } from './components/Sequencer';
import { MixerPanel } from './components/MixerPanel';
import { LibraryPanel } from './components/LibraryPanel';
import { EffectsRack } from './components/EffectsRack';
import { ArrangerPanel } from './components/ArrangerPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { SystemPanel } from './components/SystemPanel';
import { VirtualBouncePanel } from './components/VirtualBouncePanel';
import { VirtualSampleMap } from './components/VirtualSampleMap';
import { ResizableDock } from './components/ResizableDock';
import { MidiLearnPanel } from './components/MidiLearnPanel';
import { GlobalTransportBar } from './components/GlobalTransportBar';

const EMPTY_STATE:SessionState={loading:false,connected:false,selectedTrack:0,tracks:[],descriptors:[],values:{},steps:[],drumSteps:[],sampleSlots:[],soloMask:0};
const WORKSPACES:[StudioWorkspace,string][]=[['synth','SYNTH'],['sequence','SEQUENCE'],['samples','SAMPLES'],['effects','FX / MOD'],['library','LIBRARY'],['system','SYSTEM']];

export function App(){
 const prefs=useMemo(()=>loadPreferences(),[]),projectInput=useRef<HTMLInputElement>(null);
 const[workspace,setWorkspace]=useState<StudioWorkspace>(prefs.workspace),[mode,setMode]=useState<'hardware'|'virtual'>(prefs.defaultMode),[state,setState]=useState<SessionState>(EMPTY_STATE),[status,setStatus]=useState('Offline workspace ready'),[ports,setPorts]=useState<MidiPortDescriptor[]>([]),[selection,setSelection]=useState<MidiPortSelection>({inputId:prefs.midiInputId,outputId:prefs.midiOutputId}),[scanning,setScanning]=useState(false),[connectionError,setConnectionError]=useState<string>(),[playing,setPlaying]=useState(false),[playhead,setPlayhead]=useState(-1),[playAllTracks,setPlayAllTracks]=useState(true),[playbackTracks,setPlaybackTracks]=useState<ProjectTrackFile[]>();
 const transport=useMemo(()=>mode==='hardware'?new WebMidiSloopTransport(selection):new VirtualSloopTransport(),[mode,selection.inputId,selection.outputId]);
 const session=useMemo(()=>new SloopDeviceSession(transport),[transport]);
 const liveState=useRef(state),liveTracks=useRef<ProjectTrackFile[]|undefined>(undefined),globalStep=useRef(-1),playAllRef=useRef(playAllTracks);

 useEffect(()=>{const unsubscribe=session.subscribe(next=>{setState(next);if(next.connected)saveAutosave(mode,next);});setState(session.snapshot());return()=>unsubscribe();},[session,mode]);
 useEffect(()=>()=>{void session.disconnect();},[session]);
 useEffect(()=>{savePreferences({...prefs,defaultMode:mode,workspace,midiInputId:selection.inputId,midiOutputId:selection.outputId});},[mode,workspace,selection.inputId,selection.outputId]);
 useEffect(()=>{playAllRef.current=playAllTracks;},[playAllTracks]);
 useEffect(()=>{
  liveState.current=state;
  const tracks=liveTracks.current;
  if(!tracks?.length)return;
  const selected=state.selectedTrack,target=tracks.find(t=>t.index===selected);
  if(!target)return;
  if(selected===3)target.drums=state.drumSteps.map(s=>({...s,on:[...s.on],levels:[...s.levels],ratchets:[...s.ratchets]}));
  else target.steps=state.steps.map(s=>({...s,notes:[...s.notes]}));
 },[state]);
 useEffect(()=>{liveTracks.current=playbackTracks;},[playbackTracks]);

 useEffect(()=>{const handler=(event:KeyboardEvent)=>{const action=shortcutFromKeyboard(event);if(!action)return;event.preventDefault();if(action==='play'&&mode==='virtual'&&state.connected)void togglePlay();else if(action==='stop'){setPlaying(false);setPlaybackTracks(undefined);liveTracks.current=undefined;globalStep.current=-1;}else if(action==='device')setWorkspace('synth');else if(action==='sequence')setWorkspace('sequence');else if(action==='samples')setWorkspace('samples');else if(action==='effects')setWorkspace('effects');else if(action==='library')setWorkspace('library');else if(action==='system')setWorkspace('system');else if(action==='save'&&state.connected)void saveProject();else if(action==='open'&&state.connected)projectInput.current?.click();else if(action==='undo')window.dispatchEvent(new CustomEvent('sloopui:undo'));else if(action.startsWith('track')&&state.connected){const track=Number(action.slice(-1))-1;if(track>=0&&track<state.tracks.length)void session.selectTrack(track);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[mode,state.connected,state.tracks.length,session,playing,playAllTracks]);

 const bpmDescriptor=state.descriptors.find(d=>d.scope===1&&d.label.toUpperCase()==='BPM'),bpm=bpmDescriptor?state.values[`1:${bpmDescriptor.id}`]??bpmDescriptor.defaultValue:120;

 // Stable virtual clock: sequence edits update refs above and never recreate/reset this timer.
 // BPM changes reschedule the interval but preserve globalStep, so tempo changes are also phase-continuous.
 useEffect(()=>{
  if(!playing||mode!=='virtual'||!state.connected||!(transport instanceof VirtualSloopTransport)){setPlayhead(-1);return;}
  const ms=60000/Math.max(20,bpm)/4;
  const tick=()=>{
   const currentState=liveState.current,maximum=Math.max(1,currentState.info?.stepCount??64),tracks=liveTracks.current;
   const globalLength=playAllRef.current&&tracks?.length?Math.max(...tracks.map(track=>getTrackSequenceLength(track.index,maximum))):getTrackSequenceLength(currentState.selectedTrack,maximum);
   globalStep.current=(globalStep.current+1)%Math.max(1,globalLength);
   const current=globalStep.current,selectedLength=getTrackSequenceLength(currentState.selectedTrack,maximum),selectedIndex=current%selectedLength;
   setPlayhead(selectedIndex);

   for(const key of getAutomationKeys()){
    const raw=getAutomationValue(key,selectedIndex);if(raw==null)continue;
    const[scopeText,idText]=key.split(':'),scope=Number(scopeText) as 0|1,id=Number(idText),descriptor=currentState.descriptors.find(d=>d.scope===scope&&d.id===id);if(!descriptor)continue;
    const value=Math.round(descriptor.min+(raw/127)*(descriptor.max-descriptor.min));void session.setParameter(scope,id,value);
   }

   if(playAllRef.current&&tracks?.length){
    for(const track of tracks){
     if(!shouldPlayStep(track.index))continue;
     const localIndex=current%getTrackSequenceLength(track.index,maximum);
     if(track.index===3){const d=track.drums.find(s=>s.index===localIndex);d?.on.forEach((on,lane)=>{if(on)transport.triggerDrumSample(lane,.55+(d.levels[lane]??2)*.12);});}
     else{const s=track.steps.find(x=>x.index===localIndex);s?.notes.forEach(note=>transport.audition(midiToTone(note),'16n',track.index,(s.velocity??100)/127));}
    }
    return;
   }
   if(!shouldPlayStep(currentState.selectedTrack))return;
   if(currentState.selectedTrack===3){const d=currentState.drumSteps.find(s=>s.index===selectedIndex);d?.on.forEach((on,lane)=>{if(on)transport.triggerDrumSample(lane,.7);});}
   else{const s=currentState.steps.find(x=>x.index===selectedIndex);s?.notes.forEach(note=>transport.audition(midiToTone(note),'16n',currentState.selectedTrack,(s.velocity??100)/127));}
  };
  const timer=window.setInterval(tick,ms);return()=>window.clearInterval(timer);
 },[playing,mode,state.connected,bpm,transport,session]);

 async function togglePlay(){
  if(playing){setPlaying(false);setPlaybackTracks(undefined);liveTracks.current=undefined;return;}
  if(mode!=='virtual'||!state.connected)return;
  globalStep.current=-1;
  if(playAllTracks){setStatus('Preparing all-track playback…');try{const snapshot=await captureStudioProject(session);liveTracks.current=snapshot.tracks;setPlaybackTracks(snapshot.tracks);setStatus('All tracks ready');}catch(e){setStatus(e instanceof Error?e.message:'Unable to prepare all tracks');return;}}
  else{setPlaybackTracks(undefined);liveTracks.current=undefined;}
  setPlaying(true);
 }
 function changePlayAll(value:boolean){setPlayAllTracks(value);playAllRef.current=value;setStatus(value?'Playback scope: all tracks':'Playback scope: selected track');}
 async function connect(){setConnectionError(undefined);try{setStatus(mode==='hardware'?'Requesting Web MIDI + SysEx…':'Starting virtual audio engine…');logDiagnostic({kind:'info',message:`Connect ${mode}`});await session.connect();setStatus(mode==='hardware'?'SLOOP connected · WATCH live sync active':'Virtual SLOOP online');}catch(error){const message=error instanceof Error?error.message:'Connection failed';logDiagnostic({kind:'error',message});setStatus(message);setConnectionError(message);}}
 async function disconnect(){setPlaying(false);setPlaybackTracks(undefined);liveTracks.current=undefined;globalStep.current=-1;await session.disconnect();setStatus('Disconnected');}
 async function switchMode(){setPlaying(false);setPlaybackTracks(undefined);liveTracks.current=undefined;globalStep.current=-1;await session.disconnect().catch(()=>undefined);setState(EMPTY_STATE);setConnectionError(undefined);setMode(current=>current==='hardware'?'virtual':'hardware');setStatus('Mode changed · connect when ready');}
 async function scanMidi(){setScanning(true);setConnectionError(undefined);try{const found=await WebMidiSloopTransport.listPorts();setPorts(found);const input=found.find(p=>p.type==='input'&&/m-vave|fm-1|sloop/i.test(`${p.manufacturer} ${p.name}`)),output=found.find(p=>p.type==='output'&&/m-vave|fm-1|sloop/i.test(`${p.manufacturer} ${p.name}`));setSelection(current=>({inputId:current.inputId??input?.id,outputId:current.outputId??output?.id}));setStatus(`${found.length} MIDI ports found`);}catch(error){const message=error instanceof Error?error.message:'Unable to scan MIDI ports';setConnectionError(message);setStatus(message);}finally{setScanning(false);}}
 async function saveProject(){setStatus('Capturing project…');try{const project=await captureStudioProject(session),url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='sloop-project.sloop.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Project saved');}catch(e){setStatus(e instanceof Error?e.message:'Project save failed');}}
 async function openProject(file:File){setStatus('Restoring project…');try{await restoreStudioProject(session,parseProjectFile(await file.text()),message=>setStatus(message));setStatus('Project restored');}catch(e){setStatus(e instanceof Error?e.message:'Project restore failed');}}
 function audition(note:number){if(transport instanceof VirtualSloopTransport)transport.audition(midiToTone(note),'8n',state.selectedTrack,.85);}
 function renderWorkspace(){if(!state.connected)return <ConnectionSetup mode={mode} ports={ports} selection={selection} scanning={scanning} error={connectionError} onScan={()=>void scanMidi()} onSelectionChange={setSelection} onConnect={()=>void connect()}/>;if(workspace==='synth')return <ResizableDock label="SYNTH + MIX" left={<DevicePanel state={state} session={session}/>} right={<MixerPanel state={state} session={session}/>}/>;if(workspace==='sequence')return <ResizableDock label="SEQUENCER" left={<Sequencer state={state} session={session} virtual={mode==='virtual'} virtualTransport={transport instanceof VirtualSloopTransport?transport:undefined} playing={playing} playhead={playhead} playAllTracks={playAllTracks} onPlayAllTracksChange={changePlayAll} onTogglePlay={()=>void togglePlay()} onAudition={audition}/>} right={<ArrangerPanel state={state} session={session}/>}/>;if(workspace==='samples')return <div className="space-y-3"><SampleEditor state={state} session={session}/>{mode==='virtual'&&transport instanceof VirtualSloopTransport&&<VirtualSampleMap transport={transport}/>}</div>;if(workspace==='effects')return <div className="space-y-3"><EffectsRack state={state} session={session} virtual={mode==='virtual'}/>{mode==='virtual'&&transport instanceof VirtualSloopTransport&&<VirtualBouncePanel state={state} transport={transport} bpm={bpm}/>}</div>;if(workspace==='library')return <LibraryPanel state={state} session={session}/>;return <div className="space-y-3"><SystemPanel state={state} session={session} mode={mode}/><MidiLearnPanel state={state} session={session}/><DiagnosticsPanel state={state}/></div>;}

 return <main className="min-h-screen"><input ref={projectInput} type="file" accept="application/json,.json" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void openProject(f);e.currentTarget.value='';}}/><header className="sticky top-0 z-30 border-b border-white/8 bg-[#0c0f11]/95 px-3 pt-3 backdrop-blur-xl"><div className="mx-auto max-w-[1900px]"><div className="flex items-center justify-between gap-3 pb-3"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-md border border-emerald-300/30 bg-emerald-300/10"><Waves className="text-emerald-300" size={19}/></div><div><b>SloopUI</b><div className="text-[9px] uppercase tracking-[.2em] text-zinc-500">FM-1 studio · compact workspace</div></div></div><div className="flex items-center gap-2">{state.connected&&<GlobalTransportBar state={state} session={session}/>}<div className="hide-mobile text-right"><div className={`text-[11px] ${state.connected?'text-emerald-300':state.error||connectionError?'text-rose-300':'text-zinc-400'}`}>{state.loading?'Loading device…':state.error??connectionError??status}</div><div className="text-[9px] text-zinc-600">{state.info?`${state.info.firmware} · protocol v${state.info.protocolVersion}`:mode==='hardware'?'Direct Web MIDI / SysEx':'Tone.js virtual device'}</div></div><button onClick={()=>void switchMode()} className="tool"><Cpu size={13}/>{mode.toUpperCase()}</button><button disabled={state.loading} onClick={()=>void(state.connected?disconnect():connect())} className={`rounded px-3 py-2 text-[10px] font-black ${state.connected?'bg-emerald-300 text-black':'bg-white text-black'} disabled:opacity-40`}><CirclePower size={13} className="mr-1 inline"/>{state.connected?'DISCONNECT':'CONNECT'}</button></div></div>{state.connected&&<nav className="workspace-tabs" aria-label="Studio workspaces">{WORKSPACES.map(([id,label])=><button key={id} onClick={()=>setWorkspace(id)} className={`workspace-tab ${workspace===id?'workspace-tab-active':''}`}>{label}</button>)}</nav>}</div></header><div className="workspace-stage mx-auto max-w-[1900px] p-3">{renderWorkspace()}</div></main>;
}

function midiToTone(note:number){const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return`${names[note%12]}${Math.floor(note/12)-1}`;}
