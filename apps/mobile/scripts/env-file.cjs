// Leitura de variáveis de um arquivo .env (usada pelo build do APK).
// É .cjs para o jest (que não transforma .mjs) e o build (.mjs) importarem o mesmo código.

/**
 * Devolve o valor de `nome` no texto de um .env, ou `undefined` se não houver (ou estiver vazio).
 * `nome` deve ser um identificador simples (letras, números e `_`).
 * Aceita o prefixo `export `, valores entre aspas e comentário ` # ...` em valores sem aspas.
 * Só espaços e tabs separam o nome do valor: um valor vazio nunca captura a linha seguinte.
 */
function lerVariavelDoEnv(texto, nome) {
  const linha = texto.match(new RegExp(`^[ \\t]*(?:export[ \\t]+)?${nome}[ \\t]*=[ \\t]*([^\\r\\n]*)`, 'm'));
  if (!linha) return undefined;
  const bruto = linha[1].trim();
  const aspas = bruto.match(/^(["'])(.*?)\1(?:[ \t]+#.*)?$/);
  const valor = aspas ? aspas[2] : bruto.replace(/(^|[ \t])#.*$/, '');
  return valor.trim() || undefined;
}

module.exports = { lerVariavelDoEnv };
