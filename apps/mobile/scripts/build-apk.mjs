// Gera o APK de release do app (build local com Gradle) e copia para dist/ na raiz do repositório.
import { spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(mobile, '..', '..');
const isWindows = process.platform === 'win32';

const JDK_PADRAO = 'C:/Program Files/Android/Android Studio/jbr';
const SDK_PADRAO = 'C:/Android/Sdk';

function falhar(mensagem) {
  console.error(`Erro: ${mensagem}`);
  process.exit(1);
}

/** Lê o "release" do arquivo `release` do JDK; devolve a versão principal (ex.: 17) ou null. */
function versaoDoJdk(home) {
  const arquivo = join(home, 'release');
  if (!existsSync(arquivo)) return null;
  const linha = readFileSync(arquivo, 'utf8').match(/JAVA_VERSION="?(\d+)(?:\.(\d+))?/);
  if (!linha) return null;
  return linha[1] === '1' ? Number(linha[2]) : Number(linha[1]);
}

function escolherJdk() {
  const doSistema = process.env.JAVA_HOME;
  if (doSistema && versaoDoJdk(doSistema) === 17) return doSistema;
  if (versaoDoJdk(JDK_PADRAO) === 17) {
    if (doSistema) {
      console.warn(`Aviso: JAVA_HOME (${doSistema}) não é o JDK 17; usando o do Android Studio.`);
    }
    return JDK_PADRAO;
  }
  return falhar(
    'JDK 17 não encontrado. Instale o Android Studio (ele traz o JDK 17) ou aponte JAVA_HOME para um JDK 17.',
  );
}

function escolherSdk() {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, SDK_PADRAO].find(
    (caminho) => caminho && existsSync(join(caminho, 'platforms')),
  );
  return sdk ?? falhar(`Android SDK não encontrado. Instale-o em ${SDK_PADRAO} ou defina ANDROID_HOME.`);
}

function executar(comando, args, opcoes) {
  const resultado = spawnSync(comando, args, { stdio: 'inherit', shell: isWindows, ...opcoes });
  if (resultado.status !== 0) falhar(`o comando "${comando} ${args.join(' ')}" falhou.`);
}

const { version } = JSON.parse(readFileSync(join(mobile, 'app.json'), 'utf8')).expo;
const javaHome = escolherJdk();
const androidHome = escolherSdk();
const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome };

if (isWindows) {
  // O JDK 17 falha com "Unable to establish loopback connection" no Gradle quando a pasta temporária
  // tem espaço no caminho (ex.: o nome do usuário). Um diretório sem espaço resolve.
  const semEspaco = join(process.env.SystemRoot ?? 'C:/Windows', 'Temp');
  const opcao = `-Djdk.net.unixdomain.tmpdir=${semEspaco}`;
  env.JAVA_TOOL_OPTIONS = [process.env.JAVA_TOOL_OPTIONS, opcao].filter(Boolean).join(' ');
}

console.log(`Usando JDK 17 em ${javaHome}.`);
console.log(`Usando Android SDK em ${androidHome}.`);
if (process.env.EXPO_PUBLIC_API_URL) {
  console.log(`Endereço padrão da API no app: ${process.env.EXPO_PUBLIC_API_URL}`);
}

// No Windows, o ninja que vem com o CMake do Android SDK (1.10) não aceita caminhos com mais de 260
// caracteres, e o build do React Native gera caminhos assim em monorepos. Se CMAKE_DIR apontar para um
// CMake mais novo (com ninja 1.12 ou superior ao lado, em bin/), o Gradle passa a usá-lo.
const cmakeDir = process.env.CMAKE_DIR;
if (cmakeDir && !existsSync(join(cmakeDir, 'bin', 'cmake.exe'))) {
  falhar(`CMAKE_DIR (${cmakeDir}) não contém bin/cmake.exe.`);
}

console.log('Gerando o projeto Android (expo prebuild)...');
executar('npx', ['expo', 'prebuild', '--platform', 'android', '--clean'], { cwd: mobile, env });

if (cmakeDir) {
  // o prebuild --clean recria a pasta android, então a configuração entra depois dele
  appendFileSync(
    join(mobile, 'android', 'local.properties'),
    `cmake.dir=${cmakeDir.replaceAll('\\', '/')}\n`,
  );
  console.log(`Gradle vai usar o CMake de ${cmakeDir}.`);
}

console.log('Compilando o APK de release (Gradle). A primeira vez pode levar vários minutos...');
// com shell no Windows, o caminho precisa ser absoluto e entre aspas (o diretório do usuário tem espaço)
const gradlewPath = join(mobile, 'android', isWindows ? 'gradlew.bat' : 'gradlew');
const gradlew = isWindows ? `"${gradlewPath}"` : gradlewPath;
// arm64-v8a para celulares reais e x86_64 para o emulador; deixa o build bem mais rápido
executar(gradlew, ['assembleRelease', '-PreactNativeArchitectures=arm64-v8a,x86_64'], {
  cwd: join(mobile, 'android'),
  env,
});

const apk = join(mobile, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(apk)) falhar(`o APK não foi gerado em ${apk}.`);

const destino = join(repo, 'dist', `nivela-${version}.apk`);
mkdirSync(dirname(destino), { recursive: true });
copyFileSync(apk, destino);
console.log(`APK gerado em ${destino}.`);
