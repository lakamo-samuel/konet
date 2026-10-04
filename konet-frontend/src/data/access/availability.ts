import { DataError } from "./errors";

// Optional public-page content can be unavailable without taking down the page.
// Authentication failures and unexpected programming errors still propagate.
export async function optionalPublicData<T>(load: () => Promise<T>, fallback: T) {
  try {
    return { data: await load(), unavailable: false };
  } catch (error) {
    if (!(error instanceof DataError) || error.status < 500) throw error;
    return { data: fallback, unavailable: true };
  }
}
