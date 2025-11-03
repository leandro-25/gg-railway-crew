-- Remover qualquer restrição de CHECK que limite o saldo
ALTER TABLE usuarios 
DROP CONSTRAINT IF EXISTS usuarios_saldo_check;

-- Remover qualquer trigger que possa estar validando o saldo
DROP TRIGGER IF EXISTS check_saldo_trigger ON usuarios;

-- Remover a função da trigger se existir
DROP FUNCTION IF EXISTS check_saldo_func();

-- Atualizar o saldo para 0 se for menor que -1000 para corrigir registros existentes
UPDATE usuarios 
SET saldo = 0 
WHERE saldo < -1000;
