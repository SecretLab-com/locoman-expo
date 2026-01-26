import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  className?: string;
}

export function Breadcrumb({ items, showHome = true, homeHref = "/", className = "" }: BreadcrumbProps) {
  const allItems: BreadcrumbItem[] = showHome 
    ? [{ label: "Home", href: homeHref }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-sm text-muted-foreground ${className}`}>
      <ol className="flex items-center gap-1 flex-wrap">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHome = index === 0 && showHome;

          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
              )}
              {isLast ? (
                <span className="font-medium text-foreground truncate max-w-[200px]" title={item.label}>
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href}>
                  <span className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                    {isHome && <Home className="h-3.5 w-3.5" />}
                    {!isHome && <span className="truncate max-w-[150px]" title={item.label}>{item.label}</span>}
                  </span>
                </Link>
              ) : (
                <span className="truncate max-w-[150px]" title={item.label}>
                  {isHome && <Home className="h-3.5 w-3.5" />}
                  {!isHome && item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
