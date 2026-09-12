import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Navigation} from './router';
import Plans from '../../mobile/src/app/meal-plans/index';
import Plan from '../../mobile/src/app/meal-plans/[id]';
import Home from '../../mobile/src/app/(tabs)/index';
import Generate from '../../mobile/src/app/generate';
import Scan from '../../mobile/src/app/(tabs)/scan';
import Recipes from '../../mobile/src/app/recipes/index';
import Recipe from '../../mobile/src/app/recipes/[id]';
import Shopping from '../../mobile/src/app/(tabs)/shopping';
function Preview(){
 const [history,setHistory]=useState([{path:'/',params:{}}]);const current=history[history.length-1];
 const router=useMemo(()=>({push(to){setHistory(h=>[...h,typeof to==='string'?{path:to,params:{}}:{path:to.pathname,params:to.params||{}}]);},replace(to){setHistory(h=>[...h.slice(0,-1),typeof to==='string'?{path:to,params:{}}:{path:to.pathname,params:to.params||{}}]);},back(){setHistory(h=>h.length>1?h.slice(0,-1):h);}}),[]);
 const routes={'/meal-plans':Plans,'/meal-plans/[id]':Plan,'/':Home,'/(tabs)':Home,'/generate':Generate,'/(tabs)/scan':Scan,'/recipes':Recipes,'/(tabs)/recipes':Recipes,'/recipes/[id]':Recipe,'/(tabs)/shopping':Shopping};const Page=routes[current.path];
 return <Navigation.Provider value={{router,params:current.params}}><header><button onClick={()=>router.back()} aria-label="Back">‹</button><strong>Recipe Reborn</strong></header><main><div className="screen" key={current.path+'-'+history.length}>{Page?<Page/>:<p>Outside this preview</p>}</div></main><nav>{[['Home','/'],['Recipes','/(tabs)/recipes'],['Shopping','/(tabs)/shopping']].map(([name,path])=><button key={name} onClick={()=>router.push(path)}>{name}</button>)}</nav><footer>Layout preview · sample data · camera and services simulated</footer></Navigation.Provider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
