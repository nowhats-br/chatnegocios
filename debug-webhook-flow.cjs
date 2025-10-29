#!/usr/bin/env node

require('dotenv').config();

async function debugWebhookFlow() {
  console.log('🔍 DIAGNÓSTICO COMPLETO DO FLUXO DE MENSAGENS\n');
  
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3002';
  
  try {
    // 1. Testar comunicação básica
    console.log('1️⃣ Testando comunicação com o servidor...');
    const pingResponse = await fetch(`${backendUrl}/api/test/ping`);
    if (pingResponse.ok) {
      const pingData = await pingResponse.json();
      console.log('✅ Servidor respondendo:', pingData.message);
    } else {
      console.log('❌ Servidor não responde');
      return;
    }
    
    // 2. Verificar configuração do webhook
    console.log('\n2️⃣ Verificando configuração do webhook...');
    const configResponse = await fetch(`${backendUrl}/api/debug/webhook-config`);
    const configData = await configResponse.json();
    console.log('📋 Configuração atual:');
    console.log(`   - Evolution API URL: ${configData.evolutionApiUrl}`);
    console.log(`   - Evolution API Key: ${configData.evolutionApiKey}`);
    console.log(`   - Supabase: ${configData.supabaseAvailable ? 'Disponível' : 'Indisponível'}`);
    console.log(`   - Usuários conectados via WebSocket: ${configData.connectedUsers}`);
    console.log(`   - Webhook Base URL: ${configData.webhookBaseUrl}`);
    
    // 3. Testar Evolution API
    console.log('\n3️⃣ Testando conexão com Evolution API...');
    const evolutionResponse = await fetch(`${backendUrl}/api/debug/test-evolution`);
    const evolutionData = await evolutionResponse.json();
    
    if (evolutionData.success) {
      console.log('✅ Evolution API conectada com sucesso');
      console.log(`   - Instâncias encontradas: ${evolutionData.data?.length || 0}`);
      
      if (evolutionData.data && evolutionData.data.length > 0) {
        console.log('📱 Instâncias ativas:');
        evolutionData.data.forEach((instance, index) => {
          console.log(`   ${index + 1}. ${instance.instanceName} - Status: ${instance.status}`);
        });
      }
    } else {
      console.log('❌ Erro na Evolution API:', evolutionData.error);
      return;
    }
    
    // 4. Testar webhook manualmente
    console.log('\n4️⃣ Testando webhook manualmente...');
    const testWebhookPayload = {
      instance: 'test_instance',
      event: 'messages.upsert',
      data: {
        messages: [{
          key: {
            id: 'test_message_' + Date.now(),
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false
          },
          message: {
            conversation: 'Mensagem de teste para verificar webhook'
          },
          pushName: 'Teste Webhook',
          messageTimestamp: Math.floor(Date.now() / 1000)
        }]
      }
    };
    
    const webhookResponse = await fetch(`${backendUrl}/api/whatsapp/webhook?uid=test_user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test_user'
      },
      body: JSON.stringify(testWebhookPayload)
    });
    
    if (webhookResponse.ok) {
      const webhookResult = await webhookResponse.json();
      console.log('✅ Webhook processou teste com sucesso:', webhookResult);
    } else {
      console.log('❌ Erro no webhook:', webhookResponse.status, webhookResponse.statusText);
      const errorText = await webhookResponse.text();
      console.log('   Detalhes:', errorText);
    }
    
    // 5. Verificar logs do servidor
    console.log('\n5️⃣ INSTRUÇÕES PARA VERIFICAR LOGS:');
    console.log('Para verificar se as mensagens estão chegando:');
    console.log('1. Abra o terminal do servidor');
    console.log('2. Execute: node server/websocket-server.cjs');
    console.log('3. Envie uma mensagem para o WhatsApp conectado');
    console.log('4. Observe os logs que devem aparecer:');
    console.log('   - [Webhook] Evento recebido: messages.upsert');
    console.log('   - [Webhook] Processando X mensagens');
    console.log('   - [Webhook] ✅ Mensagem processada com sucesso');
    console.log('   - [WebSocket] ✅ Notificação WebSocket enviada');
    
    console.log('\n6️⃣ POSSÍVEIS PROBLEMAS:');
    console.log('❓ Se as mensagens não chegam, verifique:');
    console.log('   1. Webhook está configurado na Evolution API?');
    console.log('   2. URL do webhook está acessível?');
    console.log('   3. Supabase está funcionando?');
    console.log('   4. WebSocket está conectado?');
    console.log('   5. User ID está sendo passado corretamente?');
    
    console.log('\n7️⃣ COMANDOS PARA TESTAR:');
    console.log('Execute estes comandos para testar cada parte:');
    console.log(`   curl -X GET "${backendUrl}/api/test/ping"`);
    console.log(`   curl -X GET "${backendUrl}/api/debug/webhook-config"`);
    console.log(`   curl -X GET "${backendUrl}/api/debug/test-evolution"`);
    
  } catch (error) {
    console.error('❌ Erro durante diagnóstico:', error.message);
  }
}

debugWebhookFlow();