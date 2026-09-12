import React,{useEffect,useMemo} from 'react';
export function CameraView(props){useEffect(()=>props.onCameraReady?.(),[]);return <div style={{height:250,background:'#174e36',color:'white',display:'grid',placeItems:'center'}}><button onClick={()=>props.onBarcodeScanned?.({data:'123'})}>Simulate barcode (preview only)</button><button onClick={()=>props.onBarcodeScanned?.({data:"missing"})}>Simulate missing barcode (preview only)</button></div>;}
export function useCameraPermissions(){return [{granted:true},async()=>({granted:true})];}
const db={};
export function useSQLiteContext(){return db;}
export async function getNetworkStateAsync(){return {isConnected:true,isInternetReachable:true};}
export class File extends Blob{constructor(uri){super(['preview'],{type:uri.includes('m4a')?'audio/mp4':'image/jpeg'});this.uri=uri;this.name=uri.split('/').pop();this.exists=true;}delete(){this.exists=false;}}
export function randomUUID(){return crypto.randomUUID();}
const scenario=()=>new URLSearchParams(window.location.search).get('scenario');
export const RecordingPresets={HIGH_QUALITY:{}};
export const AudioModule={async requestRecordingPermissionsAsync(){if(scenario()==='voice-cancel-start')await new Promise(r=>setTimeout(r,1500));return {granted:scenario()!=='voice-denied'};}};
export async function setAudioModeAsync(){}
export function useAudioRecorder(){return useMemo(()=>({isRecording:false,uri:'file:///preview.m4a',async prepareToRecordAsync(){},record(){this.isRecording=true;window.qaRecording=true;},async stop(){this.isRecording=false;window.qaRecording=false;}}),[]);}
export async function requestCameraPermissionsAsync(){return {granted:scenario()!=='camera-denied'};}
const samplePhoto='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#d9e8de"/><text x="15" y="65" font-size="14">Sample photo</text></svg>');
const pickedPhoto=()=>({canceled:scenario()==='photo-cancel',assets:[{uri:samplePhoto}]});
export async function launchCameraAsync(){window.qaPhotoSource='camera';return pickedPhoto();}
export async function launchImageLibraryAsync(){window.qaPhotoSource='library';return pickedPhoto();}
export const SaveFormat={JPEG:'jpeg'};
export const ImageManipulator={manipulate(){return {resize(){},async renderAsync(){return {async saveAsync(){return {uri:'file:///prepared-preview.jpg'};},release(){}};},release(){}};}};
