import { exec } from './mysql.ts';

const content = await Deno.readTextFile(new URL('../../db/migrations.sql', import.meta.url));
for (const statement of content.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
  await exec(statement);
}
console.log('Migrations applied');
