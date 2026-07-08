import { handleApiRequest } from './api';

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler;
