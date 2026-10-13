import type { DesignScheme } from "./scheme";

export interface TokenMetadataInput {
  design: DesignScheme;
  name: string;
  description: string;
  /** English name (optional, for bilingual display) */
  nameEn?: string;
  /** English description (optional, for bilingual display) */
  descriptionEn?: string;
  imageUri: string;
  schemeUri: string;
  contentHash: string;
}

/** Build ERC-721 metadata (including the full scheme JSON, so the Remix page can load the original). */
export function buildTokenMetadata(input: TokenMetadataInput): Record<string, unknown> {
  const { design, name, description, nameEn, descriptionEn, imageUri, schemeUri, contentHash } = input;
  const dim = design.room.dimensions;
  const gen = design.generator;
  const genLabel = gen ? [gen.provider, gen.model].filter(Boolean).join(" · ") : "";
  return {
    name,
    nameEn: nameEn ?? design.nameEn,
    description,
    descriptionEn: descriptionEn ?? design.descriptionEn,
    image: imageUri,
    attributes: [
      { trait_type: "主题", value: design.style.theme },
      { trait_type: "房间", value: design.room.type },
      { trait_type: "家具数量", value: design.furniture.length },
      { trait_type: "户型尺寸", value: `${dim.width}m × ${dim.length}m` },
      { trait_type: "remixOf", value: design.parentId ? String(design.parentId) : "0" },
      ...(genLabel ? [{ trait_type: "AI生成器", value: genLabel }] : [])
    ],
    properties: {
      contentHash,
      schemeUri,
      version: design.version,
      license: design.license ?? "CC-BY 4.0",
      ...(gen ? { generator: gen } : {})
    },
    scheme: design
  };
}
