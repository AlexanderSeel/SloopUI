import type { SloopVirtualEngine } from './virtualProfiles';

export interface VirtualDescriptor{label:string;format:number;min:number;max:number;defaultValue:number;unit:string;enumValues:string[]}
const d=(label:string,format:number,min:number,max:number,defaultValue:number,unit='',enumValues:string[]=[]):VirtualDescriptor=>({label,format,min,max,defaultValue,unit,enumValues});
const en=(label:string,values:string[],defaultValue=0)=>d(label,8,0,values.length-1,defaultValue,'',values);
const ONOFF=['OFF','ON'],LFO_WAVE=['SIN','TRI','SAW','SQR','S&H'],ARP_MODE=['OFF','UP','DN','UPDN','RND','ORD'],DIV=['1/4','1/8','1/16','1/32','8T','16T'],ORDER=['NOTE','PLAY'],SCALE=['CHR','MAJ','MIN','DOR','MIX','PEN','MPEN','HARM','PHRY','LYD','LOC','MEL','BLUES','WHOLE','DIMHW','DIMWH'],QUANT=['OFF','SNAP','WHITE'],VOICE=['POLY','MONO','LEG','UNI'],GLMODE=['RATE','TIME'],PRIO=['LAST','LOW','HIGH'],ALLOC=['ROT','REUSE'],SLCR=['OFF','GATE','STUT'],SLDIV=['1/8','1/16','1/32','8T','16T','32T'],CHORD=['OFF','TRIAD','7TH','9TH','SUS4','POWER'];
export const TRACK_COMMON:VirtualDescriptor[]=[
 d('LVL',6,0,127,104),d('ATK',3,0,127,10),d('DEC',3,0,127,70),d('SUS',1,0,127,90),d('REL',3,0,127,60),
 d('FLT',2,-64,63,0),d('PIT',2,-64,63,0),d('SHP',2,-64,63,0),d('TRIM',0,-64,63,0),
 d('RATE',4,0,127,60),en('WAVE',LFO_WAVE),d('PHS',0,0,127,0),d('FADE',3,0,127,0),d('PIT',2,-64,63,0),d('FLT',2,-64,63,0),d('SHP',2,-64,63,0),d('AMP',1,0,127,0),
 en('MODE',ARP_MODE),en('RATE',DIV,2),d('OCT',0,1,4,1),d('GATE',1,1,127,64),d('SWG',14,0,100,0),d('PROB',1,0,127,127),en('HOLD',ONOFF),en('ORD',ORDER),
 d('ROOT',10,0,11,0),en('SCL',SCALE),en('QNT',QUANT),d('TRN',7,-24,24,0),d('LEN',13,1,64,16),en('DIV',DIV,2),d('SWG',14,0,100,0),d('GATE',1,1,127,64),
 d('DST',1,0,127,0),d('CHO',1,0,127,0),d('DLY',1,0,127,0),d('REV',1,0,127,0),en('VCE',VOICE),d('GLD',3,0,127,0),d('PAN',2,-64,63,0),en('MUTE',ONOFF),
 en('GLMOD',GLMODE),en('PRIO',PRIO),en('ALLOC',ALLOC),d('DTUNE',0,0,127,40),en('SLCR',SLCR),d('PAT',0,1,16,1),en('RATE',SLDIV,1),d('DEPTH',1,0,127,127),en('CHORD',CHORD),
];
export const ENGINE_PARAMETER_START=TRACK_COMMON.length;
const generic=(label:string,min=0,max=127,def=0,format=1,unit='')=>d(label,format,min,max,def,unit);
const ENGINE_DESCRIPTORS:Record<SloopVirtualEngine,VirtualDescriptor[]>={
 ANALOG:[en('WAVE',['SAW','SQR','TRI','SIN','PWM']),d('DTN',0,0,127,10,'ct'),generic('MIX',0,127,64),generic('NOIS'),d('CUT',5,0,127,90),generic('RES',0,127,30),generic('DRV'),generic('KTR',0,127,64)],
 DIGITAL:[en('ALG',['1','2','3','4','2+2','6','7','8']),en('R2',['.5','1','2','3','4','5','6','7','8','9','10','12','16','20','24'],1),en('R3',['.5','1','2','3','4','5','6','7','8','9','10','12','16','20','24'],1),en('R4',['.5','1','2','3','4','5','6','7','8','9','10','12','16','20','24'],1),generic('IDX',0,127,60),d('MDEC',3,0,127,60),generic('FB'),d('-',0,0,0,0)],
 PHASE:[en('WAVE',['SAW','SQR','PULSE','DOUBLE','RESON','CZ5','CZ6','CZ7']),en('WAVE2',['OFF','SAW','SQR','PULSE','DOUBLE','RESON','CZ5','CZ6','CZ7']),generic('DCW',0,127,60),generic('ENV',0,127,64),d('DTN',0,0,127,0,'ct'),en('LINE',['MIX','RING']),generic('SUB'),d('-',0,0,0,0)],
 LOFI:[en('CHIP',['4BIT','8BIT','1BIT','NOISE','STEP']),en('WAVE',['PULSE','TRI','SAW','NOIS','WRAM']),d('DUTY',0,0,127,64),generic('CRSH'),generic('SWP'),generic('VIB'),en('ARP',['OFF','OCT','MAJ','MIN']),generic('TONE',0,127,127)],
 SAMPLE:[en('SET',['PIANO','BASS','VIBES','HORN','STRINGS','FLUTE','SCRATCH','GM KIT','USR1','USR2','USR3']),d('TUNE',7,-24,24,0),d('BITS',0,0,127,0),en('LOOP',ONOFF,1),d('CUT',0,0,127,127),d('-',0,0,0,0),generic('DRV'),d('-',0,0,0,0)],
 VOICE:[d('VOWL',0,0,127,0),d('VOWL2',0,0,127,64),d('TALK',3,0,127,0),d('SHIFT',7,-12,12,0),generic('BUZZ',0,127,64),generic('BRTH',0,127,10),generic('Q',0,127,64),generic('RAND')],
 TRIO:[en('WAVE',['SAW','SQR','TRI','NOISE','STACK','PHASE','SYNC','RING','ALT','SYNC SAW','SYNC PLS','W11','W12','W13','W14','W15']),d('INT2',7,-24,24,0),d('INT3',7,-24,24,-12),d('DTN',0,0,50,6,'ct'),en('MODE',['LP','BP','HP','NOTCH']),d('CUT',5,0,127,80),generic('RES',0,127,40),generic('PW',0,127,64)],
 WHEEL:[en('REG',Array.from({length:16},(_,i)=>`REG ${i+1}`),4),d('SUB',0,-8,8,0),d('BODY',0,-8,8,0),d('TOP',0,-8,8,0),en('PERC',['OFF','2ND','3RD','SOFT 2','SOFT 3','FAST 2','FAST 3']),generic('CLICK',0,127,40),generic('DRV'),en('ROTR',['OFF','SLOW','FAST'],1)],
 GRAIN:[en('SRC',['PIANO','BASS','VIBES','HORN','STRINGS','FLUTE','SCRATCH','GM KIT','USR1','USR2','USR3']),generic('POS',0,127,32),generic('SIZE',0,127,80),generic('DENS',0,127,80),d('PTCH',7,-24,24,0),generic('SPRD',0,127,30),generic('RAND',0,127,10),generic('TONE',0,127,127)],
};
export function engineDescriptors(engine:SloopVirtualEngine){return ENGINE_DESCRIPTORS[engine]??ENGINE_DESCRIPTORS.ANALOG;}
const CLICK=['OFF','REC','ON'],SYNC=['INT','USB','TRS'],GO=['--','GO'],ROLL=['1/8','1/16','1/32','32T','1/64'];
export const GLOBAL_DESCRIPTORS:VirtualDescriptor[]=[
 d('BPM',9,40,240,90,'bpm'),d('SWING',14,0,100,0),en('CLICK',CLICK),d('TUNE',0,-50,50,0),en('TIME',DIV,1),generic('FDBK',0,120,60),generic('COLR',0,127,70),generic('MIX',0,127,90),generic('SIZE',0,127,90),generic('DAMP',0,127,60),d('CRT',4,0,127,40),generic('CDP',0,127,60),en('MIDI',['--']),en('SYNC',SYNC),en('ROUT',['--']),d('CPU',0,0,0,0),d('SLOT',0,1,4,1),en('NAME',['--']),en('LOAD',GO),en('SAVE',GO),en('ENG',['ANALOG','DIGITAL','PHASE','LOFI','SAMPLE','VOICE','TRIO','WHEEL','GRAIN']),en('SET',GO),en('CLRSQ',GO),en('INIT',GO),d('CH',0,0,16,10),d('LVL',0,0,127,100),d('REV',0,0,127,16),generic('DUST'),generic('DUCK'),d('FILT',15,-64,63,0),en('ROLL',ROLL,1),en('NEW',GO)
];
export const TRACK_PARAMETER_COUNT=ENGINE_PARAMETER_START+8;
