import type { SessionState } from '../core/SloopDeviceSession';
import type { VirtualSloopTransport } from '../core/VirtualSloopTransport';

const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export async function bounceCurrentPattern(transport:VirtualSloopTransport,state:SessionState,bpm:number):Promise<AudioBuffer>{const stepSeconds=60/Math.max(20,bpm)/4;const events:Array<{time:number;track:number;note:string;duration:number;velocity:number}>=[];for(const step of state.steps){for(const note of step.notes){events.push({time:step.index*stepSeconds,track:state.selectedTrack,note:toNote(note),duration:stepSeconds*.8,velocity:Math.max(.05,Math.min(1,step.velocity/127))});}}const total=Math.max(stepSeconds,(state.info?.stepCount??64)*stepSeconds);const capable=transport as VirtualSloopTransport&{bounce?:(events:typeof events,seconds:number)=>Promise<AudioBuffer>};if(!capable.bounce)throw new Error('Virtual bounce engine unavailable.');return capable.bounce(events,total);}
function toNote(note:number){return`${NOTE_NAMES[note%12]}${Math.floor(note/12)-1}`;}
