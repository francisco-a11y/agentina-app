// Edge middleware: si el User-Agent matchea bots IA conocidos,
// rewriteamos / a /agents/. Versión humana del sitio queda intacta para
// el resto.
//
// Lista canónica de bots IA (case-insensitive). Si querés sumar uno nuevo,
// agregá una palabra al pattern.

export const config = {
  // Solo aplicar al root del sitio. Resto de paths sirven normal.
  matcher: ['/'],
};

const AI_BOT_PATTERN = /\b(GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|anthropic-ai|Claude-Web|PerplexityBot|Perplexity-User|Google-Extended|Bytespider|cohere-ai|meta-externalagent|Meta-ExternalAgent|FacebookBot|Applebot-Extended|YouBot|Diffbot|GoogleOther|DuckAssistBot|Amazonbot|YandexAdditional|YandexAdditionalBot|MistralAI-User|TimpiBot|omgili|omgilibot|Webzio-Extended|Quora-Bot|cohere-training-data-crawler)\b/i;

export default function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  const isAIBot = AI_BOT_PATTERN.test(userAgent);

  if (isAIBot) {
    // Rewrite (URL no cambia, contenido sí). Mejor que redirect 301
    // para mantener canonical y evitar costos extra de roundtrip.
    const url = new URL(request.url);
    url.pathname = '/agents/';
    return Response.redirect(url, 307);
  }

  // No rewrite — humano sigue al index normal.
  return;
}
