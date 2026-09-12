import fs from 'node:fs';
import {createRequire} from 'node:module';import path from 'node:path';
const require=createRequire(import.meta.url);const esbuild=require('../../node_modules/esbuild');const base=process.cwd();const out=path.join(base,'outputs/flow-preview');
await esbuild.build({entryPoints:[path.join(out,'app.jsx')],outfile:path.join(out,'bundle.js'),bundle:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"development"',__DEV__:'true'},loader:{'.png':'dataurl'},plugins:[{name:'preview',setup(build){
 build.onResolve({filter:/^(react|react-dom)(\/.*)?$/},a=>({path:require.resolve(a.path,{paths:[path.join(base,'mobile') ]})}));
 build.onResolve({filter:/^react-native$/},()=>({path:require.resolve('react-native-web',{paths:[path.join(base,'mobile')]})}));
 build.onResolve({filter:/^expo-router$/},()=>({path:path.join(out,'router.jsx')}));
 build.onResolve({filter:/^(expo-camera|expo-file-system|expo-sqlite|expo-network|expo-crypto)$/},()=>({path:path.join(out,'native.jsx')}));
 build.onResolve({filter:/^@\/(services\/(api|recipes|shopping-cache)|providers\/auth-provider)$/},()=>({path:path.join(out,'services.js')}));
 build.onResolve({filter:/^@\//},a=>({path:['','.tsx','.ts','.jsx','.js'].map(ext=>path.join(base,a.path.startsWith('@/assets/')?'mobile':'mobile/src',a.path.slice(2))+ext).find(p=>fs.existsSync(p) && fs.statSync(p).isFile())}));
}}],resolveExtensions:['.tsx','.ts','.jsx','.js','.json']});
