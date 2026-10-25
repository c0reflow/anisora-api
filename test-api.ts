import { buildApp } from './src/app';
import prisma from './src/db/prisma';

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  const app = await buildApp();
  await app.ready();

  // Test 1: Health Check
  console.log('\n[Test 1] Testing GET /health');
  const healthRes = await app.inject({ method: 'GET', url: '/health' });
  console.log('Status:', healthRes.statusCode);
  const healthBody = JSON.parse(healthRes.body);
  console.log('Health Body:', healthBody);
  if (healthRes.statusCode !== 200 || healthBody.database.status !== 'connected') {
    throw new Error('Health check failed');
  }

  // Test 2: Anime List with Pagination & Filter
  console.log('\n[Test 2] Testing GET /api/v1/anime?limit=3');
  const listRes = await app.inject({ method: 'GET', url: '/api/v1/anime?limit=3' });
  console.log('Status:', listRes.statusCode);
  const listBody = JSON.parse(listRes.body);
  console.log('Total anime:', listBody.pagination.total);
  console.log('Returned items count:', listBody.data.length);
  console.log('Sample anime title:', listBody.data[0]?.title);
  if (listRes.statusCode !== 200 || listBody.data.length !== 3) {
    throw new Error('List test failed');
  }

  // Test 3: Search anime by title
  console.log('\n[Test 3] Testing GET /api/v1/anime?q=Evangelion&limit=2');
  const searchRes = await app.inject({ method: 'GET', url: '/api/v1/anime?q=Evangelion&limit=2' });
  console.log('Status:', searchRes.statusCode);
  const searchBody = JSON.parse(searchRes.body);
  console.log('Found Evangelion matches:', searchBody.pagination.total);
  console.log('Match 1:', searchBody.data[0]?.title);
  if (searchRes.statusCode !== 200) {
    throw new Error('Search test failed');
  }

  // Test 4: Anime by AniSora ID
  const testId = listBody.data[0].anisora_id;
  console.log(`\n[Test 4] Testing GET /api/v1/anime/${testId}`);
  const detailRes = await app.inject({ method: 'GET', url: `/api/v1/anime/${testId}` });
  console.log('Status:', detailRes.statusCode);
  const detailBody = JSON.parse(detailRes.body);
  console.log('Detail Title:', detailBody.title);
  console.log('Synonyms count:', detailBody.synonyms.length);
  console.log('Studios:', detailBody.studios);
  console.log('Tags:', detailBody.tags);
  if (detailRes.statusCode !== 200 || detailBody.anisora_id !== testId) {
    throw new Error('Detail test failed');
  }

  // Test 5: External Provider Lookup (MAL)
  console.log('\n[Test 5] Testing GET /api/v1/anime/by-provider/mal/51478');
  const providerRes = await app.inject({ method: 'GET', url: '/api/v1/anime/by-provider/mal/51478' });
  console.log('Status:', providerRes.statusCode);
  const providerBody = JSON.parse(providerRes.body);
  console.log('Resolved Anime from MAL 51478:', providerBody.title);
  if (providerRes.statusCode !== 200) {
    throw new Error('Provider lookup failed');
  }

  // Test 6: Random Anime
  console.log('\n[Test 6] Testing GET /api/v1/anime/random');
  const randomRes = await app.inject({ method: 'GET', url: '/api/v1/anime/random' });
  console.log('Status:', randomRes.statusCode);
  const randomBody = JSON.parse(randomRes.body);
  console.log('Random anime chosen:', randomBody.title, `(${randomBody.type})`);
  if (randomRes.statusCode !== 200) {
    throw new Error('Random anime failed');
  }

  // Test 7: Metadata Tags
  console.log('\n[Test 7] Testing GET /api/v1/meta/tags?limit=5');
  const tagsRes = await app.inject({ method: 'GET', url: '/api/v1/meta/tags?limit=5' });
  console.log('Status:', tagsRes.statusCode);
  const tagsBody = JSON.parse(tagsRes.body);
  console.log('Top 5 tags:', tagsBody.data);
  if (tagsRes.statusCode !== 200 || tagsBody.data.length !== 5) {
    throw new Error('Meta tags failed');
  }

  // Test 8: Metadata Stats
  console.log('\n[Test 8] Testing GET /api/v1/meta/stats');
  const statsRes = await app.inject({ method: 'GET', url: '/api/v1/meta/stats' });
  console.log('Status:', statsRes.statusCode);
  const statsBody = JSON.parse(statsRes.body);
  console.log('Stats breakdown:', {
    total_anime: statsBody.total_anime,
    total_studios: statsBody.total_studios,
    total_producers: statsBody.total_producers,
    total_tags: statsBody.total_tags,
  });
  if (statsRes.statusCode !== 200) {
    throw new Error('Meta stats failed');
  }

  // Test 9: OpenAPI Swagger Docs
  console.log('\n[Test 9] Testing GET /docs/json (OpenAPI Schema)');
  const docsRes = await app.inject({ method: 'GET', url: '/docs/json' });
  console.log('Status:', docsRes.statusCode);
  const docsBody = JSON.parse(docsRes.body);
  console.log('OpenAPI Title:', docsBody.info.title);
  console.log('OpenAPI Version:', docsBody.openapi);
  console.log('Documented Paths count:', Object.keys(docsBody.paths).length);
  if (docsRes.statusCode !== 200 || !docsBody.openapi.startsWith('3.')) {
    throw new Error('OpenAPI docs failed');
  }

  console.log('\n=== ALL 9 API INTEGRATION TESTS PASSED SUCCESSFULLY! ===\n');

  await app.close();
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
