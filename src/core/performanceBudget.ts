export const PERFORMANCE_BUDGETS={waveformPeakBuckets:4096,maxDiagnosticEvents:300,maxUndoEntries:20,maxVisiblePianoCells:4096,maxAutomationLanes:8} as const;
export function assertPerformanceBudget(name:keyof typeof PERFORMANCE_BUDGETS,value:number){return value<=PERFORMANCE_BUDGETS[name];}
