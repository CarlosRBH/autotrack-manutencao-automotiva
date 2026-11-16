const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Pool de conexões MySQL configurado exclusivamente via variáveis de ambiente
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'autotrack_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

/**
 * Trata erros do MySQL e retorna mensagens claras e códigos HTTP adequados.
 * Trata especialmente erro 1451 (chave estrangeira) e 1062 (chave única duplicada).
 */
function handleMySQLError(error, res) {
  console.error('[MySQL Error]', error.code, error.message);

  // ER_ROW_IS_REFERENCED_2 (1451): Tentativa de exclusão/alteração de registro pai com filhos vinculados
  if (error.errno === 1451 || error.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      success: false,
      code: 'ER_ROW_IS_REFERENCED_2',
      message: 'Operação não permitida: existem outros registros vinculados a este item (ex.: veículos cadastrados para o cliente ou manutenções vinculadas ao veículo). Remova ou desvincule os dependentes primeiro.'
    });
  }

  // ER_DUP_ENTRY (1062): Registro duplicado em campo UNIQUE (CPF, E-mail ou Placa)
  if (error.errno === 1062 || error.code === 'ER_DUP_ENTRY') {
    let campoDuplicado = 'dado já cadastrado';
    if (error.message.includes('cpf')) campoDuplicado = 'CPF já cadastrado no sistema';
    else if (error.message.includes('email')) campoDuplicado = 'E-mail já cadastrado no sistema';
    else if (error.message.includes('placa')) campoDuplicado = 'Placa já cadastrada no sistema';

    return res.status(409).json({
      success: false,
      code: 'ER_DUP_ENTRY',
      message: `Registro duplicado: ${campoDuplicado}.`
    });
  }

  // ER_BAD_DB_ERROR (1049): Banco de dados não existe
  if (error.errno === 1049 || error.code === 'ER_BAD_DB_ERROR') {
    return res.status(500).json({
      success: false,
      code: 'ER_BAD_DB_ERROR',
      message: `O banco de dados '${process.env.DB_NAME || 'autotrack_db'}' não foi encontrado. Por favor, importe o arquivo database/schema.sql no MySQL.`
    });
  }

  // ECONNREFUSED: MySQL offline ou porta incorreta
  if (error.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      code: 'ECONNREFUSED',
      message: 'Não foi possível conectar ao servidor MySQL. Verifique se o serviço do MySQL está rodando e se os dados no .env estão corretos.'
    });
  }

  // ER_ACCESS_DENIED_ERROR (1045): Usuário ou senha incorretos
  if (error.errno === 1045 || error.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(401).json({
      success: false,
      code: 'ER_ACCESS_DENIED_ERROR',
      message: 'Acesso negado ao MySQL. Verifique usuário e senha no arquivo .env.'
    });
  }

  // Erro genérico
  return res.status(500).json({
    success: false,
    code: error.code || 'INTERNAL_ERROR',
    message: error.sqlMessage || error.message || 'Erro interno no banco de dados MySQL.'
  });
}

/**
 * Testa a conexão com o banco de dados na inicialização
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[AutoTrack MySQL] Conectado com sucesso ao banco '${process.env.DB_NAME || 'autotrack_db'}' em ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    connection.release();
    return true;
  } catch (error) {
    console.warn(`[AutoTrack MySQL AVISO] Falha na conexão inicial: ${error.message}`);
    return false;
  }
}

module.exports = {
  pool,
  handleMySQLError,
  testConnection
};
