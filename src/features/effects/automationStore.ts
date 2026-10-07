const lanes=new Map<string,number[]>();
export function setAutomationLane(key:string,values:number[]){lanes.set(key,[...values.slice(0,64)]);}
export function getAutomationValue(key:string,step:number){const lane=lanes.get(key);return lane?.length?lane[step%lane.length]:undefined;}
export function getAutomationKeys(){return[...lanes.keys()];}
export function clearAutomationLane(key:string){lanes.delete(key);}
