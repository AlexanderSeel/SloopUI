export const SLOOP_VIRTUAL_ENGINES=['ANALOG','DIGITAL','PHASE','LOFI','SAMPLE','VOICE','TRIO','WHEEL','GRAIN'] as const;
export type SloopVirtualEngine=typeof SLOOP_VIRTUAL_ENGINES[number];
export const SLOOP_FACTORY_PRESETS:Record<SloopVirtualEngine,string[]>={
 ANALOG:['808 BOOM','808 DIRTY','SUB BASS','808 SLIDE','ACID 303','PLUGG BASS','REESE','WOBBLE','FUNK BASS','G-FUNK LD','TRAP PLUCK','SYN BRASS','SUPERSAW','WARM PAD','DARK STR','ATMOS PAD'],
 DIGITAL:['RHODES','DX RHODES','WURLI','CLAV','M1 PIANO','AFRO KEYS','TRAP BELL','MUSIC BOX','MARIMBA','KALIMBA','PLUGG BELL','GLASS PAD','FM BASS'],
 PHASE:['CZ BASS','SOFT KEYS','CZ STRING','RESO PLUCK','CZ BRASS'],
 LOFI:['GAME LEAD','GB BASS','8BIT ARP'],
 SAMPLE:['GRAND PNO','UP BASS','VIBES','HORN STAB','STRING STB','LOFI FLUTE','SCRATCH','GM KIT','DUSTY PNO','LOFI KEYS','DEEP BASS'],
 VOICE:['CHOIR AAH','SOUL OOH','TALKBOX','WOW BASS'],
 TRIO:['FAT BASS','MIN STAB','MIN7 STAB','RAVE STAB','DUB CHORD','SAW PAD','SYNC LEAD','HOOVER'],
 WHEEL:['SOUL ORGAN','GOSPEL','JAZZ ORGAN','DIRTY B3','HOUSE ORGN'],
 GRAIN:['LOFI CLOUD','VIBE HAZE','FLUTE DUST'],
};
export interface VirtualPresetProfile{wave:'sine'|'square'|'sawtooth'|'triangle';attack:number;decay:number;sustain:number;release:number;detune:number;drive:number;}
export function virtualPresetProfile(engine:SloopVirtualEngine,preset:number):VirtualPresetProfile{const name=SLOOP_FACTORY_PRESETS[engine]?.[preset]??'';let wave:VirtualPresetProfile['wave']='sawtooth';if(engine==='DIGITAL'||engine==='PHASE'||engine==='VOICE')wave='sine';if(engine==='LOFI'||engine==='WHEEL')wave='square';if(engine==='GRAIN')wave='triangle';let attack=.01,decay=.25,sustain=.7,release=.5,detune=0,drive=.05;if(/PAD|STR|CLOUD|HAZE|CHOIR|OOH/.test(name)){attack=.35;release=1.8;sustain=.8;}if(/BASS|808|303/.test(name)){attack=.002;decay=.28;sustain=.45;release=.2;drive=.18;}if(/PLUCK|BELL|VIBES|MARIMBA|KALIMBA|CLAV|STAB/.test(name)){attack=.001;decay=.22;sustain=.12;release=.35;}if(/SUPERSAW|HOOVER|REESE/.test(name)){wave='sawtooth';detune=18;drive=.22;}if(/8BIT|GAME|GB/.test(name)){wave='square';release=.12;}if(/ORGAN|GOSPEL|B3/.test(name)){wave='square';attack=.005;sustain=.92;release=.18;}return{wave,attack,decay,sustain,release,detune,drive};}
