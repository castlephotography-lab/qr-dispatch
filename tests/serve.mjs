import { startServer } from './server.mjs';

const server = await startServer();
console.log(`QR Dispatch available at ${server.url}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
