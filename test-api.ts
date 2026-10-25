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

  // Test 10: Increment Anime Views & Likes
  console.log(`\n[Test 10] Testing POST /api/v1/anime/${testId}/view and /like`);
  const viewRes = await app.inject({ method: 'POST', url: `/api/v1/anime/${testId}/view` });
  console.log('View Status:', viewRes.statusCode, JSON.parse(viewRes.body));
  const likeRes = await app.inject({ method: 'POST', url: `/api/v1/anime/${testId}/like` });
  console.log('Like Status:', likeRes.statusCode, JSON.parse(likeRes.body));
  if (viewRes.statusCode !== 200 || likeRes.statusCode !== 200) {
    throw new Error('View or Like increment failed');
  }

  // Test 11: Create User
  console.log('\n[Test 11] Testing POST /api/v1/users (User Registration)');
  const randomEmail = `otaku_${Date.now()}@example.com`;
  const userRes = await app.inject({
    method: 'POST',
    url: '/api/v1/users',
    payload: {
      email: randomEmail,
      password: 'SuperSecretPassword123!',
      username: `otaku_${Date.now().toString().slice(-4)}`,
    },
  });
  console.log('User Status:', userRes.statusCode);
  const userBody = JSON.parse(userRes.body);
  console.log('Created User ID:', userBody.id, 'Email:', userBody.email);
  if (userRes.statusCode !== 201 || !userBody.id) {
    throw new Error('User creation failed');
  }

  // Test 12: Episode Comments with episode_id = animeid&ep=(int)
  const testEpisodeId = `${testId}&ep=1`;
  console.log(`\n[Test 12] Testing Comments for episode: ${testEpisodeId}`);
  
  // 12a: Post parent comment
  const commentRes1 = await app.inject({
    method: 'POST',
    url: '/api/v1/comments',
    payload: {
      episode_id: testEpisodeId,
      user_id: userBody.id,
      comment: 'Episode 1 animation was incredible!',
      type: 'parent',
    },
  });
  console.log('Parent Comment Status:', commentRes1.statusCode);
  const comment1 = JSON.parse(commentRes1.body);
  console.log('Created Parent Comment ID:', comment1.id);
  if (commentRes1.statusCode !== 201) throw new Error('Parent comment failed');

  // 12b: Post reply to parent comment
  const commentRes2 = await app.inject({
    method: 'POST',
    url: '/api/v1/comments',
    payload: {
      episode_id: testEpisodeId,
      user_id: userBody.id,
      comment: 'Agreed, the soundtrack was fire too!',
      type: 'reply',
      parent_comment_id: comment1.id,
    },
  });
  console.log('Reply Comment Status:', commentRes2.statusCode);
  const comment2 = JSON.parse(commentRes2.body);
  console.log('Created Reply Comment ID:', comment2.id);
  if (commentRes2.statusCode !== 201) throw new Error('Reply comment failed');

  // 12c: Fetch comments for this episode
  const fetchCommentsRes = await app.inject({
    method: 'GET',
    url: `/api/v1/comments/${encodeURIComponent(testEpisodeId)}`,
  });
  console.log('Fetch Comments Status:', fetchCommentsRes.statusCode);
  const commentsList = JSON.parse(fetchCommentsRes.body);
  console.log('Found comments for episode:', commentsList.pagination.total);
  if (fetchCommentsRes.statusCode !== 200 || commentsList.pagination.total < 2) {
    throw new Error('Fetch comments failed');
  }

  // 12d: Delete created comments (cleanup)
  await app.inject({ method: 'DELETE', url: `/api/v1/comments/${comment2.id}` });
  await app.inject({ method: 'DELETE', url: `/api/v1/comments/${comment1.id}` });
  console.log('Cleaned up test comments successfully.');

  console.log('\n=== ALL 12 API INTEGRATION TESTS PASSED SUCCESSFULLY! ===\n');

  await app.close();
  await prisma.$disconnect();
}

runTests().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
