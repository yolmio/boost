import * as addressCard from "./addressCard.js";
import * as addressesCard from "./addressesCard.js";
import * as namedHeader from "./namedPageHeader.js";
import * as notesListCard from "./notesListCard.js";
import * as staticTableCard from "./staticTableCard.js";
import * as twoColumnDisplayCard from "./twoColumnDisplayCard.js";
import * as notesCard from "./notesCard.js";
import * as relatedTable from "./relatedTable.js";
import * as relatedRecordsTimeline from "./relatedRecordsTimeline.js";
import * as superSimpleHeader from "./superSimpleHeader.js";
import * as attachmentsCard from "./attachmentsCard.js";

export const childFnMap = {
  [addressCard.name]: addressCard.content,
  [addressesCard.name]: addressesCard.content,
  [namedHeader.name]: namedHeader.content,
  [notesListCard.name]: notesListCard.content,
  [staticTableCard.name]: staticTableCard.content,
  [twoColumnDisplayCard.name]: twoColumnDisplayCard.content,
  [notesCard.name]: notesCard.content,
  [relatedTable.name]: relatedTable.content,
  [relatedRecordsTimeline.name]: relatedRecordsTimeline.content,
  [superSimpleHeader.name]: superSimpleHeader.content,
  [attachmentsCard.name]: attachmentsCard.content,
};

export type ChildOpts =
  | (addressCard.Opts & { type: typeof addressCard.name })
  | (attachmentsCard.Opts & { type: typeof attachmentsCard.name })
  | (namedHeader.Opts & { type: typeof namedHeader.name })
  | (addressesCard.Opts & { type: typeof addressesCard.name })
  | (notesListCard.Opts & { type: typeof notesListCard.name })
  | (staticTableCard.Opts & { type: typeof staticTableCard.name })
  | (twoColumnDisplayCard.Opts & { type: typeof twoColumnDisplayCard.name })
  | (notesCard.Opts & { type: typeof notesCard.name })
  | (relatedTable.Opts & { type: typeof relatedTable.name })
  | (relatedRecordsTimeline.Opts & {
      type: typeof relatedRecordsTimeline.name;
    })
  | (superSimpleHeader.Opts & { type: typeof superSimpleHeader.name });
