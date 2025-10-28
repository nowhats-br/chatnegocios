#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Configuração Automática do Sistema WebSocket\n');

// Função para executar comandos
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'inherit', 
      shell: true,
      ...options 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Comando falhou com código ${code}`));
      }
    });
  });
}

// Função para verificar se uma porta está livre
function isPortFree(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    
    server.on('error', () => resolve(false));
  });
}

// Função para encontrar uma porta livre
async function findFreePort(startPort = 3002) {
  for (let port = startPort; port < startPort + 10; port++) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error('Nenhuma porta livre encontrada');
}

// Função para criar arquivo .env se não existir
function createEnvFile(port) {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    const envContent = `# Server Configuration
PORT=${port}

# Evolution API Configuration
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Supabase Configuration  
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# CORS Configuration
CORS_ALLOW_ALL=true
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# Frontend Configuration
VITE_BACKEND_URL=http://localhost:${port}
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Arquivo .env criado com porta ${port}`);
  } else {
    console.log('✅ Arquivo .env já existe');
  }
}

// Função para atualizar vite.config.ts
function updateViteConfig(port) {
  const viteConfigPath = path.join(__dirname, 'vite.config.ts');
  
  if (fs.existsSync(viteConfigPath)) {
    let content = fs.readFileSync(viteConfigPath, 'utf8');
    
    // Adicionar proxy se não existir
    if (!content.includes('proxy')) {
      const proxyConfig = `
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:${port}',
        changeOrigin: true,
      },
    },
  },`;
      
      content = content.replace(
        'export default defineConfig({',
        `export default defineConfig({${proxyConfig}`
      );
      
      fs.writeFileSync(viteConfigPath, content);
      console.log(`✅ Vite config atualizado com proxy para porta ${port}`);
    }
  }
}

// Função principal
async function setup() {
  try {
    console.log('1. Verificando dependências...');
    
    // Verificar se node_modules existe
    if (!fs.existsSync('node_modules')) {
      console.log('📦 Instalando dependências...');
      await runCommand('npm', ['install']);
    } else {
      console.log('✅ Dependências já instaladas');
    }
    
    console.log('\n2. Configurando porta...');
    const port = await findFreePort(3002);
    console.log(`✅ Porta livre encontrada: ${port}`);
    
    console.log('\n3. Criando arquivos de configuração...');
    createEnvFile(port);
    updateViteConfig(port);
    
    console.log('\n4. Iniciando servidor...');
    console.log(`🚀 Iniciando servidor WebSocket na porta ${port}...`);
    console.log('📱 Acesse: http://localhost:5173 (frontend)');
    console.log(`🔧 API: http://localhost:${port} (backend)`);
    console.log('\n⚠️  IMPORTANTE: Configure suas credenciais no arquivo .env antes de usar!\n');
    
    // Definir variável de ambiente para o processo atual
    process.env.PORT = port.toString();
    
    // Iniciar servidor
    await runCommand('node', ['server/websocket-server.cjs']);
    
  } catch (error) {
    console.error('❌ Erro durante a configuração:', error.message);
    process.exit(1);
  }
}

// Executar setup
setup();