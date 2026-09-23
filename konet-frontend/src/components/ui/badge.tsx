import type {ReactNode} from "react";import Icon from "./icon";
export function Badge({children,tone="green",icon="verified"}:{children:ReactNode;tone?:"green"|"neutral"|"amber"|"red";icon?:string}){return <span className={`badge ${tone}`}><Icon name={icon} size={14}/>{children}</span>}
