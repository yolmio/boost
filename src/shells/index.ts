import { Node } from "../nodeTypes";
import { App } from "../system";
import { NavbarProps, navbar } from "./navbar";

export class Shells {
  #shell?: (pages: Node) => Node;

  constructor(private app: App) {}

  /**
   * Sets the shell of the application to a navbar.
   *
   * This navbar has links, an optional search dialog for a single table or multiple tables, a color, variant
   * and a settings drawer to logout, download the database, and set color mode.
   */
  navbar(opts: NavbarProps) {
    this.set(navbar(opts));
  }

  /**
   * Sets the shell to the function provided
   */
  set(shell: (pages: Node) => Node) {
    this.#shell = shell;
  }

  /**
   * Gets the shell that was set.
   */
  get shell() {
    return this.#shell;
  }
}
