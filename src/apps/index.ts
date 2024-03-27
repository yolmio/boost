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

  /**
   * Add a new app to the system.
   *
   * @param name Name of the app (must be unique within the system)
   * @param displayName Display name of the app. Shown at yolm.app when listing apps and title defaults to this
   */
  add(name: string, displayName: string): App {
    this.apps[name] = new App(name, displayName);
    this.#currentAppName = name;
    return this.apps[name];
  }

  /**
   * Defines an admin app for the system. This app will have a navbar and
   * a page for managing the database as the home page.
   *
   * You can add any additional pages as it is just a regular app.
   */
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

  /**
   * The current app, when you call `apps.add()` it sets the current app to the app you just added.
   */
  get apps() {
    return this.#apps;
  }

  /**
   * The current app name, when you call `apps.add()` it sets the current app to the app you just added.
   */
  get currentAppName() {
    return this.#currentAppName;
  }

  get currentApp() {
    return this.apps[this.currentAppName];
  }
}
