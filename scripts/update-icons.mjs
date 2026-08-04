import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import process from "node:process";


const API_URL =
  "https://raw.githubusercontent.com/anish-shanbhag/minecraft-api/master/data/items.json";

const PROJECT_ROOT =
  process.cwd();

const ICON_DIRECTORY =
  path.join(
    PROJECT_ROOT,
    "public",
    "data",
    "icons",
  );

const INDEX_PATH =
  path.join(
    PROJECT_ROOT,
    "public",
    "data",
    "icon-index.json",
  );

function normalizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const failureReportPath =
  path.join(
    PROJECT_ROOT,
    "public",
    "data",
    "failed-icons.json",
  );

function normalizeAlias(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}


async function loadExistingIndex() {
  try {
    const text =
      await readFile(
        INDEX_PATH,
        "utf8",
      );

    const parsed =
      JSON.parse(text);

    return Array.isArray(parsed.icons)
      ? parsed.icons
      : [];
  } catch {
    return [];
  }
}

async function getMinecraftWikiIconUrl(id) {
  const spriteId =
    id.replace(/_/g, "-");

  const fileTitle =
    `File:ItemSprite_${spriteId}.png`;

  const apiUrl =
    new URL(
      "https://minecraft.wiki/api.php",
    );

  apiUrl.searchParams.set(
    "action",
    "query",
  );

  apiUrl.searchParams.set(
    "format",
    "json",
  );

  apiUrl.searchParams.set(
    "origin",
    "*",
  );

  apiUrl.searchParams.set(
    "prop",
    "imageinfo",
  );

  apiUrl.searchParams.set(
    "iiprop",
    "url",
  );

  apiUrl.searchParams.set(
    "titles",
    fileTitle,
  );

  const response =
    await fetch(apiUrl);

  if (!response.ok) {
    return null;
  }

  const data =
    await response.json();

  const pages =
    Object.values(
      data?.query?.pages ?? {},
    );

  const imageUrl =
    pages[0]?.imageinfo?.[0]?.url;

  return typeof imageUrl === "string"
    ? imageUrl
    : null;
}

async function downloadImage(
  urls,
  destination,
  fallbackId,
) {
  let lastError = null;

  const allUrls = [
    ...urls,
  ];

  const wikiUrl =
    await getMinecraftWikiIconUrl(
      fallbackId,
    );

  if (wikiUrl) {
    allUrls.push(wikiUrl);
  }

  for (const url of allUrls) {
    try {
      const response =
        await fetch(url);

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`,
        );
      }

      const contentType =
        response.headers.get(
          "content-type",
        ) ?? "";

      if (
        !contentType.includes("image")
      ) {
        throw new Error(
          `Expected image, received ${contentType ||
          "unknown content"
          }`,
        );
      }

      const bytes =
        Buffer.from(
          await response.arrayBuffer(),
        );

      await writeFile(
        destination,
        bytes,
      );

      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ??
    new Error(
      "No icon source succeeded.",
    )
  );
}


async function main() {
  console.log(
    "Downloading Minecraft item information...",
  );

  await mkdir(
    ICON_DIRECTORY,
    {
      recursive: true,
    },
  );

  const existingIcons =
    await loadExistingIndex();

  const existingById =
    new Map(
      existingIcons.map(
        (icon) => [
          normalizeId(icon.id),
          icon,
        ],
      ),
    );

  const response =
    await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      `Item API request failed: ${response.status}`,
    );
  }

  const items =
    await response.json();

  if (!Array.isArray(items)) {
    throw new Error(
      "The item API did not return an array.",
    );
  }

  const iconEntries = [];

  let downloaded = 0;
  let failed = 0;

  const failedIcons = [];
  const processedIds = new Set();

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    const name =
      String(item.name ?? "").trim();

    const rawId =
      item.namespacedId ??
      item.id ??
      name;

    const id =
      normalizeId(rawId);

    if (processedIds.has(id)) {
      continue;
    }

    processedIds.add(id);

    const imageUrls = [
      `https://raw.githubusercontent.com/anish-shanbhag/minecraft-api/master/public/images/items/${id}.png`,
      `https://raw.githubusercontent.com/anish-shanbhag/minecraft-api/master/public/images/blocks/${id}.png`,
    ];

    if (
      !name ||
      !id
    ) {
      continue;
    }

    const filename =
      `${id}.png`;

    const destination =
      path.join(
        ICON_DIRECTORY,
        filename,
      );

    const existing =
      existingById.get(id);

    const aliases =
      new Set([
        normalizeAlias(name),
        normalizeAlias(id),
        normalizeAlias(rawId),
        ...(
          Array.isArray(existing?.aliases)
            ? existing.aliases.map(
              normalizeAlias,
            )
            : []
        ),
      ]);

    try {
      await downloadImage(
        imageUrls,
        destination,
        id,
      );

      downloaded += 1;

      iconEntries.push({
        id,
        name,
        filename,
        aliases:
          Array.from(aliases)
            .filter(Boolean)
            .sort(),
      });

      console.log(
        `[${index + 1}/${items.length}] ${name}`,
      );
    } catch (error) {
      failed += 1;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      failedIcons.push({
        id,
        name,
        attemptedUrls: imageUrls,
        error: message,
      });

      console.warn(
        `Skipped ${name} (${id}): ${message}`,
      );
    }
  }

  iconEntries.sort(
    (a, b) =>
      a.name.localeCompare(b.name),
  );

  await writeFile(
    INDEX_PATH,
    JSON.stringify(
      {
        icons: iconEntries,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  await writeFile(
    failureReportPath,
    JSON.stringify(
      {
        failed: failedIcons,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log("");
  console.log(
    `Downloaded: ${downloaded}`,
  );

  console.log(
    `Failed: ${failed}`,
  );

  console.log(
    `Index entries: ${iconEntries.length}`,
  );

  console.log(
    `Saved icons to: ${ICON_DIRECTORY}`,
  );

  console.log(
    `Saved index to: ${INDEX_PATH}`,
  );

  console.log(
    `Failure report: ${failureReportPath}`,
  );
}


main().catch((error) => {
  console.error("");
  console.error(
    error instanceof Error
      ? error.stack
      : error,
  );

  process.exitCode = 1;
});