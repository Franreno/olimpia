"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 25;

/**
 * Client-side search + pagination for an in-memory list.
 *
 * Pass `searchFields` to extract the strings each item should be matched
 * against; omit it for pagination-only behaviour. Changing the query resets
 * to page 1, and the returned `page` is always clamped to the valid range.
 */
export function useTableData<T>({
  data,
  pageSize = DEFAULT_PAGE_SIZE,
  searchFields,
}: {
  data: T[];
  pageSize?: number;
  searchFields?: (item: T) => Array<string | null | undefined>;
}) {
  const [query, setQueryState] = useState("");
  const [page, setPage] = useState(1);

  const q = query.trim().toLowerCase();
  const filtered =
    q && searchFields
      ? data.filter((item) =>
          searchFields(item).some((field) =>
            (field ?? "").toLowerCase().includes(q)
          )
        )
      : data;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function setQuery(value: string) {
    setQueryState(value);
    setPage(1);
  }

  return {
    query,
    setQuery,
    page: safePage,
    setPage,
    pageItems,
    pageCount,
    pageSize,
    total: filtered.length,
  };
}

/** Search input matching the inventory list styling. */
export function TableSearch({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative max-w-xs", className)}>
      <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        className="pl-8"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Page tokens with ellipsis: 1 … 4 5 6 … 20 */
function pageTokens(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const tokens: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) tokens.push("…");
  for (let i = start; i <= end; i++) tokens.push(i);
  if (end < pageCount - 1) tokens.push("…");
  tokens.push(pageCount);
  return tokens;
}

export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  itemLabel = "itens",
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> de {total} {itemLabel}
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeftIcon />
          </Button>

          {pageTokens(page, pageCount).map((t, i) =>
            t === "…" ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1.5 text-sm text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={t}
                variant={t === page ? "outline" : "ghost"}
                size="icon-sm"
                onClick={() => onPageChange(t)}
                aria-current={t === page ? "page" : undefined}
                className={cn(t === page && "pointer-events-none font-semibold")}
              >
                {t}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
