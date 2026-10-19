"use client";

import { Button } from "@/components/ui/button";

export function CollectionPagination({
  offset,
  count,
  isFetching,
  onOffsetChange,
  pageSize = 20,
  itemName = "items",
}: {
  offset: number;
  count: number;
  isFetching: boolean;
  onOffsetChange: (offset: number) => void;
  pageSize?: number;
  itemName?: string;
}) {
  const first = count ? offset + 1 : 0;
  const last = offset + count;

  return (
    <nav className="collection-pagination" aria-label={`${itemName} pages`}>
      <p aria-live="polite">
        {count
          ? `Showing ${first}–${last} ${itemName}`
          : offset
            ? `No ${itemName} on this page`
            : `No ${itemName} to show`}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={offset === 0 || isFetching}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={count < pageSize || isFetching}
          onClick={() => onOffsetChange(offset + pageSize)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
