import injectSocketIO from './src/lib/server/socketHandler';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Create a simple Vite plugin to run Socket.io
const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server: any) {
		if (!server.httpServer) return;

		injectSocketIO(server.httpServer);
	}
};

export default defineConfig({ plugins: [tailwindcss(), sveltekit(), webSocketServer] });
