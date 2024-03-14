import * as insertFormShared from "../../components/internal/insertFormShared";
import * as updateFormShared from "../../components/internal/updateFormShared";
import { FormStateProcedureExtensions } from "../../formState";
import {
  ExternalInsertOpts,
  ExternalUpdateOpts,
  createInsertFormNode,
  createUpdateFormNode,
} from "./shared";
import { App } from "../../system";
import { getTableBaseUrl } from "../../utils/url";
import { Node } from "../../nodeTypes";
import {
  createMultiCardInsertPageNode,
  MultiCardInsertPageOpts,
} from "./multiCardInsert";

export interface InsertAutoSingleColumnOpts
  extends insertFormShared.AutoSingleColumnOpts,
    ExternalInsertOpts {}
export interface InsertSingleColumnOpts
  extends FormStateProcedureExtensions,
    insertFormShared.SingleColumnOpts,
    ExternalInsertOpts {}
export interface InsertTwoColumnSectionedOpts
  extends FormStateProcedureExtensions,
    insertFormShared.TwoColumnSectionedOpts,
    ExternalInsertOpts {}

export interface UpdateAutoSingleColumnOpts
  extends updateFormShared.AutoSingleColumnOpts,
    ExternalUpdateOpts {}
export interface UpdateSingleColumnOpts
  extends updateFormShared.SingleColumnOpts,
    ExternalUpdateOpts {}
export interface UpdateTwoColumnSectionedOpts
  extends updateFormShared.TwoColumnSectionedOpts,
    ExternalUpdateOpts {}

export class FormPages {
  constructor(private app: App) {}

  private addPage(opts: { path?: string; table: string }, content: Node) {
    const pathBase = getTableBaseUrl(opts.table);
    const path = opts.path ?? pathBase + `/add`;
    this.app.pages.push({
      path,
      content,
    });
  }

  private updatePage(opts: { path?: string; table: string }, content: Node) {
    const pathBase = getTableBaseUrl(opts.table);
    const path = opts.path ?? pathBase + `/{record_id:id}/edit`;
    this.app.pages.push({
      path,
      content,
    });
  }

  createInsertAutoSingleColumnNode(opts: InsertAutoSingleColumnOpts) {
    return createInsertFormNode(opts, {
      sourceName: "pages.forms.insertAutoSingleColumn",
      createInsertFormStateOpts: (table) => ({
        fields: insertFormShared.getFieldsFromAutoSingleColumn(opts, table),
      }),
      content: (table, formState, cancelHref) =>
        insertFormShared.autoSingleColumnContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  insertAutoSingleColumn(opts: InsertAutoSingleColumnOpts) {
    this.addPage(opts, this.createInsertAutoSingleColumnNode(opts));
  }

  createInsertSingleColumnNode(opts: InsertSingleColumnOpts) {
    return createInsertFormNode(opts, {
      sourceName: "pages.forms.insertSingleColumn",
      createInsertFormStateOpts: (table) => ({
        fields: insertFormShared.getFieldsFromAutoSingleColumn(opts, table),
      }),
      content: (table, formState, cancelHref) =>
        insertFormShared.autoSingleColumnContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  insertSingleColumn(opts: InsertSingleColumnOpts) {
    this.addPage(opts, this.createInsertSingleColumnNode(opts));
  }

  createInsertTwoColumnSectionedNode(opts: InsertTwoColumnSectionedOpts) {
    return createInsertFormNode(opts, {
      sourceName: "pages.forms.insertTwoColumnSectioned",
      createInsertFormStateOpts: () => {
        const { fields, relations } =
          insertFormShared.getFieldsAndRelationsFromTwoColumnSectioned(opts);
        return {
          fields,
          relations,
        };
      },
      content: (table, formState, cancelHref) =>
        insertFormShared.twoColumnSectionedContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  insertTwoColumnSectioned(opts: InsertTwoColumnSectionedOpts) {
    this.addPage(opts, this.createInsertTwoColumnSectionedNode(opts));
  }

  createUpdateAutoSingleColumnNode(opts: UpdateAutoSingleColumnOpts) {
    return createUpdateFormNode(opts, {
      sourceName: "pages.forms.updateAutoSingleColumn",
      createUpdateFormStateOpts: (table) => ({
        fields: updateFormShared.getFieldsFromAutoSingleColumn(opts, table),
      }),
      content: (table, formState, cancelHref) =>
        updateFormShared.autoSingleColumnContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  updateAutoSingleColumn(opts: UpdateAutoSingleColumnOpts) {
    this.updatePage(opts, this.createUpdateAutoSingleColumnNode(opts));
  }

  createUpdateSingleColumnNode(opts: UpdateSingleColumnOpts) {
    return createUpdateFormNode(opts, {
      sourceName: "pages.forms.updateSingleColumn",
      createUpdateFormStateOpts: (table) => ({
        fields: updateFormShared.getFieldsFromAutoSingleColumn(opts, table),
      }),
      content: (table, formState, cancelHref) =>
        updateFormShared.autoSingleColumnContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  updateSingleColumn(opts: UpdateSingleColumnOpts) {
    this.updatePage(opts, this.createUpdateSingleColumnNode(opts));
  }

  createUpdateTwoColumnSectionedNode(opts: UpdateTwoColumnSectionedOpts) {
    return createUpdateFormNode(opts, {
      sourceName: "pages.forms.updateTwoColumnSectioned",
      createUpdateFormStateOpts: () => {
        const fields = updateFormShared.getFieldsFromTwoColumnSectioned(opts);
        return { fields };
      },
      content: (table, formState, cancelHref) =>
        updateFormShared.twoColumnSectionedContent(opts, {
          formState,
          table,
          cancel: { type: "Href", href: cancelHref },
        }),
    });
  }

  updateTwoColumnSectioned(opts: UpdateTwoColumnSectionedOpts) {
    this.updatePage(opts, this.createUpdateTwoColumnSectionedNode(opts));
  }

  createMultiCardInsertNode(opts: MultiCardInsertPageOpts) {
    return createMultiCardInsertPageNode(opts);
  }

  multiCardInsert(opts: MultiCardInsertPageOpts) {
    this.addPage(opts, this.createMultiCardInsertNode(opts));
  }
}
