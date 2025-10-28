#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Diagnóstico e Correção Automática do WebSocket\n');

// Função para verificar arquivo .env
function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  console.log('1. Verificando arquivo .env...');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ Arquivo .env não encontrado');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = ['PORT'];
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!envContent.includes(`${varName}=`)) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.log(`❌ Variáveis faltando no .env: ${missingVars.join(', ')}`);
    return false;
  }
  
  console.log('✅ Arquivo .env OK');
  return true;
}

// Função para verificar dependências
function checkDependencies() {
  console.log('2. Verificando dependências...');
  
  if (!fs.existsSync('node_modules')) {
    console.log('❌ node_modules não encontrado');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['socket.io', 'socket.io-client', 'express', 'cors'];
  const missingDeps = [];
  
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      missingDeps.push(dep);
    }
  });
  
  if (missingDeps.length > 0) {
    console.log(`❌ Dependências faltando: ${missingDeps.join(', ')}`);
    return false;
  }
  
  console.log('✅ Dependências OK');
  return true;
}

// Função para verificar arquivos do servidor
function checkServerFiles() {
  console.log('3. Verificando arquivos do servidor...');
  
  const requiredFiles = [
    'server/websocket-server.cjs',
    'src/hooks/useWebSocket.ts',
    'src/pages/Atendimentos.tsx'
  ];
  
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.log(`❌ Arquivos faltando: ${missingFiles.join(', ')}`);
    return false;
  }
  
  console.log('✅ Arquivos do servidor OK');
  return true;
}

// Função para testar conexão
async function testConnection() {
  console.log('4. Testando conexão...');
  
  try {
    const port = process.env.PORT || 3002;
    const response = await fetch(`http://localhost:${port}/api/test/ping`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Servidor respondendo:', data.message);
      return true;
    } else {
      console.log('❌ Servidor não está respondendo corretamente');
      return false;
    }
  } catch (error) {
    console.log('❌ Não foi possível conectar ao servidor');
    return false;
  }
}

// Função para corrigir problemas
function fixProblems() {
  console.log('\n🔨 Aplicando correções...\n');
  
  // Corrigir .env
  if (!checkEnvFile()) {
    console.log('🔧 Criando arquivo .env...');
    const envContent = `# Server Configuration
PORT=3002

# Evolution API Configuration (CONFIGURE SUAS CREDENCIAIS AQUI!)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Supabase Configuration (CONFIGURE SUAS CREDENCIAIS AQUI!)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# CORS Configuration
CORS_ALLOW_ALL=true
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# Frontend Configuration
VITE_BACKEND_URL=http://localhost:3002
`;
    fs.writeFileSync('.env', envContent);
    console.log('✅ Arquivo .env criado');
  }
  
  // Verificar package.json scripts
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  let updated = false;
  
  if (!packageJson.scripts['start:webhook']) {
    packageJson.scripts['start:webhook'] = 'node server/websocket-server.cjs';
    updated = true;
  }
  
  if (!packageJson.scripts['setup:webhook']) {
    packageJson.scripts['setup:webhook'] = 'node setup-webhook.cjs';
    updated = true;
  }
  
  if (!packageJson.scripts['fix:webhook']) {
    packageJson.scripts['fix:webhook'] = 'node fix-webhook.cjs';
    updated = true;
  }
  
  if (updated) {
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log('✅ Scripts do package.json atualizados');
  }
}

// Função principal
async function diagnose() {
  console.log('🔍 Iniciando diagnóstico...\n');
  
  const checks = [
    checkEnvFile(),
    checkDependencies(),
    checkServerFiles()
  ];
  
  const allOk = checks.every(check => check);
  
  if (!allOk) {
    fixProblems();
    console.log('\n✅ Correções aplicadas!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Configure suas credenciais no arquivo .env');
    console.log('2. Execute: npm run setup:webhook');
    console.log('3. Acesse: http://localhost:5173');
  } else {
    console.log('\n✅ Tudo está configurado corretamente!');
    console.log('\n📋 Para iniciar o sistema:');
    console.log('1. Execute: npm run setup:webhook');
    console.log('2. Acesse: http://localhost:5173');
  }
  
  console.log('\n⚠️  IMPORTANTE:');
  console.log('- Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no .env');
  console.log('- Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env');
}

// Executar diagnóstico
diagnose();