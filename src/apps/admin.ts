import { createDbManagementPage } from "../pages/dbManagement";
import { system } from "../system";

export interface AdminAppOpts {
  name?: string;
  displayName?: string;
}

export function addAdminApp(opts: AdminAppOpts) {
  const app = system.addApp(
    opts.name ?? "admin",
    opts.displayName ?? system.name + " Admin",
  );
  app.pages.push({
    content: createDbManagementPage({}),
    path: "/",
  });
}
