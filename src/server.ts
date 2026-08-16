import { app } from './app';
import { env } from './lib/env';

app.listen(env.PORT, () => {
  console.log(`quick-todo-service listening on http://localhost:${env.PORT}`);
});
