import type {ReactNode} from "react";
export function PageHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:ReactNode}){return <header className="page-heading row-heading"><div>{eyebrow&&<span className="eyebrow muted">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>}
