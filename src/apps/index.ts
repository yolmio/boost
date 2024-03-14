import { App, System } from "../system";

export interface AdminAppOpts {
  name?: string;
  displayName?: string;
  links?: string[];
}

export class Apps {
  #apps: Record<string, App> = {};
  #currentAppName: string = "";

  constructor(private system: System) {}

  add(name: string, displayName: string): App {
    this.apps[name] = new App(name, displayName);
    this.#currentAppName = name;
    return this.apps[name];
  }

  admin(opts: AdminAppOpts = {}) {
    const app = this.add(
      opts.name ?? "admin",
      opts.displayName ?? this.system.name + " Admin",
    );
    app.executionConfig = { canDownload: true };
    app.shells.navbar({
      color: "primary",
      variant: "solid",
      links: opts.links ?? [],
    });
    app.pages.dbManagement({ path: "/" });
    return app;
  }

  get apps() {
    return this.#apps;
  }

  get currentAppName() {
    return this.#currentAppName;
  }

  get currentApp() {
    return this.apps[this.currentAppName];
  }
}
