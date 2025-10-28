#!/usr/bin/env node

const fs = require('fs');

console.log('🔧 Corrigindo problema de CORS...\n');

// Corrigir arquivo .env
const envPath = '.env';
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  console.log('📝 Criando arquivo .env...');
}

// Garantir que CORS_ALLOW_ALL=true está definido
if (!envContent.includes('CORS_ALLOW_ALL=')) {
  envContent += '\n# CORS Configuration\nCORS_ALLOW_ALL=true\n';
} else {
  envContent = envContent.replace(/CORS_ALLOW_ALL=false/g, 'CORS_ALLOW_ALL=true');
}

// Garantir que a porta está definida
if (!envContent.includes('PORT=')) {
  envContent += 'PORT=3002\n';
}

fs.writeFileSync(envPath, envContent);
console.log('✅ Arquivo .env corrigido');

console.log('\n🚀 Problema de CORS corrigido!');
console.log('\n📋 Próximos passos:');
console.log('1. Pare o servidor atual (Ctrl+C)');
console.log('2. Execute: npm run setup:webhook');
console.log('3. O servidor vai iniciar sem erros de CORS');

console.log('\n✅ Agora o sistema deve funcionar perfeitamente!');