#!/usr/bin/env node

require('dotenv').config();

async function testMessageWebhook() {
  console.log('📨 TESTE DE MENSAGEM VIA WEBHOOK\n');
  
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3002';
  
  // Simular uma mensagem real do WhatsApp
  const realMessagePayload = {
    instance: 'vendas_01', // Substitua pelo nome da sua instância
    event: 'messages.upsert',
    data: {
      messages: [{
        key: {
          id: 'test_msg_' + Date.now(),
          remoteJid: '5511987654321@s.whatsapp.net', // Número de teste
          fromMe: false
        },
        message: {
          conversation: 'Olá! Esta é uma mensagem de teste para verificar se o sistema está funcionando.'
        },
        pushName: 'Cliente Teste',
        messageTimestamp: Math.floor(Date.now() / 1000)
      }]
    }
  };
  
  console.log('📤 Enviando mensagem de teste para o webhook...');
  console.log('Payload:', JSON.stringify(realMessagePayload, null, 2));
  
  try {
    const response = await fetch(`${backendUrl}/api/whatsapp/webhook?uid=YOUR_USER_ID`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'YOUR_USER_ID' // Substitua pelo seu user ID real
      },
      body: JSON.stringify(realMessagePayload)
    });
    
    console.log(`\n📥 Resposta do webhook: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Webhook processou com sucesso:', result);
      
      console.log('\n🎯 PRÓXIMOS PASSOS:');
      console.log('1. Verifique se a mensagem apareceu na tela de atendimentos');
      console.log('2. Verifique se o WebSocket notificou o frontend');
      console.log('3. Verifique se o ticket foi criado no banco de dados');
      
    } else {
      const errorText = await response.text();
      console.log('❌ Erro no webhook:', errorText);
      
      console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
      console.log('1. Verifique se o servidor está rodando');
      console.log('2. Verifique se o Supabase está configurado');
      console.log('3. Substitua YOUR_USER_ID pelo seu ID real');
      console.log('4. Verifique se a instância existe no banco');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error.message);
    
    console.log('\n🔧 VERIFICAÇÕES:');
    console.log('1. Servidor está rodando na porta correta?');
    console.log('2. URL do backend está correta?');
    console.log('3. Firewall não está bloqueando?');
  }
  
  console.log('\n📝 INSTRUÇÕES PARA USO REAL:');
  console.log('1. Substitua "vendas_01" pelo nome da sua instância real');
  console.log('2. Substitua "YOUR_USER_ID" pelo seu ID de usuário real');
  console.log('3. Execute: node test-message-webhook.cjs');
  console.log('4. Verifique se a mensagem aparece na tela de atendimentos');
}

testMessageWebhook();