import { useState, useMemo } from "react";
import { usePermisos } from "@/hooks/usePermisos";
import { useNavigate } from "react-router-dom";
import { Plus, Trash } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusChip } from "@/components/StatusChip";
import { OdooFilterBar } from "@/components/OdooFilterBar";
import { TablePagination } from "@/components/TablePagination";
import { TableSkeleton } from "@/components/TableSkeleton";
import { MobileListCard } from "@/components/MobileListCard";
import { GroupedTableWrapper } from "@/components/GroupedTableWrapper";
import {
  exportToExcel,
  exportToPDF,
  type ExportColumn,
} from "@/lib/exportUtils";
import { useCotizacionesPaginated, useDeleteCotizacion } from "@/hooks/useCotizaciones";
import { useIsMobile } from "@/hooks/use-mobile";
import { useListPreferences, groupData, dateGroupLabel } from "@/hooks/useListPreferences";
import { cn } from "@/lib/utils";
import HelpButton from "@/components/HelpButton";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";
import {
  readStoredPageSize,
  type PageSizeOption,
} from "@/hooks/useTablePagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExportButton } from "@/components/ExportButton";

const COTIZACIONES_COLUMNS: ExportColumn[] = [
  { key: "folio", header: "Folio", width: 15 },
  { key: "cliente_nombre", header: "Cliente", width: 30 },
  { key: "vendedor_nombre", header: "Vendedor", width: 25 },
  { key: "fecha", header: "Fecha", width: 15 },
  { key: "status", header: "Status", width: 15 },
  { key: "total", header: "Total", format: "currency", width: 15 },
];

const STATIC_FILTER_OPTIONS = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "borrador", label: "Borrador" },
      { value: "enviada", label: "Enviada" },
      { value: "aceptada", label: "Aceptada" },
      { value: "rechazada", label: "Rechazada" },
      { value: "vencida", label: "Vencida" },
    ],
  },
];

const GROUP_BY_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "vendedor", label: "Vendedor" },
  { value: "fecha", label: "Fecha" },
];

function getNumericPageSize(ps: PageSizeOption): number {
  return ps === "all" ? 10000 : ps;
}

function useVendedoresForFilter() {
  const { empresa } = useAuth();
  return useQuery({
    queryKey: ["vendedores-filter", empresa?.id],
    enabled: !!empresa?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre")
        .eq("empresa_id", empresa!.id)
        .eq("estado", "activo")
        .order("nombre");
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });
}

export default function CotizacionesListPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { fmt: fmtCurrency } = useCurrency();
  const { hasPermiso } = usePermisos();
  const canCreate = hasPermiso("ventas", "crear"); // using same perms as ventas
  const canDelete = hasPermiso("ventas", "eliminar");
  const deleteCoti = useDeleteCotizacion();
  
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSizeOption>(readStoredPageSize);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const {
    filters,
    groupBy,
    groupByLevels,
    setFilter,
    toggleFilterValue,
    setGroupBy,
    setGroupByLevel,
    clearFilters,
  } = useListPreferences("cotizaciones");

  const { data: vendedoresList } = useVendedoresForFilter();

  const FILTER_OPTIONS = useMemo(
    () => [
      ...STATIC_FILTER_OPTIONS,
      {
        key: "vendedor",
        label: "Vendedor",
        options: (vendedoresList ?? []).map((v) => ({
          value: v.id,
          label: v.nombre,
        })),
      },
    ],
    [vendedoresList]
  );

  const numericPageSize = getNumericPageSize(pageSize);
  const statusFilter = filters.status?.length ? filters.status.join(",") : "todos";
  const vendedorFilter = filters.vendedor?.length ? filters.vendedor.join(",") : "todos";

  const { data: cotizacionesData, isLoading } = useCotizacionesPaginated(
    search,
    statusFilter,
    page,
    numericPageSize,
    vendedorFilter,
    dateFrom || undefined,
    dateTo || undefined
  );

  const cotizaciones = cotizacionesData?.rows ?? [];
  const total = cotizacionesData?.total ?? 0;
  const from = total === 0 ? 0 : Math.min((page - 1) * numericPageSize + 1, total);
  const to = Math.min(page * numericPageSize, total);
  const totalPages = numericPageSize > 0 ? Math.max(1, Math.ceil(total / numericPageSize)) : 1;

  const allSelected = cotizaciones.length > 0 && cotizaciones.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(cotizaciones.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handlePageSizeChange = (size: PageSizeOption) => {
    setPageSizeState(size);
    setPage(1);
    try {
      localStorage.setItem("table-page-size", String(size));
    } catch {}
  };

  const groupLabelFn = (item: any, key: string) => {
    if (key === "status") return item.status;
    if (key === "vendedor") return item.vendedores?.nombre ?? "Sin vendedor";
    if (key === "fecha") return dateGroupLabel(item.fecha, key as any);
    return "";
  };

  const groups = useMemo(
    () => groupData(cotizaciones, groupBy, groupLabelFn, groupByLevels),
    [cotizaciones, groupBy, groupByLevels]
  );

  const totalMonto = cotizaciones.reduce((s, c) => s + (c.total ?? 0), 0);

  const renderTable = (items: any[]) => (
    <div className={cn(!groupBy && "bg-card border border-border rounded overflow-x-auto")}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-table-border">
            <th className="th-odoo w-10 text-center">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-input" />
            </th>
            <th className="th-odoo text-left">Folio</th>
            <th className="th-odoo text-left">Cliente</th>
            <th className="th-odoo text-left hidden lg:table-cell">Vendedor</th>
            <th className="th-odoo text-left">Fecha</th>
            <th className="th-odoo text-right">Total</th>
            <th className="th-odoo text-center">Status</th>
            {canDelete && <th className="th-odoo w-10 text-center"></th>}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                No hay cotizaciones.
              </td>
            </tr>
          )}
          {items.map((c: any) => (
            <tr
              key={c.id}
              className={cn(
                "border-b border-table-border cursor-pointer transition-colors",
                selected.has(c.id) ? "bg-primary/5" : "hover:bg-table-hover"
              )}
              onClick={() => navigate(`/ventas/cotizaciones/${c.id}`)}
            >
              <td className="py-1.5 px-3 text-center" onClick={(e) => { e.stopPropagation(); toggleOne(c.id); }}>
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="rounded border-input" />
              </td>
              <td className="py-1.5 px-3 font-mono font-medium">{c.folio}</td>
              <td className="py-1.5 px-3 font-medium">{c.clientes?.nombre ?? "—"}</td>
              <td className="py-1.5 px-3 hidden lg:table-cell text-muted-foreground">{c.vendedores?.nombre ?? "—"}</td>
              <td className="py-1.5 px-3 text-muted-foreground">{c.fecha}</td>
              <td className="py-1.5 px-3 text-right font-medium">{fmtCurrency(c.total)}</td>
              <td className="py-1.5 px-3 text-center">
                <StatusChip status={c.status} />
              </td>
              {canDelete && (
                <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setDeleteTarget(c.id)}
                    className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 space-y-3 min-h-full">
      <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
        Cotizaciones
      </h1>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <OdooFilterBar
          search={search}
          onSearchChange={(val) => { setSearch(val); setPage(1); }}
          placeholder="Buscar folio o cliente..."
          filterOptions={FILTER_OPTIONS}
          activeFilters={filters}
          onToggleFilter={(key, val) => { toggleFilterValue(key, val); setPage(1); }}
          onSetFilter={(key, vals) => { setFilter(key, vals); setPage(1); }}
          onClearFilters={() => { clearFilters(); setDateFrom(""); setDateTo(""); setPage(1); }}
          groupByOptions={GROUP_BY_OPTIONS}
          activeGroupBy={groupBy}
          onGroupByChange={setGroupBy}
          activeGroupByLevels={groupByLevels}
          onGroupByLevelChange={setGroupByLevel}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
          onDateToChange={(v) => { setDateTo(v); setPage(1); }}
        />
        <div className="flex items-center gap-2 shrink-0">
          {!isMobile && (
            <ExportButton
              onExcel={async () => {
                await exportToExcel({
                  fileName: "Cotizaciones",
                  title: "Reporte de Cotizaciones",
                  columns: COTIZACIONES_COLUMNS,
                  data: cotizaciones.map((c) => ({
                    ...c,
                    cliente_nombre: (c.clientes as any)?.nombre || "",
                    vendedor_nombre: (c.vendedores as any)?.nombre || "",
                  })),
                  totals: { total: totalMonto },
                });
              }}
              onPDF={async () => {
                await exportToPDF({
                  fileName: "Cotizaciones",
                  title: "Reporte de Cotizaciones",
                  columns: COTIZACIONES_COLUMNS,
                  data: cotizaciones.map((c) => ({
                    ...c,
                    cliente_nombre: (c.clientes as any)?.nombre || "",
                    vendedor_nombre: (c.vendedores as any)?.nombre || "",
                  })),
                  totals: { total: totalMonto },
                });
              }}
            />
          )}
          {canCreate && (
            <button
              onClick={() => navigate("/ventas/cotizaciones/nuevo")}
              className="btn-odoo-primary shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Nueva cotización
            </button>
          )}
        </div>
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-muted-foreground bg-card rounded px-3 py-2">
          <span><strong className="text-foreground">{total}</strong> cotizaciones</span>
          <span>Total: <strong className="text-foreground">{fmtCurrency(totalMonto)}</strong></span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-card border border-border rounded p-4">
          <TableSkeleton rows={8} cols={isMobile ? 3 : 7} />
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {cotizaciones.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No hay cotizaciones.
            </div>
          )}
          {cotizaciones.map((c: any) => (
            <MobileListCard
              key={c.id}
              title={c.clientes?.nombre ?? "Sin cliente"}
              subtitle={c.folio}
              badge={<StatusChip status={c.status} />}
              onClick={() => navigate(`/ventas/cotizaciones/${c.id}`)}
              fields={[
                { label: "Fecha", value: c.fecha },
                { label: "Total", value: fmtCurrency(c.total) },
              ]}
            />
          ))}
          {total > 0 && (
            <TablePagination
              from={from}
              to={to}
              total={total}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              onFirst={() => setPage(1)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onLast={() => setPage(totalPages)}
            />
          )}
        </div>
      ) : (
        <>
          <GroupedTableWrapper
            groupBy={groupBy}
            groups={groups}
            renderTable={renderTable}
            renderSummary={(items) => (
              <span className="text-[11px] text-muted-foreground font-medium">
                {fmtCurrency(items.reduce((s: number, v: any) => s + (v.total ?? 0), 0))}
              </span>
            )}
          />
          {!groupBy && total > 0 && (
            <TablePagination
              from={from}
              to={to}
              total={total}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              onFirst={() => setPage(1)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onLast={() => setPage(totalPages)}
            />
          )}
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todas las líneas de la cotización.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                deleteCoti.mutateAsync(deleteTarget)
                  .then(() => toast.success("Cotización eliminada"))
                  .catch((err: any) => toast.error(err.message));
                setDeleteTarget(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
