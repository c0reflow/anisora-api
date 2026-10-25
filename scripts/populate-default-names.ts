import fs from 'fs';
import path from 'path';
import prisma from '../src/db/prisma';

interface HiAnimeItem {
  id: string;
  name: string;
  jname: string;
}

interface HiAnimeCatalog {
  animes: HiAnimeItem[];
}

async function populateDefaultNames() {
  console.log('--- Populating default_name table from hianime_catalog.json ---');

  const catalogPath = path.join(__dirname, '..', 'hianime_catalog.json');
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`hianime_catalog.json not found at ${catalogPath}`);
  }

  console.log('Loading hianime_catalog.json...');
  const rawCatalog: HiAnimeCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const hiMap = new Map<string, HiAnimeItem>();

  for (const item of rawCatalog.animes) {
    if (item.id) {
      hiMap.set(item.id, item);
    }
  }
  console.log(`Loaded ${hiMap.size} unique anime from HiAnime catalog.`);

  console.log('Fetching anime records from database...');
  const totalAnime = await prisma.anime.count();
  console.log(`Total anime in database: ${totalAnime}`);

  const batchSize = 2000;
  let skip = 0;
  let matchedCount = 0;
  let fallbackCount = 0;
  let totalInserted = 0;

  while (skip < totalAnime) {
    const chunk = await prisma.anime.findMany({
      skip,
      take: batchSize,
      select: {
        anisora_id: true,
        hianime_id: true,
        title: true,
      },
    });

    if (chunk.length === 0) break;

    const rowsToInsert = chunk.map((a) => {
      const match = a.hianime_id ? hiMap.get(a.hianime_id) : null;
      if (match) {
        matchedCount++;
        return {
          anisora_id: a.anisora_id,
          name: match.name || a.title,
          jname: match.jname || a.title,
          hianime_id: a.hianime_id,
        };
      } else {
        fallbackCount++;
        return {
          anisora_id: a.anisora_id,
          name: a.title,
          jname: a.title,
          hianime_id: a.hianime_id,
        };
      }
    });

    // Insert batch using raw SQL with ON CONFLICT DO UPDATE so it's idempotent and fast
    const valuesSql: string[] = [];
    for (const r of rowsToInsert) {
      const safeName = r.name.replace(/'/g, "''");
      const safeJname = r.jname.replace(/'/g, "''");
      const safeHiId = r.hianime_id ? `'${r.hianime_id.replace(/'/g, "''")}'` : 'NULL';
      valuesSql.push(`(${r.anisora_id}, '${safeName}', '${safeJname}', ${safeHiId})`);
    }

    const query = `
      INSERT INTO default_name (anisora_id, name, jname, hianime_id)
      VALUES ${valuesSql.join(',\n')}
      ON CONFLICT (anisora_id) DO UPDATE SET
        name = EXCLUDED.name,
        jname = EXCLUDED.jname,
        hianime_id = EXCLUDED.hianime_id;
    `;

    await prisma.$executeRawUnsafe(query);

    totalInserted += rowsToInsert.length;
    skip += batchSize;
    console.log(`Progress: ${totalInserted} / ${totalAnime} (${Math.round((totalInserted / totalAnime) * 100)}%)`);
  }

  console.log('\n--- Population Summary ---');
  console.log(`Total rows inserted/updated: ${totalInserted}`);
  console.log(`Matched with HiAnime English titles: ${matchedCount}`);
  console.log(`Fallback to existing titles: ${fallbackCount}`);
  console.log('✅ default_name table successfully populated!');
}

populateDefaultNames()
  .catch((err) => {
    console.error('❌ Failed to populate default_name table:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
