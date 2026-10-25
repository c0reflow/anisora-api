import { buildApp } from '../src/app';

async function main() {
  const app = await buildApp();
  await app.ready();

  console.log('\n--- Direct Prisma Query Tests ---');
  const prisma = (await import('../src/db/prisma')).default;

  const resA = await prisma.anime.findMany({
    where: {
      OR: [
        { title: { contains: 'Attack on Titan', mode: 'insensitive' } },
        { default_name: { is: { name: { contains: 'Attack on Titan', mode: 'insensitive' } } } },
      ],
    },
    take: 3,
    select: {
      anisora_id: true,
      title: true,
      default_name: true,
    },
  });
  console.log('Query with { is: { name: ... } } count:', resA.length);
  console.log('Query A items:', resA.map(r => ({ id: r.anisora_id.toString(), title: r.title, def: r.default_name?.name })));

  const resB = await prisma.anime.findMany({
    where: {
      OR: [
        { title: { contains: 'Attack on Titan', mode: 'insensitive' } },
        { default_name: { name: { contains: 'Attack on Titan', mode: 'insensitive' } } },
      ],
    },
    take: 3,
    select: {
      anisora_id: true,
      title: true,
      default_name: true,
    },
  });
  console.log('Query with { name: ... } count:', resB.length);
  console.log('Query B items:', resB.map(r => ({ id: r.anisora_id.toString(), title: r.title, def: r.default_name?.name })));


  console.log('\n--- Test 2: Search by Romaji title (Shingeki no Kyojin) ---');
  const res2 = await app.inject({ method: 'GET', url: '/search?query=Shingeki+no+Kyojin&limit=2' });
  const data2 = JSON.parse(res2.body);
  console.log('Result count:', data2.data.length);
  console.log('Item 0:', {
    title: data2.data[0]?.title,
    jname: data2.data[0]?.jname,
    romaji: data2.data[0]?.romaji,
  });

  console.log('\n--- Test 3: Search suggestion (top 5) ---');
  const directSuggs = await (await import('../src/services/search.service')).searchService.getSuggestions('Attack on Titan');
  console.log('Direct getSuggestions("Attack on Titan") count:', directSuggs.suggestions.length);
  console.log('Direct suggestions:', directSuggs.suggestions.map(s => ({ title: s.title, jname: s.jname })));

  const res3 = await app.inject({ method: 'GET', url: '/searchsuggestion', query: { q: 'Attack on Titan' } });
  const data3 = JSON.parse(res3.body);
  console.log('API Suggestions with query obj:', data3.suggestions?.map((s: any) => ({ title: s.title, jname: s.jname })));


  console.log('\n--- Test 4: Spotlights from /home ---');
  const res4 = await app.inject({ method: 'GET', url: '/home' });
  const data4 = JSON.parse(res4.body);
  console.log('Spotlight #1:', {
    title: data4.spotlight[0]?.title,
    jname: data4.spotlight[0]?.jname,
    romaji: data4.spotlight[0]?.romaji,
  });

  console.log('\n--- Test 5: Inspect attack-on-titan-240 in default_name ---');
  const aotMain = await prisma.default_name.findFirst({
    where: { hianime_id: 'attack-on-titan-240' },
  });
  console.log('attack-on-titan-240 record:', aotMain);

  if (aotMain) {
    const resAot = await app.inject({ method: 'GET', url: `/api/v1/anime/${aotMain.anisora_id}` });
    const aotDetail = JSON.parse(resAot.body);
    console.log('Main Attack on Titan API detail response:', {
      anisora_id: aotDetail.anisora_id,
      title: aotDetail.title,
      jname: aotDetail.jname,
      romaji: aotDetail.romaji,
    });
  }

  console.log('\n--- Test 6: Check search suggestion query for "Attack on Titan" ---');
  const resSugg = await app.inject({ method: 'GET', url: '/searchsuggestion?q=Attack' });
  const dataSugg = JSON.parse(resSugg.body);
  console.log('Search suggestions for "Attack":', dataSugg);

  console.log('\nAll title checks completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


