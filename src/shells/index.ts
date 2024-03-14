import { App } from "../system";
import { NavbarProps, navbar } from "./navbar";

export class Shells {
  constructor(private app: App) {}

  navbar(opts: NavbarProps) {
    this.app.shell = navbar(opts);
  }
}
