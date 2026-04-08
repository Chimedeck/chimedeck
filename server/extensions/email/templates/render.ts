// server/extensions/email/templates/render.ts
// Loads .html Handlebars templates from the html/ subfolder, compiles them,
// and caches the compiled functions so repeated sends skip disk I/O.

import Handlebars from 'handlebars';
import path from 'path';

// Module-level cache so each template is read from disk and compiled only once.
const compiledCache = new Map<string, HandlebarsTemplateDelegate>();

interface RenderTemplateInput {
  templateName: string;
  data: Record<string, unknown>;
}

export async function renderTemplate({ templateName, data }: RenderTemplateInput): Promise<string> {
  let compiled = compiledCache.get(templateName);

  if (!compiled) {
    // import.meta.dir resolves to the directory of this file at runtime in Bun,
    // avoiding brittle relative paths tied to the process working directory.
    const templatePath = path.join(import.meta.dir, 'html', `${templateName}.html`);
    const source = await Bun.file(templatePath).text();
    compiled = Handlebars.compile(source);
    compiledCache.set(templateName, compiled);
  }

  return compiled(data);
}
