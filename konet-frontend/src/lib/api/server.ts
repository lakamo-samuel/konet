const apiBase=process.env.KONET_API_URL?.replace(/\/$/,"");
export function hasApi(){return Boolean(apiBase)}
export async function apiGet<T>(path:string):Promise<T>{if(!apiBase)throw new Error("KONET_API_URL is not configured");const response=await fetch(`${apiBase}${path}`,{next:{revalidate:60}});if(!response.ok)throw new Error(`Konet API ${path} returned ${response.status}`);return response.json() as Promise<T>}
