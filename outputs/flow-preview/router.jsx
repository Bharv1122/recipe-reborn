import React, {createContext,useContext,useEffect,useMemo,useState} from 'react';
export const Navigation = createContext(null);
export function useRouter(){ return useContext(Navigation).router; }
export function useLocalSearchParams(){ return useContext(Navigation).params; }
export function useFocusEffect(fn){ useEffect(fn,[fn]); }
export const Stack={Screen:()=>null};
