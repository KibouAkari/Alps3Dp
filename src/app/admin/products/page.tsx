import Link from "next/link";

import { AdminGuard } from "@/components/admin-guard";
import { AdminProductsManager } from "@/components/admin-products-manager";
import { ArrowLeftIcon } from "@/components/icons";

export default function AdminProductsPage() {
  return (
    <AdminGuard>
      <div className="space-y-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Zurück zum Dashboard
        </Link>
        <AdminProductsManager />
      </div>
    </AdminGuard>
  );
}
