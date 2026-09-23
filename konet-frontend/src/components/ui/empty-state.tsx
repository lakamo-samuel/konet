import type {ReactNode} from "react";import Icon from "./icon";
export function EmptyState({icon="search",title,description,action}:{icon?:string;title:string;description:string;action?:ReactNode}){return <section className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h2>{title}</h2><p>{description}</p>{action}</section>}
