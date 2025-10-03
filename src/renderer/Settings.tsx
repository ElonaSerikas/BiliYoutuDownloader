import { useEffect, useState } from 'react';

declare global { interface Window { api:any } }

export function useSettings(){
  const [settings, setSettings] = useState<any>(null);
  useEffect(()=>{ window.api.invoke('settings:get').then(setSettings); }, []);
  const save = async (patch:any)=>{
    const s = await window.api.invoke('settings:set', patch);
    setSettings(s);
    return s;
  };
  return { settings, save };
}
