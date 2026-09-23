import Image from "next/image";
export function Avatar({src,name,size=44}:{src:string;name:string;size?:number}){return <Image unoptimized className="avatar" src={src} alt={name} width={size} height={size} style={{width:size,height:size}}/>}
