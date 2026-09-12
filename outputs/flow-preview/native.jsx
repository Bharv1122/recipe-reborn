import React,{useEffect} from 'react';
export function CameraView(props){useEffect(()=>props.onCameraReady?.(),[]);return <div style={{height:250,background:'#174e36',color:'white',display:'grid',placeItems:'center'}}><button onClick={()=>props.onBarcodeScanned?.({data:'123'})}>Simulate barcode (preview only)</button><button onClick={()=>props.onBarcodeScanned?.({data:"missing"})}>Simulate missing barcode (preview only)</button></div>;}
export function useCameraPermissions(){return [{granted:true},async()=>({granted:true})];}
export function useSQLiteContext(){return {};}
export async function getNetworkStateAsync(){return {isConnected:true,isInternetReachable:true};}
export class File{constructor(uri){this.uri=uri;}}
export function randomUUID(){return crypto.randomUUID();}
