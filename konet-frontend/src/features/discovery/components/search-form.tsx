import Icon from "@/components/ui/icon";
import {Button} from "@/components/ui/button";
import type {University} from "@/types/domain";

type Props={universities:University[];defaultQuery?:string;defaultCampus?:string;variant?:"hero"|"compact"};
export function SearchForm({universities,defaultQuery="",defaultCampus="",variant="compact"}:Props){
  const fields=<><label className="sr-only" htmlFor={`${variant}-query`}>What do you need help with?</label><input id={`${variant}-query`} name="q" defaultValue={defaultQuery} placeholder="What do you need help with?"/><label className="sr-only" htmlFor={`${variant}-campus`}>University</label></>;
  if(variant==="hero")return <form className="hero-search" action="/search"><div className="search-input"><Icon name="search" size={21}/>{fields}</div><div className="search-bottom"><label className="campus-select"><Icon name="pin" size={16}/><select id="hero-campus" name="campus" defaultValue={defaultCampus}><option value="">All campuses</option>{universities.map(item=><option value={item.id} key={item.id}>{item.shortName}</option>)}</select><Icon name="chevron" size={14}/></label><Button type="submit">Find your person <Icon name="arrow" size={18}/></Button></div></form>;
  return <form className="results-search" action="/search"><Icon name="search"/>{fields}<select id="compact-campus" name="campus" defaultValue={defaultCampus}><option value="">All campuses</option>{universities.map(item=><option value={item.id} key={item.id}>{item.shortName}</option>)}</select><Button type="submit">Find talent <Icon name="arrow" size={18}/></Button></form>
}
