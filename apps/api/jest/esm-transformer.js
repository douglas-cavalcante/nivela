// Converte para CommonJS os pacotes @nestjs/* de node_modules, que são
// distribuídos só como ESM, para o Jest (CommonJS) conseguir carregá-los no
// Node 22. Padrão adaptado do backend de referência (Estagius).
const crypto = require('crypto');
const ts = require('typescript');

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  esModuleInterop: true,
  allowJs: true,
  sourceMap: false,
};

// Recursos que só existem em ESM, trocados pelos equivalentes do CommonJS
function adaptEsmOnlySyntax(source) {
  return (
    source
      // `const require = createRequire(import.meta.url)`: em CommonJS o
      // require já existe (e redeclará-lo é erro de sintaxe)
      .replace(
        /\b(const|let|var)\s+require\s*=\s*(?:\w+\.)?createRequire\([^)]*\);?/g,
        '',
      )
      .replace(
        /\bimport\.meta\.url\b/g,
        "require('url').pathToFileURL(__filename).href",
      )
      .replace(/\bimport\.meta\.dirname\b/g, '__dirname')
      .replace(/\bimport\.meta\.filename\b/g, '__filename')
  );
}

module.exports = {
  process(rawSource, filename) {
    const { outputText } = ts.transpileModule(adaptEsmOnlySyntax(rawSource), {
      compilerOptions,
      fileName: filename,
    });
    return { code: outputText };
  },
  getCacheKey(source, filename) {
    return crypto
      .createHash('sha1')
      .update(source)
      .update(filename)
      .update(ts.version)
      .update('esm-transformer-v1')
      .digest('hex');
  },
};
