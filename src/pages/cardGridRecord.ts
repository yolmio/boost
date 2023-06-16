import { addressCard, AddressCardOpts } from "../components/addressCard.js";
import {
  addressesCard,
  AddressesCardOpts,
} from "../components/addressesCard.js";
import { alert } from "../components/alert.js";
import { button } from "../components/button.js";
import { card } from "../components/card.js";
import { chip } from "../components/chip.js";
import { circularProgress } from "../components/circularProgress.js";
import { deleteRecordDialog } from "../components/deleteRecordDialog.js";
import { imageDalog } from "../components/imageDialog.js";
import {
  keyRecordInfoCard,
  KeyRecordInfoCardOpts,
} from "../components/keyRecordInfoCard.js";
import {
  MainFieldsCard,
  mainFieldsCard,
} from "../components/mainFieldsCard.js";
import { materialIcon } from "../components/materialIcon.js";
import {
  namedPageHeader,
  NamedPageHeaderOpts,
} from "../components/namedPageHeader.js";
import { notesCard, NotesCardOpts } from "../components/notesCard.js";
import {
  notesListCard,
  NotesListCardOpts,
} from "../components/notesListCard.js";
import { recordDeleteButton } from "../components/recordDeleteButton.js";
import {
  relatedRecordsTimeline,
  RelatedRecordsTimelineOpts,
} from "../components/relatedRecordsTimeline.js";
import {
  relatedTableFooter,
  RelatedTableFooterOpts,
} from "../components/relatedTableFooter.js";
import {
  sectionedFieldsDisplay,
  SectionedFieldsDisplayOpts,
} from "../components/sectionedFieldsDisplay.js";
import {
  StaticTableCard,
  staticTableCard,
} from "../components/staticTableCard.js";
import {
  twoColumnDisplayCard,
  TwoColumnDisplayCardOpts,
} from "../components/twoColumnDisplayCard.js";
import { typography } from "../components/typography.js";
import { addPage } from "../modelHelpers.js";
import { element, ifNode, state, switchNode } from "../nodeHelpers.js";
import { Node } from "../nodeTypes.js";
import { if_, navigate, record, scalar, setScalar } from "../procHelpers.js";
import { model } from "../singleton.js";
import {
  containerStyles,
  flexGrowStyles,
  getGridItemStyles,
  getGridStyles,
  GridDescription,
  GridItemDescription,
  visuallyHiddenStyles,
} from "../styleUtils.js";
import { deepmerge } from "../utils/deepmerge.js";
import { pluralize } from "../utils/inflectors.js";
import { stringLiteral } from "../utils/sqlHelpers.js";
import { BaseStatement } from "../yom.js";
import { updateFormPage } from "./updateForm.js";

interface CardGridRecordKeyRecordInfo
  extends Omit<KeyRecordInfoCardOpts, "table" | "recordId"> {
  /**
   * Displays a card's name as a header, a picture if exists on the record, and
   * fields from the record as specified.
   *
   * Also displays an edit link and delete button.
   */
  type: "keyRecordInfo";
}

interface CardGridRecordNotesList
  extends Omit<
    NotesListCardOpts,
    "foreignKey" | "foreignKeyField" | "notesTable"
  > {
  /**
   * Card to display, create, edit and delete notes related to this record.
   */
  type: "notesList";
  notesTable?: string;
  foreignKeyField?: string;
}

interface CardGridRecordSectionedFields
  extends Omit<SectionedFieldsDisplayOpts, "table" | "idExpr"> {
  /**
   * Displays a card's specified fields in one or more sections.
   */
  type: "sectionedFields";
}

interface CardGridRecordRelatedRecordsTimeline
  extends Omit<RelatedRecordsTimelineOpts, "foreignKeyId" | "foreignKeyTable"> {
  /**
   * A footer of a timeline of records that are related to this record.
   */
  type: "relatedRecordsTimeline";
}

interface CardGridRecordRelatedTable
  extends Omit<
    RelatedTableFooterOpts,
    "foreignKeyId" | "foreignKeyTable" | "refreshKey" | "triggerRefresh"
  > {
  type: "relatedTable";
}

interface CardGridRecordMainFields
  extends Omit<MainFieldsCard, "table" | "idExpr"> {
  type: "mainFields";
}

interface CardGridRecordStaticTable
  extends Omit<StaticTableCard, "table" | "idExpr"> {
  type: "staticTable";
}

interface CardGridRecordAddress
  extends Omit<AddressCardOpts, "table" | "recordId"> {
  type: "address";
}

interface CardGridRecordAddresses
  extends Omit<AddressesCardOpts, "table" | "recordId" | "refreshKey"> {
  type: "addresses";
}

interface CardGridRecordTwoColumnDisplay
  extends Omit<TwoColumnDisplayCardOpts, "table" | "recordId" | "refreshKey"> {
  type: "twoColumnDisplay";
}

interface CardGridRecordNotes
  extends Omit<NotesCardOpts, "table" | "recordId"> {
  type: "notes";
}

interface CardGridRecordSimpleNamedHeader
  extends Omit<
    NamedPageHeaderOpts,
    | "tableName"
    | "refreshKey"
    | "triggerRefresh"
    | "editUrl"
    | "afterDeleteUrl"
    | "recordId"
  > {
  type: "namedHeader";
}

interface CardGridRecordSuperSimpleNamedHeader {
  type: "superSimpleHeader";
  header: string;
}

export interface CardGridRecordPageOpts extends GridDescription {
  path?: string;
  table: string;
  createUpdatePage?: boolean;
  header?:
    | CardGridRecordSimpleNamedHeader
    | CardGridRecordSuperSimpleNamedHeader;
  customHeader?: (props: CardGridRecordProps) => Node;
  cards: (
    | ({
        content:
          | CardGridRecordKeyRecordInfo
          | CardGridRecordNotesList
          | CardGridRecordSectionedFields
          | CardGridRecordMainFields
          | CardGridRecordStaticTable
          | CardGridRecordAddress
          | CardGridRecordNotes
          | CardGridRecordAddresses
          | CardGridRecordTwoColumnDisplay;
      } & GridItemDescription)
    | ({
        customContent: (props: CardGridRecordProps) => Node;
      } & GridItemDescription)
  )[];
  footer?: CardGridRecordRelatedRecordsTimeline | CardGridRecordRelatedTable;
  customFooter?: (props: CardGridRecordProps) => Node;
}

export interface CardGridRecordProps {
  recordId: string;
  refreshKey: string;
  triggerRefresh: BaseStatement;
}

// maybe switch to record grid page and make cards dependent on content (more control to each part)

export function cardGridRecordPage(opts: CardGridRecordPageOpts) {
  const tableModel = model.database.tables[opts.table];
  const pathBase = pluralize(opts.table.split("_").join(" "))
    .split(" ")
    .join("-");
  const path = opts.path ?? pathBase + `/{record_id:id}`;
  if (!tableModel.recordDisplayName) {
    throw new Error(
      "Table must have recordDisplayName or you must have an explicit header for cardGridRecordPage"
    );
  }
  const props: CardGridRecordProps = {
    recordId: "ui.record_id",
    refreshKey: "ui.card_grid_record_refresh_key",
    triggerRefresh: setScalar(
      "ui.card_grid_record_refresh_key",
      `ui.card_grid_record_refresh_key + 1`
    ),
  };
  const children: Node[] = [];
  if (opts.header) {
    switch (opts.header.type) {
      case "namedHeader": {
        children.push(
          namedPageHeader({
            afterDeleteUrl: stringLiteral(pathBase),
            editUrl: `${stringLiteral(
              pathBase
            )} || '/' || ui.record_id || '/edit'`,
            refreshKey: props.refreshKey,
            tableName: opts.table,
            triggerRefresh: props.triggerRefresh,
            recordId: props.recordId,
            ...opts.header,
          })
        );
        break;
      }
      case "superSimpleHeader": {
        children.push(
          element("div", {
            styles: {
              gridColumn: `span 12 / span 12`,
              display: "flex",
              gap: 1,
              alignItems: "baseline",
            },
            children: [
              typography({
                level: "h5",
                children: stringLiteral(opts.header.header),
              }),
              element("div", {
                styles: flexGrowStyles,
              }),
              button({
                color: "info",
                size: "sm",
                variant: "outlined",
                startDecorator: materialIcon("Edit"),
                children: `'Edit'`,
                href: `${stringLiteral(
                  pathBase
                )} || '/' || ui.record_id || '/edit'`,
              }),
              recordDeleteButton({
                table: opts.table,
                recordId: props.recordId,
                afterDeleteService: [navigate(stringLiteral(pathBase))],
              }),
            ],
          })
        );
        break;
      }
    }
  } else if (opts.customHeader) {
    children.push(opts.customHeader(props));
  }
  for (const cardOpts of opts.cards) {
    let content;
    if ("content" in cardOpts) {
      switch (cardOpts.content.type) {
        case "keyRecordInfo":
          content = keyRecordInfoCard({
            table: opts.table,
            recordId: "ui.record_id",
            ...cardOpts.content,
          });
          break;
        case "notesList": {
          let foreignKeyField = cardOpts.content.foreignKeyField;
          const notesTable =
            cardOpts.content.notesTable ?? opts.table + "_note";
          if (!foreignKeyField) {
            const notesTableModel = model.database.tables[notesTable];
            if (!notesTableModel) {
              throw new Error(`No notes table found for ${notesTable}`);
            }
            const fkField = Object.values(notesTableModel.fields).find(
              (f) => f.type === "ForeignKey" && f.table === opts.table
            );
            if (!fkField) {
              throw new Error(
                `No foreign key field found for ${notesTable} to ${opts.table}`
              );
            }
            foreignKeyField = fkField.name.name;
          }
          content = notesListCard({
            foreignKey: "ui.record_id",
            foreignKeyField,
            notesTable,
          });
          break;
        }
        case "sectionedFields":
          content = sectionedFieldsDisplay({
            table: opts.table,
            idExpr: "ui.record_id",
            ...cardOpts.content,
          });
          break;
        case "mainFields":
          content = mainFieldsCard({
            table: opts.table,
            idExpr: "ui.record_id",
            ...cardOpts.content,
          });
          break;
        case "staticTable":
          content = staticTableCard({
            table: opts.table,
            idExpr: "ui.record_id",
            refreshKey: props.refreshKey,
            ...cardOpts.content,
          });
          break;
        case "address":
          content = addressCard({
            table: opts.table,
            recordId: "ui.record_id",
            ...cardOpts.content,
          });
          break;
        case "addresses":
          content = addressesCard({
            table: opts.table,
            recordId: "ui.record_id",
            refreshKey: props.refreshKey,
            ...cardOpts.content,
          });
          break;
        case "notes":
          content = notesCard({
            table: opts.table,
            recordId: "ui.record_id",
          });
          break;
        case "twoColumnDisplay":
          content = twoColumnDisplayCard({
            table: opts.table,
            recordId: "ui.record_id",
            refreshKey: props.refreshKey,
            ...cardOpts.content,
          });
          break;
      }
    } else {
      content = cardOpts.customContent(props);
    }
    children.push(
      card({
        variant: "outlined",
        styles: getGridItemStyles(cardOpts),
        children: content,
      })
    );
  }
  if (opts.footer) {
    switch (opts.footer.type) {
      case "relatedRecordsTimeline": {
        children.push(
          relatedRecordsTimeline({
            styles: {
              gridColumn: `span 12 / span 12`,
            },
            foreignKeyId: "ui.record_id",
            foreignKeyTable: opts.table,
            ...opts.footer,
          })
        );
        break;
      }
      case "relatedTable": {
        children.push(
          relatedTableFooter({
            foreignKeyId: "ui.record_id",
            foreignKeyTable: opts.table,
            refreshKey: props.refreshKey,
            triggerRefresh: props.triggerRefresh,
            ...opts.footer,
          })
        );
        break;
      }
    }
  } else if (opts.customFooter) {
    children.push(opts.customFooter(props));
  }
  const tableLowercase = stringLiteral(
    tableModel.name.displayName.toLowerCase()
  );
  const content = state({
    procedure: [
      // If we update this on the service proc and not on the client proc, it will run the new state
      // in the same round trip and so there will be no switch to status = 'fallback_triggered'
      scalar(`card_grid_record_refresh_key`, `0`),
    ],
    children: state({
      watch: [`card_grid_record_refresh_key`],
      procedure: [
        scalar(
          `record_exists`,
          `exists (select id from db.${opts.table} where id = record_id)`
        ),
      ],
      statusScalar: "status",
      children: switchNode(
        [
          `status = 'fallback_triggered'`,
          element("div", {
            styles: { display: "flex", justifyContent: "center", mt: 8 },
            children: circularProgress({ size: "lg" }),
          }),
        ],
        [
          `status = 'failed'`,
          element("div", {
            styles: { display: "flex", justifyContent: "center", mt: 8 },
            children: alert({
              color: "danger",
              startDecorator: materialIcon("Report"),
              size: "lg",
              children: `'Unable to get ' || ${tableLowercase}`,
            }),
          }),
        ],
        [
          `not record_exists`,
          element("div", {
            styles: { display: "flex", justifyContent: "center", mt: 8 },
            children: `'No ' || ${tableLowercase} || ' with id'`,
          }),
        ],
        [
          `true`,
          element("div", {
            styles: [
              getGridStyles(
                deepmerge(
                  {
                    gridGap: 1.5,
                    md: {
                      gridGap: 2,
                    },
                  },
                  opts
                )
              ),
              containerStyles(),
              { py: 2 },
            ],
            children,
          }),
        ]
      ),
    }),
  });
  if (opts.createUpdatePage) {
    updateFormPage({
      table: opts.table,
      afterSubmitService: () => [
        navigate(`${stringLiteral(pathBase)} || '/' || ui.record_id`),
      ],
      content: { type: "AutoLabelOnLeft" },
    });
  }
  addPage({
    path,
    content,
  });
}
