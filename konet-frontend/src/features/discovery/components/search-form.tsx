import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { University } from "@/types/domain";

type Props = { universities: University[]; defaultQuery?: string; defaultCampus?: string; variant?: "hero" | "compact" };
export function SearchForm({ universities, defaultQuery = "", defaultCampus = "", variant = "compact" }: Props) {
  const campusOptions = [{ value: "", label: "All campuses" }, ...universities.map(item => ({ value: item.id, label: item.shortName }))];
  if (variant === "hero") return <form className="hero-search" action="/discover">
    <div className="search-input"><Icon name="search" size={21} /><label className="sr-only" htmlFor="hero-query">What do you need help with?</label><input id="hero-query" name="q" defaultValue={defaultQuery} placeholder="What do you need help with?" /></div>
    <div className="search-bottom"><Select className="min-w-48 flex-1" label="University" name="campus" defaultValue={defaultCampus} options={campusOptions} /><Button type="submit">Find your person <Icon name="arrow" size={18} /></Button></div>
  </form>;
  return <form className="results-search !flex-wrap !gap-3" action="/discover">
    <Icon name="search" />
    <label className="sr-only" htmlFor="compact-query">What do you need help with?</label>
    <input id="compact-query" name="q" defaultValue={defaultQuery} placeholder="What do you need help with?" className="!min-w-40 !flex-1" />
    <Select className="min-w-44 flex-1 sm:max-w-56" label="University" name="campus" defaultValue={defaultCampus} options={campusOptions} />
    <Button type="submit">Find talent <Icon name="arrow" size={18} /></Button>
  </form>;
}
