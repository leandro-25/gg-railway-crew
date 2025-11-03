require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do CORS
const allowedOrigins = [
  'http://localhost:8100',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:5173',
  'ionic://localhost',
  'http://localhost:4200'
];

app.use(cors({
  origin: function(origin, callback) {
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      return callback(null, true);
    }

    // Em produção, permitir todas as origens (ajuste conforme necessário)
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Adiciona headers CORS manualmente
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, Expires');
  next();
});
app.use(express.json());

// Verificar variáveis de ambiente obrigatórias
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error('SUPABASE_URL e SUPABASE_KEY são variáveis de ambiente obrigatórias');
}

// Conexão com Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Rotas de Autenticação
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validação básica
    if (!email || !password) {
      return res.status(400).json({
        code: 'MISSING_CREDENTIALS',
        message: 'Por favor, preencha todos os campos.'
      });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password
    });

    if (error) {
      // Sempre retorna a mensagem em português para credenciais inválidas
      const errorMessage = 'E-mail ou senha incorretos';
      
      return res.status(400).json({
        code: error.code || 'AUTH_ERROR',
        message: errorMessage,
        originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.json({
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro inesperado. Por favor, tente novamente.'
    });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { nome, email, password } = req.body;

    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: { data: { nome: nome.trim() } }
    });

    if (authError) throw authError;

    // Criar perfil na tabela usuarios
    const { data: userData, error: dbError } = await supabase
      .from('usuarios')
      .insert([{
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        user_id: authData.user.id
      }])
      .select();

    if (dbError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    res.json({
      user: {
        ...authData.user,
        profile: userData[0]
      }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(400).json({
      code: error.code || 'DATABASE_ERROR',
      message: error.message
    });
  }
});

// Rotas Protegidas

// Buscar dados do usuário
app.get('/api/usuarios', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });

    const { data: usuario, error: dbError } = await supabase
      .from('usuarios')
      .select('id, nome, email, saldo')
      .eq('user_id', user.id)
      .single();

    if (dbError) throw dbError;
    res.json(usuario);

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Buscar transações (GET)
app.get('/api/transacoes', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });

    // Buscar ID do usuário na tabela "usuarios"
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (userError) throw userError;

    // Buscar transações
    const { data: transacoes, error: transError } = await supabase
      .from('transacoes')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('data', { ascending: false });

    if (transError) throw transError;

    res.json(transacoes);

  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Registrar transação (POST)
app.post('/api/transacoes', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });

    const { valor, tipo, descricao } = req.body;
    const { data: transacao, error: transError } = await supabase.rpc('executar_transacao', {
      user_id: user.id,
      valor_transacao: valor,
      tipo_transacao: tipo,
      descricao_transacao: descricao || 'Operação financeira'
    });

    if (transError) throw transError;
    res.json(transacao);

  } catch (error) {
    console.error('Erro na transação:', error);
    res.status(500).json({ error: 'Erro ao processar transação' });
  }
});

// Buscar estratégias
app.get('/api/estrategias', async (req, res) => {
  try {
    // Primeiro, busca as estratégias com os ativos relacionados
    const { data: estrategias, error: estrategiasError } = await supabase
      .from('estrategias')
      .select(`
        *,
        ativos:ranking_ativos (
          id,
          codigo_ativo,
          posicao,
          rentabilidade
        )
      `)
      .order('nome', { ascending: false });

    if (estrategiasError) throw estrategiasError;
    
    // Mapeia as estratégias para incluir a contagem de ativos
    const estrategiasComContagem = estrategias.map(estrategia => ({
      ...estrategia,
      total_ativos: estrategia.ativos?.length || 0
    }));

    res.json(estrategiasComContagem);
    
  } catch (error) {
    console.error('Erro ao buscar estratégias:', error);
    res.status(500).json({ error: 'Erro ao carregar estratégias' });
  }
});

// Buscar ativos da estratégia
app.get('/api/estrategias/:id/ativos', async (req, res) => {
  try {
    const estrategiaId = req.params.id;

    const { data, error } = await supabase
      .from('ranking_ativos')
      .select(`
        id,
        estrategia_id,
        codigo_ativo,
        posicao,
        rentabilidade,
        ativos:codigo_ativo (
          codigo,
          nome,
          tipo,
          preco_atual
        )
      `)
      .eq('estrategia_id', estrategiaId)
      .order('posicao', { ascending: true });

    if (error) throw error;
    
    res.json(data);

  } catch (error) {
    console.error('Erro ao buscar ativos da estratégia:', error);
    res.status(500).json({ error: 'Erro ao carregar ativos da estratégia' });
  }
});

// Registrar compra na carteira (POST)
// Rota para verificar a estrutura da tabela transacoes
app.get('/api/check-table-structure', async (req, res) => {
  try {
    // Primeiro, vamos tentar obter a estrutura da tabela
    console.log('Obtendo estrutura da tabela transacoes...');
    
    // Tenta obter as colunas da tabela usando uma consulta SQL direta
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'transacoes');
    
    if (columnsError) {
      console.error('Erro ao obter colunas da tabela:', columnsError);
      return res.status(500).json({ 
        error: 'Erro ao obter estrutura da tabela',
        details: columnsError 
      });
    }
    
    console.log('Estrutura da tabela transacoes:', columns);
    
    // Se a tabela estiver vazia, tenta inserir um registro de teste
    const { count, error: countError } = await supabase
      .from('transacoes')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Erro ao contar registros na tabela transacoes:', countError);
    } else {
      console.log(`Total de registros na tabela transacoes: ${count}`);
    }
    
    // Tenta inserir um registro de teste
    const testData = {
      usuario_id: 1, // ID de teste
      tipo: 'teste',
      valor: 100,
      descricao: 'Teste de estrutura',
      data: new Date().toISOString()
    };
    
    // Adiciona campos opcionais se existirem na tabela
    const columnNames = columns.map(col => col.column_name);
    if (columnNames.includes('codigo_ativo')) testData.codigo_ativo = 'TEST11';
    if (columnNames.includes('quantidade')) testData.quantidade = 10;
    if (columnNames.includes('valor_unitario')) testData.valor_unitario = 10;
    if (columnNames.includes('valor_total')) testData.valor_total = 100;
    
    console.log('Tentando inserir dados de teste na tabela transacoes:', testData);
    
    const { data, error: insertError } = await supabase
      .from('transacoes')
      .insert([testData])
      .select();
    
    if (insertError) {
      console.error('Erro ao inserir teste na tabela transacoes:', insertError);
      return res.status(400).json({ 
        error: 'Erro ao inserir teste', 
        details: insertError,
        tableStructure: columns
      });
    }
    
    console.log('Dados de teste inseridos com sucesso:', data);
    
    // Remove o registro de teste
    if (data && data[0]?.id) {
      await supabase
        .from('transacoes')
        .delete()
        .eq('id', data[0].id);
    }
    
    res.json({ 
      success: true, 
      message: 'Estrutura da tabela está correta',
      testData: data,
      tableStructure: columns
    });
    
  } catch (error) {
    console.error('Erro ao verificar estrutura da tabela:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar estrutura da tabela',
      details: error.message 
    });
  }
  try {
    // Tenta inserir um registro de teste para verificar a estrutura
    const testData = {
      usuario_id: 1, // ID de teste
      tipo: 'teste',
      valor: 100,
      descricao: 'Teste de estrutura',
      data: new Date().toISOString(),
      codigo_ativo: 'TEST11',
      quantidade: 10,
      valor_unitario: 10,
      valor_total: 100
    };
    
    console.log('Tentando inserir dados de teste na tabela transacoes:', testData);
    
    const { data, error } = await supabase
      .from('transacoes')
      .insert([testData])
      .select();
    
    if (error) {
      console.error('Erro ao inserir teste na tabela transacoes:', error);
      return res.status(400).json({ 
        error: 'Erro ao inserir teste', 
        details: error 
      });
    }
    
    console.log('Dados de teste inseridos com sucesso:', data);
    
    // Remove o registro de teste
    if (data && data[0]?.id) {
      await supabase
        .from('transacoes')
        .delete()
        .eq('id', data[0].id);
    }
    
    res.json({ 
      success: true, 
      message: 'Estrutura da tabela está correta',
      testData: data 
    });
    
  } catch (error) {
    console.error('Erro ao verificar estrutura da tabela:', error);
    res.status(500).json({ 
      error: 'Erro ao verificar estrutura da tabela',
      details: error.message 
    });
  }
});

app.post('/api/carteira', async (req, res) => {
  try {
    // Extrair os dados do corpo da requisição primeiro
    const { codigo_ativo, quantidade, valor_compra, estrategia_id } = req.body;
    
    // Validar os dados da requisição
    if (!codigo_ativo || !quantidade || typeof estrategia_id === 'undefined') {
      return res.status(400).json({ error: 'Dados inválidos: código do ativo, quantidade ou estratégia_id ausentes' });
    }
    if (isNaN(quantidade) || quantidade <= 0) {
      return res.status(400).json({ error: 'Quantidade inválida' });
    }
    if (isNaN(valor_compra) || valor_compra <= 0) {
      return res.status(400).json({ error: 'Valor de compra inválido' });
    }

    // Autenticação e obtenção do usuário
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });
    
    // Buscar o ID numérico e saldo do usuário na tabela "usuarios"
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, saldo')
      .eq('user_id', user.id)
      .single();
    if (userError) throw userError;
    
    // Verificar se o usuário tem saldo suficiente para a compra
    //const valorTotalCompra = quantidade * valor_compra;
    //if (parseFloat(usuario.saldo) < valorTotalCompra) {
      //return res.status(400).json({ error: 'Saldo insuficiente para realizar a compra' });
    //}
   // if (!codigo_ativo || !quantidade || typeof estrategia_id === 'undefined') {
    //  return res.status(400).json({ error: 'Dados inválidos: código do ativo, quantidade ou estratégia_id ausentes' });
    //}
    //if (isNaN(quantidade) || quantidade <= 0) throw new Error('Quantidade inválida');
    //if (isNaN(valor_compra) || valor_compra <= 0) throw new Error('Valor inválido');

    const valorTotalCompra = quantidade * valor_compra;
    const limiteCredito = -1000; // Defina um limite de crédito (ex: R$ 1000,00)
    const novoSaldo = parseFloat(usuario.saldo) - valorTotalCompra;
    
    if (novoSaldo < limiteCredito) {
      return res.status(400).json({ 
        error: `Limite de crédito excedido. Seu limite é de R$ ${Math.abs(limiteCredito).toFixed(2)}` 
      });
    }


    // Verificar se já existe um registro para esse ativo e estratégia
    const { data: registro, error: registroError } = await supabase
      .from('carteira_investimentos')
      .select('id, quantidade, valor_compra')
      .eq('usuario_id', usuario.id)
      .eq('codigo_ativo', codigo_ativo)
      .eq('estrategia_id', estrategia_id)
      .single();

    if (registroError) {
      console.log('Inserindo novo registro na carteira...');
      // Se não encontrar registro, insere um novo
      const { data: novaCompra, error: insertError } = await supabase
        .from('carteira_investimentos')
        .insert([{
          usuario_id: usuario.id,
          codigo_ativo,
          quantidade,
          valor_compra,
          estrategia_id,
          data_compra: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      // Registrar a transação de compra
      const valorTotalCompra = quantidade * valor_compra;
      
      // Atualizar o saldo do usuário
      const novoSaldo = parseFloat(usuario.saldo) - valorTotalCompra;
      const { error: updateSaldoError } = await supabase
        .from('usuarios')
        .update({ saldo: novoSaldo })
        .eq('id', usuario.id);
        
      if (updateSaldoError) {
        console.error('Erro ao atualizar saldo do usuário:', updateSaldoError);
        throw new Error('Erro ao atualizar saldo do usuário');
      }
      
      // Registrar a transação
      const { error: transacaoError } = await supabase
        .from('transacoes')
        .insert([{
          usuario_id: usuario.id,
          tipo: 'compra',
          valor: -Math.abs(valorTotalCompra),
          descricao: `Compra de ${quantidade} cotas de ${codigo_ativo}`,
          data: new Date().toISOString(),
          codigo_ativo,
          quantidade,
          valor_unitario: valor_compra,
          valor_total: valorTotalCompra
        }]);
        
      if (transacaoError) {
        console.error('Erro ao registrar transação de compra:', transacaoError);
        // Não interrompemos o fluxo se falhar o registro da transação
      }
      
      return res.json({ 
        message: 'Compra registrada com sucesso', 
        data: { 
          ...novaCompra,
          novo_saldo: novoSaldo 
        } 
      });
    } else {
      // Se o registro já existir, atualizar a quantidade e o valor médio ponderado
      const quantidadeAtual = parseFloat(registro.quantidade);
      const valorAtual = parseFloat(registro.valor_compra);
      const novaQuantidade = quantidadeAtual + quantidade;
      
      // Calcular o novo valor médio ponderado
      const valorTotalAtual = quantidadeAtual * valorAtual;
      const valorTotalNovaCompra = quantidade * valor_compra;
      const novoValorMedio = (valorTotalAtual + valorTotalNovaCompra) / novaQuantidade;
      
      console.log('Atualizando registro existente na carteira...');
      const { data: updateData, error: updateError } = await supabase
        .from('carteira_investimentos')
        .update({
          quantidade: novaQuantidade,
          valor_compra: novoValorMedio,
          data_compra: new Date().toISOString()
        })
        .eq('id', registro.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      
      // Atualizar o saldo do usuário
      const valorTotalCompra = quantidade * valor_compra;
      const novoSaldo = parseFloat(usuario.saldo) - valorTotalCompra;
      const { error: updateSaldoError } = await supabase
        .from('usuarios')
        .update({ saldo: novoSaldo })
        .eq('id', usuario.id);
        
      if (updateSaldoError) {
        console.error('Erro ao atualizar saldo do usuário:', updateSaldoError);
        throw new Error('Erro ao atualizar saldo do usuário');
      }
      
      // Registrar a transação de compra
      const { error: transacaoError } = await supabase
        .from('transacoes')
        .insert([{
          usuario_id: usuario.id,
          tipo: 'compra',
          valor: -Math.abs(valorTotalCompra), // Valor negativo para saída de caixa
          descricao: ` ${quantidade} cotas de ${codigo_ativo}`,
          data: new Date().toISOString(),
          codigo_ativo,
          quantidade,
          valor_unitario: valor_compra,
          valor_total: valorTotalCompra
        }]);
        
      if (transacaoError) {
        console.error('Erro ao registrar transação de compra:', transacaoError);
        // Não interrompemos o fluxo se falhar o registro da transação
      }
      
      return res.json({ 
        message: 'Compra atualizada com sucesso', 
        data: { 
          ...updateData,
          novo_saldo: novoSaldo 
        } 
      });
    }
  } catch (error) {
    console.error('Erro na compra:', error);
    res.status(500).json({ error: 'Erro ao processar compra', details: error.message });
  }
});

// Registrar venda (POST)
app.post('/api/vender', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });

    // Buscar o ID numérico e saldo do usuário na tabela "usuarios"
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, saldo')
      .eq('user_id', user.id)
      .single();
    if (userError || !usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Extrair dados do corpo da requisição
    const { codigo_ativo, quantidade, estrategia_id } = req.body;
    if (!codigo_ativo || !quantidade || typeof estrategia_id === 'undefined') {
      return res.status(400).json({ error: 'Dados inválidos: código do ativo, quantidade ou estratégia_id ausentes' });
    }
    
    // Buscar todos os registros existentes na carteira para este ativo e estratégia
    const { data: registros, error: registroError } = await supabase
      .from('carteira_investimentos')
      .select('id, quantidade')
      .eq('usuario_id', usuario.id)
      .eq('codigo_ativo', codigo_ativo)
      .eq('estrategia_id', estrategia_id);
    
    if (registroError) throw registroError;
    if (!registros || registros.length === 0) {
      return res.status(404).json({ error: 'Registro de investimento não encontrado' });
    }
    
    // Somar as quantidades de todos os registros
    const totalDisponivel = registros.reduce((acc, r) => acc + parseFloat(r.quantidade), 0);
    if (totalDisponivel < quantidade) {
      return res.status(400).json({ error: 'Quantidade insuficiente para venda' });
    }
    
    // Calcular nova quantidade agregada após a venda
    const novaQuantidade = totalDisponivel - quantidade;
    
    // Escolher o registro principal para atualização (por exemplo, o de menor id)
    registros.sort((a, b) => a.id - b.id);
    const registroPrincipal = registros[0];
    
    console.log('Processando venda...');
    // Buscar o registro completo para obter o valor médio de compra
    const { data: ativo, error: ativoError } = await supabase
      .from('carteira_investimentos')
      .select('valor_compra')
      .eq('id', registroPrincipal.id)
      .single();
      
    if (ativoError) {
      console.error('Erro ao buscar dados do ativo:', ativoError);
      throw ativoError;
    }
    
    console.log('Dados do ativo encontrado:', ativo);
    
    // Usar o preço de venda informado pelo usuário ou o preço médio como fallback
    const precoVenda = parseFloat(req.body.preco_venda) || ativo.valor_compra;
    const valorTotalVenda = quantidade * precoVenda;
    
    // Atualizar o saldo do usuário (adiciona o valor da venda)
    const novoSaldo = parseFloat(usuario.saldo) + valorTotalVenda;
    const { error: updateSaldoError } = await supabase
      .from('usuarios')
      .update({ saldo: novoSaldo })
      .eq('id', usuario.id);
      
    if (updateSaldoError) {
      console.error('Erro ao atualizar saldo do usuário:', updateSaldoError);
      throw new Error('Erro ao atualizar saldo do usuário');
    }
    
    // Atualizar o registro principal com a nova quantidade
    console.log('Atualizando quantidade na carteira...');
    let atualizado = null;
    
    if (novaQuantidade > 0) {
      const { data, error: updateError } = await supabase
        .from('carteira_investimentos')
        .update({ 
          quantidade: novaQuantidade,
          data_compra: new Date().toISOString()
        })
        .eq('id', registroPrincipal.id)
        .select()
        .single();
        
      if (updateError) throw updateError;
      atualizado = data;
    } else {
      // Se a quantidade for zero, remover o registro
      const { error: deleteError } = await supabase
        .from('carteira_investimentos')
        .delete()
        .eq('id', registroPrincipal.id);
        
      if (deleteError) throw deleteError;
    }
    
    console.log('Carteira atualizada com sucesso. Registrando transação...');
    
    // Registrar a transação de venda
    const transacaoData = {
      usuario_id: usuario.id,
      tipo: 'venda',
      valor: valorTotalVenda, // Valor positivo para entrada de caixa
      descricao: ` ${quantidade} cotas de ${codigo_ativo}`,
      data: new Date().toISOString(),
      codigo_ativo,
      quantidade: -quantidade, // Quantidade negativa para indicar saída
      valor_unitario: precoVenda,
      valor_total: valorTotalVenda
    };
    
    console.log('Dados da transação de venda:', transacaoData);
    
    const { data: transacaoInserida, error: transacaoError } = await supabase
      .from('transacoes')
      .insert([transacaoData])
      .select()
      .single();
    
    if (transacaoError) {
      console.error('Erro ao registrar transação de venda:', transacaoError);
      throw transacaoError;
    }
    
    console.log('Transação de venda registrada com sucesso:', transacaoInserida);
    
    // Se houver outros registros, excluí-los para manter apenas um registro agregado
    if (registros.length > 1) {
      const idsParaDeletar = registros.slice(1).map(r => r.id);
      const { error: deleteError } = await supabase
        .from('carteira_investimentos')
        .delete()
        .in('id', idsParaDeletar);
      if (deleteError) throw deleteError;
    }
    
    res.json({ 
      message: 'Venda realizada com sucesso', 
      data: { 
        ...(atualizado || {}),
        novo_saldo: novoSaldo 
      } 
    });
  } catch (error) {
    console.error('Erro na venda:', error);
    res.status(500).json({ error: 'Erro ao processar venda' });
  }
});

app.get('/api/carteira', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!user || error) {
      console.error('Erro de autenticação:', error?.message || 'Usuário não autenticado');
      return res.status(401).json({ error: 'Não autorizado' });
    }

    console.log('Usuário autenticado:', user.id);

    // Buscar o ID numérico do usuário na tabela "usuarios"
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', user.id)
      .single();
      
    if (userError || !usuario) {
      console.error('Usuário não encontrado na tabela usuarios:', userError?.message);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    console.log('ID do usuário na tabela usuarios:', usuario.id);

    // 1. Buscar os itens da carteira do usuário com JOIN na tabela ativos
    console.log('Buscando itens da carteira com preços atuais...');
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteira_investimentos')
      .select(`
        id,
        codigo_ativo,
        quantidade,
        valor_compra,
        estrategias (id, nome),
        ativos!inner(codigo, preco_atual)
      `)
      .eq('usuario_id', usuario.id)
      .order('codigo_ativo', { ascending: true });

    if (carteiraError) {
      console.error('Erro ao buscar carteira:', carteiraError);
      throw carteiraError;
    }

    console.log(`Encontrados ${carteira.length} itens na carteira`);
    
    if (carteira.length > 0) {
      console.log('Amostra dos itens da carteira:', carteira.slice(0, 3));
    } else {
      console.log('Nenhum item encontrado na carteira');
      return res.json([]);
    }

    // 2. Agrupar por estratégia
    console.log('Agrupando itens por estratégia...');
    const carteiraPorEstrategia = {};
    
    carteira.forEach((item, index) => {
      console.log(`\nProcessando item ${index + 1}/${carteira.length}:`);
      console.log('- Código do ativo:', item.codigo_ativo);
      console.log('- Estratégia:', item.estrategias);
      
      if (!item.estrategias) {
        console.warn('Item sem estratégia definida, pulando...');
        return;
      }
      
      const estrategiaId = item.estrategias.id;
      const estrategiaNome = item.estrategias.nome;
      
      if (!carteiraPorEstrategia[estrategiaId]) {
        console.log(`- Nova estratégia encontrada: ${estrategiaNome} (${estrategiaId})`);
        carteiraPorEstrategia[estrategiaId] = {
          id: estrategiaId,
          nome: estrategiaNome,
          total_investido: 0,
          ativos: []
        };
      }
      
      const quantidade = parseFloat(item.quantidade);
      const valorMedio = parseFloat(item.valor_compra);
      const precoAtual = item.ativos?.preco_atual || null;
      const valorTotal = quantidade * valorMedio;
      
      console.log('- Dados processados:', {
        quantidade,
        valorMedio,
        precoAtual,
        valorTotal
      });
      
      const ativo = {
        codigo: item.codigo_ativo,
        quantidade: quantidade,
        valor_medio: valorMedio,
        preco_atual: precoAtual,
        valor_total: valorTotal
      };
      
      carteiraPorEstrategia[estrategiaId].ativos.push(ativo);
      carteiraPorEstrategia[estrategiaId].total_investido += valorTotal;
      
      console.log(`- Ativo adicionado à estratégia ${estrategiaNome}`);
    });
    
    console.log('\nProcessamento concluído. Estratégias processadas:', Object.keys(carteiraPorEstrategia).length);
    
    // Calcular porcentagem de cada estratégia
    const totalGeral = Object.values(carteiraPorEstrategia)
      .reduce((total, estrategia) => total + estrategia.total_investido, 0);
      
    console.log('\nCalculando percentuais:');
    console.log('- Total geral investido:', totalGeral);
    
    const resultado = Object.values(carteiraPorEstrategia).map(estrategia => {
      const porcentagem = totalGeral > 0 ? ((estrategia.total_investido / totalGeral) * 100).toFixed(2) : 0;
      
      console.log(`- Estratégia ${estrategia.nome} (${estrategia.id}):`);
      console.log('  - Total investido:', estrategia.total_investido);
      console.log('  - Porcentagem:', porcentagem);
      
      return {
        ...estrategia,
        porcentagem: parseFloat(porcentagem)
      };
    });
    
    console.log('\nResultado final a ser enviado:', JSON.stringify(resultado, null, 2));
    res.json(resultado);
  } catch (error) {
    console.error('Erro ao carregar carteira:', error);
    res.status(500).json({ error: 'Erro ao carregar carteira', details: error.message });
  }
});

// Rota para obter o total investido pelo usuário
app.get('/api/total-investido', async (req, res) => {
  console.log('Requisição recebida em /api/total-investido');
  console.log('Headers:', req.headers);
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!user || error) return res.status(401).json({ error: 'Não autorizado' });

    // Buscar o ID numérico do usuário na tabela "usuarios"
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', user.id)
      .single();
      
    if (userError || !usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar os itens da carteira do usuário para calcular o total investido
    const { data: carteira, error: carteiraError } = await supabase
      .from('carteira_investimentos')
      .select('quantidade, valor_compra')
      .eq('usuario_id', usuario.id);

    if (carteiraError) {
      console.error('Erro ao buscar carteira:', carteiraError);
      throw carteiraError;
    }
    
    console.log('Itens da carteira encontrados:', carteira);

    // Calcular o total investido (soma de quantidade * valor_compra)
    const totalInvestido = carteira.reduce((total, item) => {
      return total + (parseFloat(item.quantidade) * parseFloat(item.valor_compra));
    }, 0);

    res.json({ total_investido: totalInvestido });
  } catch (error) {
    console.error('Erro ao calcular total investido:', error);
    res.status(500).json({ error: 'Erro ao calcular total investido' });
  }
});

// Rota para atualizar perfil do usuário
app.put('/api/profile', async (req, res) => {
  console.log('=== INÍCIO DA REQUISIÇÃO DE ATUALIZAÇÃO DE PERFIL ===');
  
  try {
    // Verificar cabeçalho de autorização
    const authHeader = req.headers.authorization;
    console.log('Cabeçalho de autorização:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Token não fornecido ou em formato incorreto');
      return res.status(401).json({ 
        success: false,
        error: 'Token de autenticação ausente ou inválido',
        code: 'MISSING_AUTH_TOKEN'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verificar autenticação do usuário
    let user;
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) throw error;
      user = data.user;
      console.log('Usuário autenticado com sucesso. ID:', user?.id);
    } catch (authError) {
      console.error('Erro na autenticação do token:', authError);
      return res.status(401).json({
        success: false,
        error: 'Falha na autenticação',
        details: authError.message,
        code: 'AUTH_ERROR'
      });
    }
    
    // Validar corpo da requisição
    if (!req.body || typeof req.body !== 'object') {
      console.error('Corpo da requisição inválido:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Corpo da requisição inválido',
        code: 'INVALID_REQUEST_BODY'
      });
    }
    
    const { nome, novaSenha } = req.body;
    console.log('Dados recebidos - Nome:', nome, '| Nova senha:', novaSenha ? '***' : 'Não fornecida');
    
    // Validar nome
    if (!nome || typeof nome !== 'string' || nome.trim() === '') {
      console.error('Nome inválido fornecido:', nome);
      return res.status(400).json({
        success: false,
        error: 'O campo nome é obrigatório e não pode estar vazio',
        code: 'INVALID_NAME'
      });
    }
    
    const nomeTratado = nome.trim();
    
    try {
      // Verificar se o perfil existe
      console.log('Verificando se o perfil existe para o usuário com user_id:', user.id);
      const { data: existingProfile, error: fetchError } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('user_id', user.id)  // Corrigido para user_id
        .single();
      
      // Se não for um erro de "nenhum registro encontrado", lançar o erro
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Erro ao verificar perfil existente:', fetchError);
        throw fetchError;
      }
      
      // Atualizar ou criar perfil
      let updateResult;
      if (existingProfile) {
        console.log('Atualizando perfil existente');
        updateResult = await supabase
          .from('usuarios')
          .update({ 
            nome: nomeTratado
          })
          .eq('user_id', user.id);  // Corrigido para user_id
      } else {
        console.log('Criando novo perfil');
        updateResult = await supabase
          .from('usuarios')
          .insert([{ 
            user_id: user.id,  // Corrigido para user_id
            nome: nomeTratado,
            email: user.email,
            saldo: 0  // Inicializando o saldo como 0
          }]);
      }
      
      if (updateResult.error) {
        console.error('Erro ao salvar perfil:', updateResult.error);
        throw updateResult.error;
      }
      
      // Atualizar senha se fornecida
      if (novaSenha && typeof novaSenha === 'string' && novaSenha.trim() !== '') {
        console.log('Atualizando senha do usuário');
        const { error: passwordError } = await supabase.auth.updateUser({
          password: novaSenha.trim()
        });
        
        if (passwordError) {
          console.error('Erro ao atualizar senha:', passwordError);
          throw passwordError;
        }
      }
      
      console.log('Perfil atualizado com sucesso para o usuário:', user.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Perfil atualizado com sucesso!',
        user: { 
          id: user.id, 
          nome: nomeTratado,
          email: user.email
        }
      });
      
    } catch (dbError) {
      console.error('Erro no banco de dados:', dbError);
      throw dbError;
    }
    
  } catch (error) {
    console.error('ERRO NA ATUALIZAÇÃO DE PERFIL:', error);
    
    // Mapear erros comuns para mensagens amigáveis
    let errorMessage = 'Ocorreu um erro ao atualizar o perfil';
    let errorCode = 'UPDATE_PROFILE_ERROR';
    let statusCode = 500;
    
    if (error.code === '23505') { // Violação de chave única
      errorMessage = 'Já existe um perfil com este nome de usuário';
      errorCode = 'DUPLICATE_USERNAME';
      statusCode = 400;
    } else if (error.code === 'PGRST116') { // Nenhum registro encontrado
      errorMessage = 'Perfil não encontrado';
      errorCode = 'PROFILE_NOT_FOUND';
      statusCode = 404;
    } else if (error.message && error.message.includes('password')) {
      errorMessage = 'A senha fornecida não atende aos requisitos mínimos';
      errorCode = 'INVALID_PASSWORD';
      statusCode = 400;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    console.log('=== FIM DA REQUISIÇÃO DE ATUALIZAÇÃO DE PERFIL ===\n');
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
