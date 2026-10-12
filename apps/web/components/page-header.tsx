import { AutoBreadcrumbs, Breadcrumbs, type Crumb } from "./breadcrumbs";

/**
 * Shared page header. Deep pages get breadcrumbs automatically from the URL; pass `breadcrumbs`
 * to override them (or `[]` to hide them).
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="mb-8">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : <AutoBreadcrumbs title={title} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-balance">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div data-page-actions>{actions}</div>}
      </div>
    </div>
  );
}
