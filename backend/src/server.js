const dotenv = require('dotenv');
dotenv.config();

const fastify = require('fastify')({ logger: false });
const { registerExportsRoutes } = require('./routes/exports');

fastify.post('/health', async (request, reply) => {
  return { ok: true };
});

registerExportsRoutes({
  post: (path, handler) => fastify.post(path, async (request, reply) => handler(request, reply))
});

const port = process.env.PORT ? Number(process.env.PORT) : 8001;
fastify.listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`Fleet IQ backend listening on ${port}`);
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
