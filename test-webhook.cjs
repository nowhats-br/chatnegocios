#!/usr/bin/env node

// Script para testar a configuração do webhook
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
const USER_ID = process.env.USER_ID || 'test-user-id';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'nowhats';

async function testWebhookConfig() {
  console.log('🔧 Testando configuração do webhook...\n');
  
  try {
    // 1. Testar ping
    console.log('1. Testando comunicação básica...');
    const pingResponse = await fetch(`${BACKEND_URL}/api/test/ping`);
    const pingData = await pingResponse.json();
    console.log('✅ Ping:', pingData.message);
    
    // 2. Testar configuração
    console.log('\n2. Verificando configuração...');
    const configResponse = await fetch(`${BACKEND_URL}/api/debug/webhook-config`);
    const configData = await configResponse.json();
    console.log('📋 Configuração:');
    console.log('  - Evolution API URL:', configData.evolutionApiUrl);
    console.log('  - Evolution API Key:', configData.evolutionApiKey);
    console.log('  - Supabase:', configData.supabaseAvailable ? 'OK' : 'ERRO');
    console.log('  - Usuários conectados:', configData.connectedUsers);
    
    // 3. Testar Evolution API
    console.log('\n3. Testando Evolution API...');
    const evolutionResponse = await fetch(`${BACKEND_URL}/api/debug/test-evolution`);
    const evolutionData = await evolutionResponse.json();
    if (evolutionData.success) {
      console.log('✅ Evolution API:', evolutionData.message);
    } else {
      console.log('❌ Evolution API:', evolutionData.error);
      return;
    }
    
    // 4. Testar configuração do webhook
    console.log('\n4. Configurando webhook...');
    const webhookResponse = await fetch(`${BACKEND_URL}/api/whatsapp/setup-webhook/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_ID,
      },
      body: JSON.stringify({ userId: USER_ID })
    });
    
    if (webhookResponse.ok) {
      const webhookData = await webhookResponse.json();
      console.log('✅ Webhook configurado com sucesso!');
      console.log('  - URL:', webhookData.webhookUrl);
      console.log('  - Instância:', webhookData.instanceName);
    } else {
      const error = await webhookResponse.json();
      console.log('❌ Erro ao configurar webhook:');
      console.log('  - Status:', webhookResponse.status);
      console.log('  - Erro:', error.error);
      console.log('  - Detalhes:', error.details);
    }
    
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
  }
}

// Executar teste
testWebhookConfig();