import { ImageSetFieldGroup, ImageUsage } from "../system";
import { DomStatements, ServiceStatements } from "../statements";
import { ident } from "./sqlHelpers";

export function getUploadStatements(
  tableName: string,
  recordId: string,
  group: ImageSetFieldGroup,
) {
  const spawnUploadTasks = new DomStatements();
  const variants = Object.values(group.variants);
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    spawnUploadTasks.scalar(`uuid_${i}`, { type: "Uuid" });
    spawnUploadTasks.spawn({
      handleScalar: `task_${i}`,
      procedure: (s) =>
        s
          .addImage({
            fileRecord: `new_image`,
            jpegQuality: variant.quality?.toString() ?? "80",
            domUuid: `(select uuid from file)`,
            resize: variant.resize,
          })
          .setScalar(`uuid_${i}`, `new_image.uuid`),
    });
  }
  const joinUploadTasks = new DomStatements().joinTasks(
    Object.values(group.variants).map((_, i) => `task_${i}`),
  );
  const setFields = Object.keys(group.variants)
    .map((fieldName, i) => `${ident(fieldName)} = uuid_${i}`)
    .join(",");
  const updateImagesInDb = new ServiceStatements().modify(
    `update db.${ident(tableName)} set ${setFields} where id = ${recordId}`,
  );
  return { spawnUploadTasks, joinUploadTasks, updateImagesInDb };
}

export function getVariantFromImageSet(
  group: ImageSetFieldGroup,
  variant: ImageUsage,
  fallbackVariants: ImageUsage[] = [],
) {
  const variants = Object.entries(group.variants);
  let fallbackIndex: number | undefined;
  let foundVariantName: string | undefined;
  for (const [name, v] of variants) {
    if (v.usage === variant) {
      return name;
    }
    if (!v.usage) {
      continue;
    }
    const newFallbackIndex = fallbackVariants.indexOf(v.usage);
    if (newFallbackIndex === -1) {
      continue;
    }
    if (newFallbackIndex === 0) {
      return name;
    }
    if (fallbackIndex === undefined || newFallbackIndex < fallbackIndex) {
      fallbackIndex = newFallbackIndex;
      foundVariantName = name;
    }
  }
  return foundVariantName;
}
