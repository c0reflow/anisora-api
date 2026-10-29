import { buildApp } from './app';
import { config } from './config/env';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`🚀 Server listening on http://${config.host}:${config.port}`);
    console.log(`📌 Endpoint ready at http://${config.host}:${config.port}/api/v1/mal/home`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

