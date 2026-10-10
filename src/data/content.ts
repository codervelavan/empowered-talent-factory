// Site content and shared data. Copy is final; keep it verbatim.
// The assessment and drive URLs are still blank: set them to the real destinations.

export type Pose = 'stand' | 'point' | 'walk' | 'sit';
export type EcoActor = 'c' | 'i' | 'g';
export interface Eco {
  sect: string[];
  nodes: [EcoActor, number, number, number[]][];
}
export interface CareerLink { label: string; url: string }
export interface CareerConfig { assessment: CareerLink; drive: CareerLink }
export interface Industry {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  /** 1 while the copy is still a placeholder */
  ph?: 1;
  line: string;
  uses: string[];
}

export const ECO: Eco ={sect:['Manufacturing','Healthcare','Financial Services','Energy','Digital Government'],nodes:[['c',-8,-20,[0,1,4]],['c',20,-44,[1,3]],['c',22,-16,[2,4]],['c',-10,-42,[0,3]],['i',-14,-30,[0]],['i',14,-22,[1]],['i',-2,-46,[2]],['i',26,-32,[3]],['i',10,-40,[0,2]],['i',-4,-14,[4,2]],['g',18,-12,[4,1]],['g',-16,-40,[0,3]],['g',28,-44,[2,4]]]};
export const CAREER_CFG: CareerConfig ={assessment:{label:"Start Entry Assessment",url:""},drive:{label:"Register for the Weekend Assessment Drive",url:""}};
export const POSES: Record<Pose, [number, number][]> ={
 stand:[[-.03,.84],[-.035,.815],[-.12,.79],[-.145,.75],[-.165,.55],[-.175,.44],[-.15,.435],[-.13,.55],[-.115,.68],[-.105,.5],[-.09,.27],[-.085,.03],[-.11,0],[-.03,0],[-.035,.03],[-.015,.4],[.015,.4],[.035,.03],[.03,0],[.11,0],[.085,.03],[.09,.27],[.105,.5],[.115,.68],[.13,.55],[.15,.435],[.175,.44],[.165,.55],[.145,.75],[.12,.79],[.035,.815],[.03,.84]],
 point:[[-.03,.84],[-.035,.815],[-.12,.79],[-.145,.75],[-.165,.55],[-.175,.44],[-.15,.435],[-.13,.55],[-.115,.68],[-.105,.5],[-.09,.27],[-.085,.03],[-.11,0],[-.03,0],[-.035,.03],[-.015,.4],[.015,.4],[.035,.03],[.03,0],[.11,0],[.085,.03],[.09,.27],[.105,.5],[.115,.68],[.2,.84],[.26,.98],[.29,.965],[.22,.8],[.12,.79],[.035,.815],[.03,.84]],
 walk:[[-.03,.84],[-.035,.815],[-.12,.79],[-.145,.75],[-.2,.5],[-.18,.49],[-.12,.66],[-.105,.5],[-.13,.27],[-.17,.03],[-.2,0],[-.12,0],[-.125,.03],[-.03,.38],[.02,.38],[.09,.03],[.08,0],[.17,0],[.13,.03],[.1,.27],[.105,.5],[.12,.66],[.16,.5],[.185,.51],[.145,.75],[.12,.79],[.035,.815],[.03,.84]],
 sit:[[-.02,.585],[-.085,.55],[-.1,.45],[-.095,.28],[-.06,.235],[.22,.235],[.225,.02],[.31,0],[.31,.035],[.27,.045],[.27,.29],[.24,.315],[.04,.315],[.045,.4],[.2,.41],[.215,.44],[.06,.46],[.05,.54],[.02,.585]]
};
export const HEAD: Record<Pose, [number, number]> ={stand:[0,.92],point:[0,.92],walk:[0,.92],sit:[0,.66]};
export const LANDMASK: string ='/v98/58////hD///A+DB//8DAAb8//8BAAQAvv8HAAABAAj6BwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAgAAAAAAAAAAAABgAAAAAAAAAAAAAADAAQAAAAAAAAAAAAAAMAAAAAAAAAAABAAAAMABAAAAAAAAAAABAAAA4AAAAAAAAAAAAAgAAAAAHwAAAAAAAACAAAIAAACADwAAAAAAAADAAwAAAAAA/AAAAA4AAAA8fgAAAAAAAH8AAIAPAAAA/H8AAAAAAAD/AQAAPwAAAPD/AwAAAAAA4B8AAOAHAAAA/v8AAAAAAADwHwAA8I8BAAD8/wAAAAAAAOD/AQDAPwYAAOD/AwEAAAAAAP4fAAD8xwAAAOB/AAAAAAAAgP8PAAD+zwAAAOA3AAgAAAAAwP8fAAD+HwEAAIAGAAAAAAAAgP9/AADwfwAAAAAgAQAAAAAAAPz/BwCA/wMAAAAAgAAAAAAAAOD//wAA8H8AAAAYAIcAAAAAAAD8/w8AAP8PAABAAPAEAAAAAACA/z8AAOD/AwAAmAsEAAAAAAAAwP8DAAD4/wEAAPMAAAAAAAAAAPD/AAAA/v8AAMA4AAAAAAAAAAD8HwCA4P8/AAAUDAAAAAAAAACAfwAA/P//DwAAAAgAAAAAAAAAogcAwP///wEIkEAAAAAAAAAAEAAAAP7//wHAAA4EAAAAAAAA8AAAAPj//xsAAx4EAAAAAAAAfAAAAPj///uABx8EAAAACAAAJzAAAPj///7AwxcAAAAAAQDggAAAgP//7w9/fgEAAAAAAKADAAAA/P/fH/7/LwAAAAAAwAcBAAD8/+/z//8PAAAAAAD4IQAAAP//3////wAAAAAA4P8AAAD8d/////8IAAAAAPj/AAAAfgD///8fAAAAAMD/HwAAgAP4//9/MgAAAMD/HwAAOKA///+fAAAAAPj/BwCAw//7//9GAAAA8P8PAICvw/7//xMAAAD//wcA8N7z//8fAAAA//8JAPz/////BwAA8P8fAOD/////AwAA/L8PAPf///9/BADwfx8ABP///wcDAP/hACD6//8fAt7/GABg/f//L/D/SwRg////H/8/YwT///9//r894Pv//7yXeCDg/wv48QDgJwABDxADAPgRAADoCQLgAwAAAA==';
export const INDS: Industry[] =[
 {name:'Business & Finance',kind:'bank',lat:18,lon:18,line:'Analysis, forecasting and financial workflows.',uses:['Financial analysis and automated reporting','Forecasting for sales and operations','HR and finance workflow automation']},
 {name:'Healthcare',kind:'hospital',lat:40,lon:88,line:'Clinical support, documentation and research.',uses:['Clinical decision support at the point of care','Automated documentation and record summaries','Analytics and research across patient data']},
 {name:'Legal & Compliance',kind:'court',lat:30,lon:-22,ph:1,line:'[PLACEHOLDER]',uses:['[PLACEHOLDER]']},
 {name:'Education',kind:'school',lat:-8,lon:118,line:'Lesson planning, assessment and personalized learning.',uses:['Lesson planning and content creation','Assessment design and marking support','Personalized learning paths for each student']},
 {name:'Creative & Media',kind:'studio',lat:-6,lon:28,ph:1,line:'[PLACEHOLDER]',uses:['[PLACEHOLDER]']},
 {name:'Hospitality & Tourism',kind:'hotel',lat:-28,lon:52,line:'Guest service, trip planning and personalization.',uses:['Customer service and guest messaging','Trip planning and personalized recommendations','Operations planning across properties']},
 {name:'Manufacturing & Supply Chain',kind:'factory',lat:52,lon:8,line:'Predictive maintenance, inspection and forecasting.',uses:['Predictive maintenance on production equipment','Quality inspection with computer vision','Demand forecasting and supply-chain automation']},
 {name:'Construction & Real Estate',kind:'crane',lat:14,lon:138,ph:1,line:'[PLACEHOLDER]',uses:['[PLACEHOLDER]']},
 {name:'Government & Public Sector',kind:'gov',lat:-42,lon:96,ph:1,line:'[PLACEHOLDER]',uses:['[PLACEHOLDER]']}
];
