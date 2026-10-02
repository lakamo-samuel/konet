import { sql, type SQLWrapper } from "drizzle-orm";
/** A category is public only when it and all its ancestors are active. */
export const visibleCategory = (column: SQLWrapper) => sql`${column} IN (
 WITH RECURSIVE live_categories AS (
 SELECT id FROM service_categories WHERE is_active = true AND parent_id IS NULL
 UNION ALL SELECT c.id FROM service_categories c JOIN live_categories p ON c.parent_id = p.id WHERE c.is_active = true
 ) SELECT id FROM live_categories
)`;
export const literalSearch = (value: string) =>
  `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
