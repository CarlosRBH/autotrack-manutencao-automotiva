-- =============================================================================
-- PROJETO: AutoTrack - Sistema de Gestão de Manutenção Automotiva
-- ARQUIVO: database/schema.sql
-- SGBD: MySQL 8.x / MariaDB (Persistência Estritamente Relacional)
-- AUTORES: Matheus da Silva Gomes (RA: 273137)
--          Guilherme Coco da Costa (RA: 272449)
--          Carlos Henrique Beltramo Rodrigues (RA: 272766)
-- =============================================================================

-- Criação do banco de dados com charset utf8mb4 (suporte completo a acentos e emojis)
CREATE DATABASE IF NOT EXISTS autotrack_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE autotrack_db;

-- Desativa verificação de chaves temporariamente para garantir criação limpa se recriando
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS manutencoes;
DROP TABLE IF EXISTS veiculos;
DROP TABLE IF EXISTS clientes;
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABELA 1: clientes
-- Armazena os dados dos proprietários dos veículos atendidos pela oficina.
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    endereco VARCHAR(200) NULL,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABELA 2: veiculos
-- Armazena os dados dos veículos vinculados obrigatoriamente a um cliente (1:N).
-- =============================================================================
CREATE TABLE IF NOT EXISTS veiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    placa VARCHAR(10) NOT NULL UNIQUE,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    ano INT NOT NULL,
    cor VARCHAR(30) NOT NULL,
    quilometragem INT NOT NULL DEFAULT 0,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_veiculos_clientes 
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABELA 3: manutencoes
-- Registra o histórico e status de serviços preventivos/corretivos por veículo (1:N).
-- =============================================================================
CREATE TABLE IF NOT EXISTS manutencoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    veiculo_id INT NOT NULL,
    tipo ENUM('PREVENTIVA', 'CORRETIVA') NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    data_manutencao DATE NOT NULL,
    quilometragem_registro INT NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    status ENUM('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'AGENDADA',
    observacoes TEXT NULL,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_manutencoes_veiculos 
        FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
