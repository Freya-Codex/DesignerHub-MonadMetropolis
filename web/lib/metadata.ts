import type { DesignScheme } from "./scheme";

export interface TokenMetadataInput {
  design: DesignScheme;
  name: string;
  description: string;
  imageUri: string;
  schemeUri: string;
  contentHash: string;
}

/** 构造 ERC-721 metadata（含完整方案 JSON，供 Remix 页面加载原方案）。 */
export function buildTokenMetadata(input: TokenMetadataInput): Record<string, unknown> {
  const { design, name, description, imageUri, schemeUri, contentHash } = input;
  const dim = design.room.dimensions;
  return {
    name,
    description,
    image: imageUri,
    attributes: [
      { trait_type: "主题", value: design.style.theme },
      { trait_type: "房间", value: design.room.type },
      { trait_type: "家具数量", value: design.furniture.length },
      { trait_type: "户型尺寸", value: `${dim.width}m × ${dim.length}m` },
      { trait_type: "remixOf", value: design.parentId ? String(design.parentId) : "0" }
    ],
    properties: {
      contentHash,
      schemeUri,
      version: design.version,
      license: design.license ?? "CC-BY 4.0"
    },
    scheme: design
  };
}
