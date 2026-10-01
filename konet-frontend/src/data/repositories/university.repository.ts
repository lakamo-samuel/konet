import { serverQuery } from "@/data/access/server";
export const getUniversities = () => serverQuery("universities", {});
export const getUniversityById = (id: string) => serverQuery("university", { id });
