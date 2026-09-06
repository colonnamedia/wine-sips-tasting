import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
  plugins:[react()],
  build:{rollupOptions:{input:{
    home:resolve(import.meta.dirname,'index.html'),
    trip:resolve(import.meta.dirname,'trip-planner/index.html'),
    tasting:resolve(import.meta.dirname,'wine-tasting/index.html'),
    friends:resolve(import.meta.dirname,'shared-tastings/index.html'),
    journal:resolve(import.meta.dirname,'my-wine-journal/index.html')
  }}}
});
