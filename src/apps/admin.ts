import { system } from "../system";

export interface AdminAppOpts {
  name?: string;
  displayName?: string;
  links?: string[];
}

export function addAdminApp(opts: AdminAppOpts) {
  const app = system.addApp(
    opts.name ?? "admin",
    opts.displayName ?? system.name + " Admin",
  );
  app.executionConfig = { canDownload: true };
  app.useNavbarShell({
    color: "primary",
    variant: "solid",
    links: opts.links ?? [],
  });
  app.addDbManagementPage({ path: "/" });
  return app;
}
